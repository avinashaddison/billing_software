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
 * untouched UNLESS they hold a foreign key into a restored table, in which case
 * TRUNCATE ... CASCADE would empty them with nothing to put back — the restore
 * refuses rather than lose them. Snapshot tables that no longer exist are
 * skipped and reported.
 */
import zlib from "node:zlib";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { downloadR2Backup } from "./r2";
import { runDatabaseBackup } from "./backup";
import { validateSnapshot } from "./snapshot-format";

export interface RestoreSummary {
  tables: number;
  rowsRestored: number;
  skippedTables: string[];
  /** R2 key (or filename) of the pre-restore safety backup. */
  safetyBackup: string;
  backupDate: string | null;
}

const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Ceiling on the UNPACKED snapshot. The live snapshot is single-digit MB; this
 * leaves room to grow many times over while refusing a decompression bomb.
 */
const MAX_SNAPSHOT_BYTES = 128 * 1024 * 1024;

/**
 * Tables TRUNCATE ... CASCADE would empty as collateral, which the restore has
 * no rows to refill — i.e. tables added after this backup was taken that hold a
 * foreign key into a restored table. Follows the chain, since a cascade reaches
 * children of children. Only non-empty ones are reported; emptying an already
 * empty table loses nothing and should not block a legitimate restore.
 */
async function cascadeCollateral(
  client: DbClient,
  target: string[],
): Promise<Array<{ table: string; rows: number }>> {
  const { rows: edges } = await client.query<{ child: string; parent: string }>(
    `SELECT src.relname AS child, tgt.relname AS parent
       FROM pg_constraint c
       JOIN pg_class src   ON src.oid = c.conrelid
       JOIN pg_class tgt   ON tgt.oid = c.confrelid
       JOIN pg_namespace n ON n.oid   = src.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'public' AND src.relname <> tgt.relname`,
  );

  const reached = new Set(target);
  for (let changed = true; changed; ) {
    changed = false;
    for (const { child, parent } of edges) {
      if (reached.has(parent) && !reached.has(child)) {
        reached.add(child);
        changed = true;
      }
    }
  }

  const extras = [...reached].filter((t) => !target.includes(t));
  const collateral: Array<{ table: string; rows: number }> = [];
  for (const table of extras) {
    const { rows } = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${qi(table)}`);
    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) collateral.push({ table, rows: n });
  }
  return collateral;
}

/** Minimal view of a pg Pool, so a drill can inject a throwaway database. */
export interface PoolLike {
  connect(): Promise<DbClient & { release(): void }>;
}

export interface RestoreOptions {
  /** Where the snapshot came from. Logged, so an upload is distinguishable. */
  source?: string;
  /**
   * Database to restore INTO. Defaults to the app's own.
   *
   * Injected by the restore rehearsal so it runs against a scratch database and
   * cannot touch live data even if the rehearsal itself is buggy.
   */
  pool?: PoolLike;
  /**
   * Takes the pre-restore safety backup. Defaults to the real one.
   *
   * Only ever overridden by the rehearsal, where the data about to be
   * overwritten is a scratch copy nobody needs. Passing a no-op here against
   * the live database would remove the last line of defence, which is why this
   * is a function to supply rather than a boolean to set.
   */
  takeSafetyBackup?: () => Promise<string>;
}

/** Restore from an R2-stored snapshot. */
export async function restoreDatabaseBackup(key: string): Promise<RestoreSummary> {
  return restoreSnapshot(await downloadR2Backup(key), { source: key });
}

/**
 * Restore from a snapshot already in memory.
 *
 * This exists because backups and restores had drifted apart: the nightly
 * backup can deliver to Telegram, but restore could only ever read from R2 —
 * so a shop with only Telegram configured had backups it could not actually
 * restore. Accepting the bytes directly means any copy of the file works,
 * however it was obtained.
 */
export async function restoreSnapshot(gz: Buffer, opts: RestoreOptions = {}): Promise<RestoreSummary> {
  const db = opts.pool ?? (pool as unknown as PoolLike);
  const key = opts.source ?? "uploaded snapshot";

  /* Skipping the safety backup is only ever legitimate when restoring into an
     injected database (the rehearsal). Tying the two together means no future
     caller can quietly disarm the last line of defence on the real one. */
  if (opts.takeSafetyBackup && !opts.pool) {
    throw new Error("Refusing to skip the safety backup on the live database");
  }

  let payload: unknown;
  try {
    /* Bound the decompression: a few hundred KB of crafted gzip can expand to
       gigabytes and take the server down before anything has been validated.
       The real snapshot is single-digit MB, so this leaves ample headroom. */
    payload = JSON.parse(zlib.gunzipSync(gz, { maxOutputLength: MAX_SNAPSHOT_BYTES }).toString("utf8"));
  } catch (err) {
    if (err instanceof RangeError) {
      throw new Error("That backup is larger than this server will unpack — it may be corrupt or crafted");
    }
    throw new Error("That file is not a readable backup (corrupt gzip/JSON)");
  }
  /* Strict shape check BEFORE the safety backup or any write. A table whose
     value is `{}` rather than `[]` would otherwise pass, contribute no rows,
     and leave the restore to truncate the live table and commit with nothing
     put back. See snapshot-format.ts. */
  const { meta, data: snapshot } = validateSnapshot(payload);

  /* Safety net: capture TODAY's data before overwriting anything. */
  let safetyBackup: string;
  try {
    safetyBackup = opts.takeSafetyBackup
      ? await opts.takeSafetyBackup()
      : await runDatabaseBackup().then((s) => s.destinations.r2 ?? s.filename);
  } catch (err) {
    logger.error({ err }, "pre-restore safety backup failed — restore aborted");
    throw new Error("Aborted: could not take a safety backup of the CURRENT data first. Nothing was changed.");
  }

  const client = await db.connect();
  try {
    const { rows: liveTableRows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const liveTables = new Set(liveTableRows.map((r) => r.tablename));
    const target  = Object.keys(snapshot).filter((t) => liveTables.has(t));
    const skipped = Object.keys(snapshot).filter((t) => !liveTables.has(t));
    if (target.length === 0) throw new Error("Backup contains no tables matching the current database");

    /* ── Guard the CASCADE ───────────────────────────────────────────────
       TRUNCATE ... CASCADE also empties any table holding a foreign key into
       one being restored. If such a table is NOT in the snapshot — a table
       added after the backup was taken — it gets emptied and never refilled,
       which is silent data loss dressed up as a successful restore. Refuse
       instead, naming what would have been destroyed. Empty ones are harmless
       and let an evolved schema still restore. */
    const collateral = await cascadeCollateral(client, target);
    if (collateral.length > 0) {
      throw new Error(
        `Aborted: this backup predates ${collateral.length === 1 ? "a table" : "tables"} that would be wiped ` +
        `and not restored — ${collateral.map((c) => `${c.table} (${c.rows} rows)`).join(", ")}. ` +
        `Nothing was changed. Back that data up separately before restoring.`,
      );
    }

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
      backupDate: (meta["generatedAt"] as string | undefined) ?? (meta["date"] as string | undefined) ?? null,
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
