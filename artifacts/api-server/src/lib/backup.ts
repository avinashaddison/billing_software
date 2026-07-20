/**
 * Nightly database backup → Cloudflare R2 (primary) + Telegram (secondary).
 *
 * Dumps every table in the `public` schema to a single JSON snapshot, gzips
 * it, then delivers it to every configured destination:
 *   - Cloudflare R2 (S3-compatible object storage; see lib/r2.ts for the env
 *     config). Durable, no size ceiling that matters here, auto-pruned to the
 *     newest R2_BACKUP_KEEP files.
 *   - Telegram document to the configured chat (or BACKUP_TELEGRAM_CHAT_ID
 *     override), skipped when the dump exceeds Telegram's 50 MB bot limit.
 * At least one destination must be configured; the backup only counts as
 * failed when EVERY configured destination failed.
 *
 * Why a JSON snapshot (not pg_dump): Render's Node runtime has no `pg_dump`
 * binary, so we do a pure-JS logical export over the existing pool. The pg
 * driver returns native JS values (timestamps → Date → ISO strings, jsonb →
 * objects), so the snapshot is complete and restorable programmatically. Fine
 * for a shop-scale DB; revisit (stream to storage) if any table grows huge.
 */
import zlib from "node:zlib";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { isConfigured, sendDocument } from "./telegram";
import { isR2Configured, uploadBackupToR2, pruneOldR2Backups } from "./r2";

/** Telegram bot document hard limit is 50 MB; stay comfortably under it. */
const MAX_DOC_BYTES = 48 * 1024 * 1024;

export interface BackupSummary {
  tables: number;
  totalRows: number;
  sizeBytes: number;
  filename: string;
  destinations: {
    /** R2 object key when the upload succeeded, else null. */
    r2: string | null;
    /** true when the Telegram document went out. */
    telegram: boolean;
  };
}

/** Optional dedicated backup chat(s); falls back to the default TELEGRAM_CHAT_ID. */
function backupChatIds(): string[] | undefined {
  const raw = process.env.BACKUP_TELEGRAM_CHAT_ID?.trim();
  if (!raw) return undefined;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/**
 * Dump the whole database and deliver it to R2 and/or Telegram. Throws on
 * misconfiguration or when no destination accepted the file, so callers (the
 * manual admin endpoint) can surface a clear error; the scheduled caller just
 * logs it.
 */
export async function runDatabaseBackup(): Promise<BackupSummary> {
  const wantTelegram = isConfigured();
  const wantR2       = isR2Configured();
  if (!wantTelegram && !wantR2) {
    throw new Error("No backup destination configured — set the R2_* env vars (Cloudflare R2) or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
  }

  const startedAt = Date.now();

  // Enumerate real tables in the public schema (skips views). Table names come
  // from the catalog (trusted); still identifier-quoted defensively.
  const { rows: tableRows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  const data: Record<string, unknown[]> = {};
  let totalRows = 0;
  for (const { tablename } of tableRows) {
    const quoted = `"${tablename.replace(/"/g, '""')}"`;
    const { rows } = await pool.query(`SELECT * FROM ${quoted}`);
    data[tablename] = rows;
    totalRows += rows.length;
  }

  const now     = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const timeStr = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false })
    .replace(/:/g, "");
  const payload = {
    meta: {
      app:         "addisonbill",
      format:      "json-snapshot-v1",
      generatedAt: now.toISOString(),
      date:        dateStr,
      tables:      tableRows.length,
      totalRows,
    },
    data,
  };

  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 });
  /* Date + time in the name so a manual backup never overwrites the nightly
     one in R2 (Telegram documents were never overwritten anyway). */
  const filename = `addisonbill-backup-${dateStr}-${timeStr}.json.gz`;
  const sizeMb = gz.length / (1024 * 1024);

  const errors: string[] = [];
  let r2Key: string | null = null;
  let telegramSent = false;

  /* ── Destination 1: Cloudflare R2 ── */
  if (wantR2) {
    try {
      r2Key = await uploadBackupToR2(filename, gz);
      logger.info({ key: r2Key, sizeMb: Number(sizeMb.toFixed(2)) }, "Database backup uploaded to R2");
      void pruneOldR2Backups(); // best-effort retention, never blocks
    } catch (err) {
      errors.push("R2 upload failed");
      logger.error({ err }, "R2 backup upload failed");
    }
  }

  /* ── Destination 2: Telegram ── */
  if (wantTelegram) {
    if (gz.length > MAX_DOC_BYTES) {
      logger.warn({ sizeMb: Number(sizeMb.toFixed(1)) }, "DB backup exceeds Telegram's 50 MB limit — Telegram skipped");
      if (!r2Key) errors.push(`backup is ${sizeMb.toFixed(1)} MB — over Telegram's 50 MB limit (configure R2 for large backups)`);
    } else {
      try {
        const caption = [
          `🗄️ <b>Addison Bill — Database Backup</b>`,
          `📅 ${dateStr}`,
          `📦 ${tableRows.length} tables · ${totalRows.toLocaleString("en-IN")} rows`,
          `💾 ${sizeMb.toFixed(2)} MB (gzip)`,
          r2Key ? `☁️ Also stored in Cloudflare R2` : null,
        ].filter(Boolean).join("\n");
        await sendDocument(filename, gz, caption, backupChatIds());
        telegramSent = true;
      } catch (err) {
        errors.push("Telegram send failed");
        logger.error({ err }, "Telegram backup send failed");
      }
    }
  }

  if (!r2Key && !telegramSent) {
    throw new Error(`Backup failed: ${errors.join("; ") || "no destination accepted the file"}`);
  }

  logger.info(
    {
      tables: tableRows.length, totalRows, sizeMb: Number(sizeMb.toFixed(2)),
      r2: r2Key ?? false, telegram: telegramSent, ms: Date.now() - startedAt,
    },
    "Database backup complete",
  );

  return {
    tables: tableRows.length,
    totalRows,
    sizeBytes: gz.length,
    filename,
    destinations: { r2: r2Key, telegram: telegramSent },
  };
}
