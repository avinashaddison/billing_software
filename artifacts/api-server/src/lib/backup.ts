/**
 * Nightly database backup → Telegram.
 *
 * Dumps every table in the `public` schema to a single JSON snapshot, gzips it,
 * and sends it as a Telegram document to the configured chat (or the
 * BACKUP_TELEGRAM_CHAT_ID override — handy for routing backups to a private
 * "backups" chat instead of the noisy sales-alert chat).
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

/** Telegram bot document hard limit is 50 MB; stay comfortably under it. */
const MAX_DOC_BYTES = 48 * 1024 * 1024;

export interface BackupSummary {
  tables: number;
  totalRows: number;
  sizeBytes: number;
  filename: string;
}

/** Optional dedicated backup chat(s); falls back to the default TELEGRAM_CHAT_ID. */
function backupChatIds(): string[] | undefined {
  const raw = process.env.BACKUP_TELEGRAM_CHAT_ID?.trim();
  if (!raw) return undefined;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/**
 * Dump the whole database and send it to Telegram. Throws on
 * misconfiguration or an oversized dump so callers (the manual admin endpoint)
 * can surface a clear error; the scheduled caller just logs it.
 */
export async function runDatabaseBackup(): Promise<BackupSummary> {
  if (!isConfigured()) {
    throw new Error("Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)");
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

  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const payload = {
    meta: {
      app:         "addisonbill",
      format:      "json-snapshot-v1",
      generatedAt: new Date().toISOString(),
      date:        dateStr,
      tables:      tableRows.length,
      totalRows,
    },
    data,
  };

  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 });
  const filename = `addisonbill-backup-${dateStr}.json.gz`;
  const sizeMb = gz.length / (1024 * 1024);

  if (gz.length > MAX_DOC_BYTES) {
    logger.error({ sizeMb, tables: tableRows.length, totalRows }, "DB backup exceeds Telegram limit — not sent");
    throw new Error(`Backup is ${sizeMb.toFixed(1)} MB — over Telegram's 50 MB limit. Switch to Google Drive/GCS.`);
  }

  const caption = [
    `🗄️ <b>Addison Bill — Database Backup</b>`,
    `📅 ${dateStr}`,
    `📦 ${tableRows.length} tables · ${totalRows.toLocaleString("en-IN")} rows`,
    `💾 ${sizeMb.toFixed(2)} MB (gzip)`,
  ].join("\n");

  await sendDocument(filename, gz, caption, backupChatIds());

  logger.info(
    { tables: tableRows.length, totalRows, sizeMb: Number(sizeMb.toFixed(2)), ms: Date.now() - startedAt },
    "Database backup sent to Telegram",
  );

  return { tables: tableRows.length, totalRows, sizeBytes: gz.length, filename };
}
