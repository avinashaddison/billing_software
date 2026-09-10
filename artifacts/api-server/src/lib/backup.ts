/**
 * Database backup → Cloudflare R2 (primary) + Telegram (secondary).
 *
 * Dumps every table in the `public` schema to a single JSON snapshot, gzips
 * it, seals it with AES-256-GCM when BACKUP_ENCRYPTION_KEY is set (see
 * lib/backup-crypto.ts), then delivers it to every configured destination:
 *   - Cloudflare R2 (S3-compatible object storage; see lib/r2.ts for the env
 *     config). Durable, no size ceiling that matters here, auto-pruned to the
 *     newest R2_BACKUP_KEEP nightlies / 48 h of intraday snapshots.
 *   - Telegram document to the configured chat (or BACKUP_TELEGRAM_CHAT_ID
 *     override), skipped when the dump exceeds Telegram's 50 MB bot limit.
 *     Intraday snapshots never go to Telegram — a dozen documents a day in
 *     the owner's chat would bury the one message that matters.
 * At least one destination must be configured; the backup only counts as
 * failed when EVERY configured destination failed.
 *
 * Every run — scheduled, manual or the pre-restore safety copy — is recorded
 * in the `backup_runs` ledger (lib/backup-runs.ts), which is how the admin
 * page and the staleness alert know when the last backup really succeeded.
 *
 * Why a JSON snapshot (not pg_dump): Render's Node runtime has no `pg_dump`
 * binary, so we do a pure-JS logical export over the existing pool. The pg
 * driver returns native JS values (timestamps → Date → ISO strings, jsonb →
 * objects), so the snapshot is complete and restorable programmatically. Fine
 * for a shop-scale DB; revisit (stream to storage) if any table grows huge.
 *
 * The dump runs as ONE REPEATABLE READ transaction so every table is read at
 * the same instant — see dumpDatabaseSnapshot.
 */
import zlib from "node:zlib";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { isConfigured, sendDocument } from "./telegram";
import { isR2Configured, uploadBackupToR2, pruneOldR2Backups, pruneIntradayR2Backups } from "./r2";
import { SNAPSHOT_FORMAT } from "./snapshot-format";
import { resolveBackupKey, encryptBackup, ENCRYPTED_EXTENSION } from "./backup-crypto";
import { beginAdHocRun, finishRun, failRun } from "./backup-runs";
import type { BackupKind } from "./backup-schedule";

/** Telegram bot document hard limit is 50 MB; stay comfortably under it. */
const MAX_DOC_BYTES = 48 * 1024 * 1024;

/**
 * Tables that are never part of a snapshot. `backup_runs` is the ledger OF
 * backups: putting it in the file it describes is circular, and restoring it
 * would rewind "last successful backup" to whatever the snapshot remembered
 * and set off a false staleness alert.
 */
export const SNAPSHOT_EXCLUDED_TABLES: ReadonlySet<string> = new Set(["backup_runs"]);

export interface BackupSummary {
  kind: BackupKind;
  /** Ledger row for this run. */
  slot: string;
  tables: number;
  totalRows: number;
  sizeBytes: number;
  encrypted: boolean;
  filename: string;
  destinations: {
    /** R2 object key when the upload succeeded, else null. */
    r2: string | null;
    /** true when the Telegram document went out. */
    telegram: boolean;
  };
}

export interface RunBackupOptions {
  /** Defaults to "manual". Intraday runs go to R2 only. */
  kind?: BackupKind;
  /** Ledger slot already claimed by the scheduler; ad-hoc runs open their own. */
  slot?: string;
  /** Attempt number returned by the claim — fences the outcome write so a
   *  worker that was taken over cannot overwrite its successor's result. */
  attempt?: number;
}

