/**
 * Database restore from a stored R2 backup snapshot.
 *
 * Counterpart of lib/backup.ts (format "json-snapshot-v1"). Flow:
 *   1. Download + gunzip + validate the snapshot from R2.
 *   2. Take a SAFETY BACKUP of the current data first — if that fails the
 *      restore is aborted, so there is always a way back.
 *   3. In ONE transaction: TRUNCATE every table present in both the snapshot
 *      and the live schema (single statement + CASCADE so FK-linked tables
 *      empty together), then re-insert the snapshot rows. Insert order is
 *      resolved empirically: tables that fail on a foreign key roll back to a
 *      savepoint and retry on the next pass, until every table lands (child
 *      tables settle after their parents without hand-maintaining a
 *      dependency graph).
 *   4. Reset sequences for serial columns so new inserts don't collide.
 *
 * Tables that exist only in the live schema (added after the backup) are left
 * untouched; snapshot tables that no longer exist are skipped and reported.
 */
import zlib from "node:zlib";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { downloadR2Backup } from "./r2";
import { runDatabaseBackup } from "./backup";

interface SnapshotPayload {
  meta?: { format?: string; generatedAt?: string; date?: string };
  data?: Record<string, Record<string, unknown>[]>;
}

export interface RestoreSummary {
  tables: number;
  rowsRestored: number;
  skippedTables: string[];
  /** R2 key (or filename) of the pre-restore safety backup. */
  safetyBackup: string;
  backupDate: string | null;
}

const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

export async function restoreDatabaseBackup(key: string): Promise<RestoreSummary> {
  const gz = await downloadR2Backup(key);
  let payload: SnapshotPayload;
  try {
    payload = JSON.parse(zlib.gunzipSync(gz).toString("utf8")) as SnapshotPayload;
  } catch {
    throw new Error("That file is not a readable backup (corrupt gzip/JSON)");
  }
  if (payload?.meta?.format !== "json-snapshot-v1" || !payload.data || typeof payload.data !== "object") {
    throw new Error("Unrecognised backup format — expected an Addison Bill json-snapshot-v1 file");
  }
  const snapshot = payload.data;

  /* Safety net: capture TODAY's data before overwriting anything. */
  let safetyBackup: string;
  try {
    const s = await runDatabaseBackup();
    safetyBackup = s.destinations.r2 ?? s.filename;
  } catch (err) {
    logger.error({ err }, "pre-restore safety backup failed — restore aborted");
    throw new Error("Aborted: could not take a safety backup of the CURRENT data first. Nothing was changed.");
  }

  const client = await pool.connect();
  try {
    const { rows: liveTableRows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const liveTables = new Set(liveTableRows.map((r) => r.tablename));
    const target  = Object.keys(snapshot).filter((t) => liveTables.has(t));
    const skipped = Object.keys(snapshot).filter((t) => !liveTables.has(t));
    if (target.length === 0) throw new Error("Backup contains no tables matching the current database");

    await client.query("BEGIN");

    await client.query(`TRUNCATE TABLE ${target.map(qi).join(", ")} CASCADE`);

    let remaining = target.filter((t) => (snapshot[t]?.length ?? 0) > 0);
    let rowsRestored = 0;
    let lastErr: unknown = null;
    for (let pass = 0; remaining.length > 0 && pass < 12; pass++) {
      const failed: string[] = [];
      for (const t of remaining) {
        await client.query("SAVEPOINT restore_table");
        try {
          rowsRestored += await insertTableRows(client, t, snapshot[t]!);
          await client.query("RELEASE SAVEPOINT restore_table");
        } catch (err) {
          lastErr = err;
          await client.query("ROLLBACK TO SAVEPOINT restore_table");
          failed.push(t);
        }
      }
      if (failed.length === remaining.length) {
        logger.error({ failed, err: lastErr }, "restore: no progress inserting tables");
        throw new Error(`Restore failed on tables: ${failed.join(", ")}`);
      }
      remaining = failed;
    }
    if (remaining.length > 0) throw new Error(`Restore failed on tables: ${remaining.join(", ")}`);

    /* Serial sequences must catch up with the restored ids. */
    const { rows: seqCols } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`,
    );
    for (const s of seqCols) {
      if (!liveTables.has(s.table_name)) continue;
      await client.query(
        `SELECT setval(
           pg_get_serial_sequence($1, $2),
           COALESCE((SELECT MAX(${qi(s.column_name)}) FROM ${qi(s.table_name)}), 0) + 1,
           false
         )`,
        [s.table_name, s.column_name],
      );
    }

    await client.query("COMMIT");
    logger.info({ key, tables: target.length, rowsRestored, skipped }, "database restore complete");
    return {
      tables: target.length,
      rowsRestored,
      skippedTables: skipped,
      safetyBackup,
      backupDate: payload.meta?.generatedAt ?? payload.meta?.date ?? null,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Insert one table's snapshot rows in parameterized chunks. Only columns that
 *  still exist are written; json/jsonb columns are explicitly re-serialised so
 *  a JSON array value can't be mistaken for a Postgres array. */
/* Minimal structural view of pg's PoolClient — pg itself is a lib/db
   dependency, so its types can't be imported here directly. */
interface DbClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

async function insertTableRows(
  client: DbClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  const { rows: colRows } = await client.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const liveTypes = new Map(colRows.map((c) => [c.column_name, c.data_type]));
  const cols = Object.keys(rows[0] ?? {}).filter((c) => liveTypes.has(c));
  if (cols.length === 0) return 0;

  const isJson = (c: string) => {
    const t = liveTypes.get(c);
    return t === "json" || t === "jsonb";
  };
  const colSql = cols.map(qi).join(", ");

  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((r, ri) =>
      "(" + cols.map((c, ci) => {
        const v = r[c];
        params.push(v === undefined ? null : isJson(c) && v !== null ? JSON.stringify(v) : v);
        return `$${ri * cols.length + ci + 1}`;
      }).join(", ") + ")",
    ).join(", ");
    await client.query(`INSERT INTO ${qi(table)} (${colSql}) VALUES ${tuples}`, params);
    inserted += chunk.length;
  }
  return inserted;
}