/** Optional dedicated backup chat(s); falls back to the default TELEGRAM_CHAT_ID. */
function backupChatIds(): string[] | undefined {
  const raw = process.env.BACKUP_TELEGRAM_CHAT_ID?.trim();
  if (!raw) return undefined;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/** Structural view of a pg Pool, so the restore rehearsal can dump through its
 *  own connection without importing pg types here. */
export interface SnapshotSource {
  connect(): Promise<{
    query<T = Record<string, unknown>>(text: string): Promise<{ rows: T[] }>;
    release(): void;
  }>;
}

export interface DatabaseSnapshot {
  payload: { meta: Record<string, unknown>; data: Record<string, unknown[]> };
  tables: number;
  totalRows: number;
  /** IST date/time stamps for building the backup filename. */
  dateStr: string;
  timeStr: string;
}

/**
 * Dump every public-schema table as ONE consistent snapshot.
 *
 * The whole dump runs in a single REPEATABLE READ, READ ONLY transaction on a
 * single connection, so every table is read as of the same instant. Dumping
 * table-by-table on the shared pool instead would let a sale committed
 * mid-dump appear in `sale_items` but not in `bills` — a snapshot whose
 * foreign keys don't line up, which the restore would rightly refuse,
 * discovered only on the day the backup is actually needed.
 */
export async function dumpDatabaseSnapshot(
  source: SnapshotSource = pool as unknown as SnapshotSource,
): Promise<DatabaseSnapshot> {
  const client = await source.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    // Enumerate real tables in the public schema (skips views). Table names come
    // from the catalog (trusted); still identifier-quoted defensively.
    const { rows: allTables } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const tableRows = allTables.filter((t) => !SNAPSHOT_EXCLUDED_TABLES.has(t.tablename));

    const data: Record<string, unknown[]> = {};
    let totalRows = 0;
    for (const { tablename } of tableRows) {
      const quoted = `"${tablename.replace(/"/g, '""')}"`;
      const { rows } = await client.query(`SELECT * FROM ${quoted}`);
      data[tablename] = rows;
      totalRows += rows.length;
    }
    await client.query("COMMIT");

    const now     = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const timeStr = now
      .toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false })
      .replace(/:/g, "");
    return {
      payload: {
        meta: {
          app:         "addisonbill",
          format:      SNAPSHOT_FORMAT,
          generatedAt: now.toISOString(),
          date:        dateStr,
          tables:      tableRows.length,
          totalRows,
        },
        data,
      },
      tables: tableRows.length,
      totalRows,
      dateStr,
      timeStr,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Dump the whole database and deliver it to R2 and/or Telegram. Throws on
 * misconfiguration or when no destination accepted the file, so callers (the
 * manual admin endpoint) can surface a clear error; the scheduled caller just
 * logs it. The outcome — success or failure — is written to the ledger either
 * way.
 */
export async function runDatabaseBackup(opts: RunBackupOptions = {}): Promise<BackupSummary> {
  const kind = opts.kind ?? "manual";

  /* The ledger row is opened before anything else so a crash mid-run leaves a
     visible `running` row (which the scheduler later treats as dead) rather
     than nothing, and so a misconfiguration is recorded as a failed attempt
     instead of leaving a claimed slot dangling. Ledger trouble must never
     stop a backup from happening, though — it degrades to "not recorded",
     loudly. */
  let slot = opts.slot ?? null;
  const attempt = opts.attempt ?? null;
  if (!slot) {
    try {
      slot = await beginAdHocRun(kind);
    } catch (err) {
      logger.error({ err, kind }, "could not open a backup_runs row — continuing without the ledger");
    }
  }
  const record = async (fn: () => Promise<boolean>) => {
    if (!slot) return;
    try {
      if (!(await fn())) logger.warn({ slot, attempt }, "backup_runs row was taken over by a later attempt — outcome not recorded");
    } catch (err) {
      logger.error({ err, slot }, "could not update backup_runs");
    }
  };

  try {
    const intraday = kind === "intraday";
    const wantTelegram = !intraday && isConfigured();
    const wantR2       = isR2Configured();
    if (intraday && !wantR2) {
      throw new Error("Intraday backups need Cloudflare R2 — set the R2_* env vars or switch intraday backups off");
    }
    if (!wantTelegram && !wantR2) {
      throw new Error("No backup destination configured — set the R2_* env vars (Cloudflare R2) or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    }
    /* Resolved up front: a weak key must fail the run before any work is done. */
    const encryptionKey = resolveBackupKey();

    const summary = await performBackup(kind, wantR2, wantTelegram, encryptionKey, slot ?? `${kind}:unrecorded`);
    await record(() => finishRun(slot!, {
      r2Key: summary.destinations.r2,
      telegram: summary.destinations.telegram,
      encrypted: summary.encrypted,
      sizeBytes: summary.sizeBytes,
      tables: summary.tables,
      totalRows: summary.totalRows,
    }, attempt));
    return summary;
  } catch (err) {
    await record(() => failRun(slot!, err instanceof Error ? err.message : String(err), attempt));
    throw err;
  }
}

async function performBackup(
  kind: BackupKind,
  wantR2: boolean,
  wantTelegram: boolean,
  encryptionKey: string | null,
  slot: string,
): Promise<BackupSummary> {
  const startedAt = Date.now();

  const { payload, tables, totalRows, dateStr, timeStr } = await dumpDatabaseSnapshot();

  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 });
  const bytes = encryptionKey ? encryptBackup(gz, encryptionKey) : gz;
  const encrypted = !!encryptionKey;
  /* Date + time in the name so a manual backup never overwrites the nightly
     one in R2 (Telegram documents were never overwritten anyway). */
  const filename = `addisonbill-backup-${dateStr}-${timeStr}.json.gz${encrypted ? ENCRYPTED_EXTENSION : ""}`;
  const sizeMb = bytes.length / (1024 * 1024);

  const errors: string[] = [];
  let r2Key: string | null = null;
  let telegramSent = false;

  /* ── Destination 1: Cloudflare R2 ── */
  if (wantR2) {
    try {
      r2Key = await uploadBackupToR2(filename, bytes, kind === "intraday" ? "intraday" : "nightly");
      logger.info({ key: r2Key, kind, sizeMb: Number(sizeMb.toFixed(2)), encrypted }, "Database backup uploaded to R2");
      // best-effort retention, never blocks
      void (kind === "intraday" ? pruneIntradayR2Backups() : pruneOldR2Backups());
    } catch (err) {
      errors.push("R2 upload failed");
      logger.error({ err }, "R2 backup upload failed");
    }
  }

  /* ── Destination 2: Telegram ── */
  if (wantTelegram) {
    if (bytes.length > MAX_DOC_BYTES) {
      logger.warn({ sizeMb: Number(sizeMb.toFixed(1)) }, "DB backup exceeds Telegram's 50 MB limit — Telegram skipped");
      if (!r2Key) errors.push(`backup is ${sizeMb.toFixed(1)} MB — over Telegram's 50 MB limit (configure R2 for large backups)`);
    } else {
      try {
        const caption = [
          `🗄️ <b>Addison Bill — Database Backup</b>`,
          `📅 ${dateStr} ${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)} IST${kind === "manual" ? " (manual)" : kind === "safety" ? " (pre-restore safety copy)" : ""}`,
          `📦 ${tables} tables · ${totalRows.toLocaleString("en-IN")} rows`,
          `💾 ${sizeMb.toFixed(2)} MB (gzip)`,
          encrypted ? `🔒 Encrypted — needs BACKUP_ENCRYPTION_KEY to restore` : `🔓 Not encrypted`,
          r2Key ? `☁️ Also stored in Cloudflare R2` : null,
        ].filter(Boolean).join("\n");
        telegramSent = (await sendDocument(filename, bytes, caption, backupChatIds())) > 0;
        if (!telegramSent) errors.push("Telegram did not accept the file");
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
      kind, slot, tables, totalRows, sizeMb: Number(sizeMb.toFixed(2)), encrypted,
      r2: r2Key ?? false, telegram: telegramSent, ms: Date.now() - startedAt,
    },
    "Database backup complete",
  );

  return {
    kind,
    slot,
    tables,
    totalRows,
    sizeBytes: bytes.length,
    encrypted,
    filename,
    destinations: { r2: r2Key, telegram: telegramSent },
  };
}
