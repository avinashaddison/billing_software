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
 *
 * Encrypted files (lib/backup-crypto.ts) are opened transparently; plain
 * ones still work. A per-shop variant lives at the bottom of this file.
 */
import zlib from "node:zlib";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { downloadR2Backup } from "./r2";
import { runDatabaseBackup, SNAPSHOT_EXCLUDED_TABLES } from "./backup";
import { validateSnapshot, type ValidSnapshot, type SnapshotRow } from "./snapshot-format";
import { openBackupBytes, resolveBackupKey, isEncryptedBackup } from "./backup-crypto";

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
  const edges = await fkEdges(client);

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

/**
 * Bytes → validated snapshot. Handles both encrypted (.enc) and plain files;
 * every read path — full restore, per-shop restore, previews — goes through
 * here so they cannot disagree about what a valid backup is.
 */
export function parseSnapshotBytes(bytes: Buffer): ValidSnapshot {
  const gz = openBackupBytes(bytes, resolveBackupKey());
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
  return validateSnapshot(payload);
}

export { isEncryptedBackup };

/** Safety net: capture TODAY's data before overwriting anything. */
async function takeSafetyBackup(opts: RestoreOptions): Promise<string> {
  try {
    return opts.takeSafetyBackup
      ? await opts.takeSafetyBackup()
      : await runDatabaseBackup({ kind: "safety" }).then((s) => s.destinations.r2 ?? s.filename);
  } catch (err) {
    logger.error({ err }, "pre-restore safety backup failed — restore aborted");
    throw new Error("Aborted: could not take a safety backup of the CURRENT data first. Nothing was changed.");
  }
}

async function listLiveTables(client: DbClient): Promise<Set<string>> {
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  return new Set(rows.map((r) => r.tablename));
}

interface FkEdge {
  child: string;
  parent: string;
  /** Column pairs, index-aligned: child.childCols[i] → parent.parentCols[i]. */
  childCols: string[];
  parentCols: string[];
}

/** Every foreign key in the public schema, including self-references. */
async function fkEdges(client: DbClient): Promise<FkEdge[]> {
  const { rows } = await client.query<{ child: string; parent: string; child_cols: string[]; parent_cols: string[] }>(
    `SELECT src.relname AS child,
            tgt.relname AS parent,
            ARRAY(SELECT a.attname::text FROM unnest(c.conkey)  WITH ORDINALITY k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = c.conrelid  AND a.attnum = k.attnum ORDER BY k.ord) AS child_cols,
            ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum ORDER BY k.ord) AS parent_cols
       FROM pg_constraint c
       JOIN pg_class src   ON src.oid = c.conrelid
       JOIN pg_class tgt   ON tgt.oid = c.confrelid
       JOIN pg_namespace n ON n.oid   = src.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'`,
  );
  return rows.map((r) => ({ child: r.child, parent: r.parent, childCols: r.child_cols, parentCols: r.parent_cols }));
}

/** Primary-key columns per table (tables without one are absent). */
async function primaryKeys(client: DbClient): Promise<Map<string, string[]>> {
  const { rows } = await client.query<{ table_name: string; cols: string[] }>(
    `SELECT t.relname AS table_name,
            ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum ORDER BY k.ord) AS cols
       FROM pg_index i
       JOIN pg_class t     ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE i.indisprimary AND n.nspname = 'public'`,
  );
  return new Map(rows.map((r) => [r.table_name, r.cols]));
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

  const { meta, data: snapshot } = parseSnapshotBytes(gz);

  const client = await db.connect();
  let inTransaction = false;
  try {
    const liveTables = await listLiveTables(client);
    const target  = Object.keys(snapshot).filter((t) => liveTables.has(t) && !SNAPSHOT_EXCLUDED_TABLES.has(t));
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
    inTransaction = true;
    await lockTablesForRestore(client, target);

    /* Writers are now held off, so the safety copy is exactly what gets
       replaced — nothing can slip in between the two. */
    const safetyBackup = await takeSafetyBackup(opts);

    await client.query(`TRUNCATE TABLE ${target.map(qi).join(", ")} CASCADE`);

    const rowsRestored = await insertTablesInDependencyOrder(
      client,
      Object.fromEntries(target.map((t) => [t, snapshot[t] ?? []])),
    );
    await resetSerialSequences(client, liveTables);

    await client.query("COMMIT");
    inTransaction = false;
    logger.info({ key, tables: target.length, rowsRestored, skipped }, "database restore complete");
    return {
      tables: target.length,
      rowsRestored,
      skippedTables: skipped,
      safetyBackup,
      backupDate: (meta["generatedAt"] as string | undefined) ?? (meta["date"] as string | undefined) ?? null,
    };
  } catch (err) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Insert every table's rows, resolving foreign-key order empirically: a table
 * that fails rolls back to a savepoint and retries on the next pass, until
 * every table lands (children settle after their parents without a
 * hand-maintained dependency graph). Must run inside an open transaction.
 */
async function insertTablesInDependencyOrder(
  client: DbClient,
  tables: Record<string, SnapshotRow[]>,
  upsert?: UpsertScope,
): Promise<number> {
  let remaining = Object.keys(tables).filter((t) => tables[t]!.length > 0);
  let rowsRestored = 0;
  let lastErr: unknown = null;
  for (let pass = 0; remaining.length > 0 && pass < 12; pass++) {
    const failed: string[] = [];
    for (const t of remaining) {
      await client.query("SAVEPOINT restore_table");
      try {
        rowsRestored += await insertTableRows(client, t, tables[t]!, upsert);
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
  return rowsRestored;
}

/** Serial sequences must catch up with the restored ids. */
/**
 * Make every serial sequence at least MAX(column)+1 so the next insert cannot
 * collide with a restored row. Sequences are only ever moved FORWARD: they are
 * shared by every shop (bill numbers, say), a value handed out to a concurrent,
 * still-uncommitted insert is invisible to MAX(), and setval() itself survives
 * a rollback — so rewinding to MAX()+1 could hand a number out twice. Reading
 * the sequence's own last_value sees every allocation, committed or not.
 */
async function resetSerialSequences(client: DbClient, liveTables: Set<string>): Promise<void> {
  const { rows: seqCols } = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`,
  );
  for (const s of seqCols) {
    if (!liveTables.has(s.table_name)) continue;
    const { rows: seqRows } = await client.query<{ seq: string | null; needed: string }>(
      `SELECT pg_get_serial_sequence($1, $2) AS seq,
              (COALESCE((SELECT MAX(${qi(s.column_name)}) FROM ${qi(s.table_name)}), 0) + 1)::text AS needed`,
      [s.table_name, s.column_name],
    );
    const seq = seqRows[0]?.seq;
    if (!seq) continue;
    const needed = Number(seqRows[0]!.needed);
    const { rows: state } = await client.query<{ last_value: string; is_called: boolean }>(
      `SELECT last_value::text, is_called FROM ${seq}`,
    );
    const cur = state[0];
    const nextValue = cur ? Number(cur.last_value) + (cur.is_called ? 1 : 0) : 1;
    if (nextValue >= needed) continue;
    await client.query(`SELECT setval($1, $2::bigint, false)`, [seq, needed]);
  }
}

/**
 * Stop every writer on the tables a restore is about to rewrite, for the rest
 * of the transaction. Reads carry on; inserts/updates/deletes queue behind
 * the restore and land on the restored data. Taken BEFORE the safety backup so
 * nothing can be written between "copied" and "replaced" and so the FK guards
 * in the per-shop delete phase see a world that cannot change under them.
 * `lock_timeout` keeps a long-running writer from turning this into a hang.
 */
async function lockTablesForRestore(client: DbClient, tables: Iterable<string>): Promise<void> {
  const list = [...new Set(tables)].sort();
  if (list.length === 0) return;
  await client.query(`SET LOCAL lock_timeout = '20s'`);
  await client.query(`LOCK TABLE ${list.map(qi).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
}

/* ═══════════════════════ Per-shop (tenant) restore ═══════════════════════ */

/**
 * Tables that carry a tenant_id but belong to the VENDOR's relationship with
 * the shop, not to the shop's own books. A per-shop restore leaves them alone:
 *   - tenants / tenant_payments / announcements / license_status / api_keys —
 *     plan, expiry, invoices, notices and integration keys the vendor manages;
 *   - auth_users / auth_sessions — owner logins. Rolling a password back to
 *     what it was a week ago locks the owner out with a password they no
 *     longer remember, and audit_events points at these rows.
 * Everything else with a tenant_id column is shop data and is restored. New
 * shop tables are therefore included by default, which is the safe failure
 * mode: a shop restore that quietly skipped a table would be a partial
 * restore nobody asked for.
 */
export const TENANT_RESTORE_EXCLUDED_TABLES: ReadonlySet<string> = new Set([
  "tenants", "tenant_payments", "announcements", "license_status", "api_keys",
  "auth_users", "auth_sessions", "audit_events", "platform_settings", "_migrations",
  ...SNAPSHOT_EXCLUDED_TABLES,
]);

export interface TenantTableChange {
  table: string;
  /** Rows the live database holds for this shop right now. */
  live: number;
  /** Rows the snapshot holds for this shop. */
  snapshot: number;
  /** Live rows of this shop that something OUTSIDE the shop still references
   *  (typically a legacy row that never got a tenant_id). They cannot be
   *  deleted without breaking that reference, so they are overwritten in
   *  place from the snapshot instead. */
  pinned: number;
}

export interface TenantRestorePreview {
  tenantId: string;
  /** Live name (the shop as it exists now). */
  tenantName: string;
  backupDate: string | null;
  encrypted: boolean;
  tables: TenantTableChange[];
  totalLive: number;
  totalSnapshot: number;
  totalPinned: number;
}

export interface TenantRestoreSummary extends TenantRestorePreview {
  rowsDeleted: number;
  rowsRestored: number;
  /** Rows that survived the delete phase because of an outside reference and
   *  were overwritten in place (see TenantTableChange.pinned). */
  rowsKept: number;
  /** Pinned rows the snapshot has no version of — left exactly as they are. */
  rowsKeptStale: number;
  /** R2 key (or filename) of the pre-restore safety backup. */
  safetyBackup: string;
}

/* Tenant ids are human slugs ("hira-sons"), not UUIDs. The id is only ever a
   bound parameter, so this guards against junk, not injection. */
const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Live tables with a tenant_id column, minus the vendor-owned ones. */
async function tenantScopedTables(client: DbClient): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT c.table_name
       FROM information_schema.columns c
       JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = c.table_schema
      WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id'
      ORDER BY c.table_name`,
  );
  return rows.map((r) => r.table_name).filter((t) => !TENANT_RESTORE_EXCLUDED_TABLES.has(t));
}

/**
 * Children before parents, so by the time a parent table is cleared every
 * in-scope row that pointed at it is already gone. Whatever still references
 * a row after that is, by construction, outside the shop — see
 * `clearTenantRows` for how those rows are handled.
 */
function childFirstOrder(tables: string[], edges: FkEdge[]): string[] {
  const inScope = new Set(tables);
  const scoped = edges.filter((e) => inScope.has(e.child) && inScope.has(e.parent) && e.child !== e.parent);
  const remaining = new Set(tables);
  const ordered: string[] = [];
  while (remaining.size > 0) {
    /* A table is safe to delete once nothing still remaining references it. */
    const free = [...remaining].filter((t) => !scoped.some((e) => e.parent === t && remaining.has(e.child) && e.child !== t));
    if (free.length === 0) {
      /* Cycle (none exist today). Fall back to the given order; a genuine FK
         problem will surface as an error rather than pass silently. */
      ordered.push(...remaining);
      break;
    }
    for (const t of free) { ordered.push(t); remaining.delete(t); }
  }
  return ordered;
}

async function liveTenantName(client: DbClient, tenantId: string): Promise<string> {
  const { rows } = await client.query<{ name: string }>(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
  if (!rows[0]) {
    throw new Error(
      "That shop does not exist in the live database. A per-shop restore refills an existing shop; " +
      "if the whole shop was deleted, restore the full snapshot instead.",
    );
  }
  return rows[0].name;
}

async function countTenantRows(client: DbClient, table: string, tenantId: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${qi(table)} WHERE tenant_id = $1`, [tenantId],
  );
  return Number(rows[0]?.n ?? 0);
}

/** `r.<childCol> = p.<parentCol> AND …` for one foreign key. */
function fkJoin(e: FkEdge): string {
  return e.childCols.map((c, i) => `r.${qi(c)} = p.${qi(e.parentCols[i]!)}`).join(" AND ");
}

/**
 * How many of this shop's rows in `table` are referenced by rows that are NOT
 * this shop's — the rows a per-shop restore will overwrite in place rather
 * than delete. Read-only estimate for the preview; the restore itself decides
 * from what actually remains after the delete phase.
 */
async function countPinnedRows(
  client: DbClient,
  table: string,
  tenantId: string,
  edges: FkEdge[],
  scopedTables: ReadonlySet<string>,
): Promise<number> {
  const referrers = edges.filter((e) => e.parent === table);
  if (referrers.length === 0) return 0;
  const outside = referrers.map((e) =>
    `EXISTS (SELECT 1 FROM ${qi(e.child)} r WHERE ${fkJoin(e)}${scopedTables.has(e.child) ? " AND r.tenant_id IS DISTINCT FROM $1" : ""})`,
  ).join(" OR ");
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${qi(table)} p WHERE p.tenant_id = $1 AND (${outside})`, [tenantId],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Delete this shop's rows from one table — except those something else still
 * points at. With children cleared first, any remaining reference comes from
 * outside the shop: a legacy bill line that never got a tenant_id, say, still
 * pointing at one of this shop's products. Deleting the product would break
 * that row (or, for ON DELETE CASCADE keys, silently destroy it), and aborting
 * would make the shop that owns the legacy data the one shop that can never
 * be restored. So the row stays, is reported, and the insert phase overwrites
 * it in place with the snapshot's version.
 *
 * Runs until a pass deletes nothing, so a self-referencing table is peeled
 * from the leaves inward instead of stopping at the first pass.
 */
async function clearTenantRows(client: DbClient, table: string, tenantId: string, edges: FkEdge[]): Promise<number> {
  const guard = edges
    .filter((e) => e.parent === table)
    .map((e) => `NOT EXISTS (SELECT 1 FROM ${qi(e.child)} r WHERE ${fkJoin(e)})`)
    .join(" AND ");
  const sql =
    `WITH gone AS (DELETE FROM ${qi(table)} p WHERE p.tenant_id = $1${guard ? ` AND ${guard}` : ""} RETURNING 1) ` +
    `SELECT count(*)::text AS n FROM gone`;
  const selfRef = edges.some((e) => e.parent === table && e.child === table);
  let total = 0;
  for (let pass = 0; pass < 64; pass++) {
    const { rows } = await client.query<{ n: string }>(sql, [tenantId]);
    const n = Number(rows[0]?.n ?? 0);
    total += n;
    if (n === 0 || !selfRef) break;
  }
  return total;
}

function tenantRowsOf(rows: SnapshotRow[] | undefined, tenantId: string): SnapshotRow[] {
  return (rows ?? []).filter((r) => r["tenant_id"] === tenantId);
}

async function buildTenantPreview(
  client: DbClient,
  snapshot: ValidSnapshot,
  tenantId: string,
  encrypted: boolean,
): Promise<{ preview: TenantRestorePreview; tables: string[]; edges: FkEdge[] }> {
  if (!TENANT_ID_RE.test(tenantId)) throw new Error("Invalid shop id");
  const tenantName = await liveTenantName(client, tenantId);
  const liveTables = await listLiveTables(client);
  const scoped = (await tenantScopedTables(client)).filter((t) => liveTables.has(t) && t in snapshot.data);
  const scopedSet = new Set(scoped);
  const edges = await fkEdges(client);

  const tables: TenantTableChange[] = [];
  for (const table of scoped) {
    tables.push({
      table,
      live: await countTenantRows(client, table, tenantId),
      snapshot: tenantRowsOf(snapshot.data[table], tenantId).length,
      pinned: await countPinnedRows(client, table, tenantId, edges, scopedSet),
    });
  }
  const totalLive = tables.reduce((n, t) => n + t.live, 0);
  const totalSnapshot = tables.reduce((n, t) => n + t.snapshot, 0);
  const totalPinned = tables.reduce((n, t) => n + t.pinned, 0);
  const { meta } = snapshot;
  return {
    tables: scoped,
    edges,
    preview: {
      tenantId,
      tenantName,
      backupDate: (meta["generatedAt"] as string | undefined) ?? (meta["date"] as string | undefined) ?? null,
      encrypted,
      tables,
      totalLive,
      totalSnapshot,
      totalPinned,
    },
  };
}

/** What a per-shop restore WOULD do — read-only. */
export async function previewTenantRestore(bytes: Buffer, tenantId: string, opts: RestoreOptions = {}): Promise<TenantRestorePreview> {
  const db = opts.pool ?? (pool as unknown as PoolLike);
  const snapshot = parseSnapshotBytes(bytes);
  const client = await db.connect();
  try {
    return (await buildTenantPreview(client, snapshot, tenantId, isEncryptedBackup(bytes))).preview;
  } finally {
    client.release();
  }
}

/**
 * Replace ONE shop's data with what the snapshot holds for it; every other
 * shop is untouched.
 *
 * Same rails as the full restore — safety backup first, one transaction,
 * FK-ordered — but scoped by tenant_id instead of TRUNCATE: the shop's rows
 * are deleted child-tables-first, then the snapshot's rows for that shop are
 * inserted parents-first. Vendor-owned tables (plan, logins, invoices) are
 * left alone; see TENANT_RESTORE_EXCLUDED_TABLES.
 *
 * Per-TABLE restore is deliberately not offered: bills, sale_items, payments
 * and products reference each other, and a table restored on its own either
 * fails its foreign keys or leaves sales pointing at products that no longer
 * match. A shop is the smallest unit whose books stay consistent.
 */
export async function restoreTenantSnapshot(
  bytes: Buffer,
  tenantId: string,
  opts: RestoreOptions = {},
): Promise<TenantRestoreSummary> {
  const db = opts.pool ?? (pool as unknown as PoolLike);
  const key = opts.source ?? "uploaded snapshot";
  if (opts.takeSafetyBackup && !opts.pool) {
    throw new Error("Refusing to skip the safety backup on the live database");
  }

  const snapshot = parseSnapshotBytes(bytes);

  /* Everything that can be checked without writing is checked BEFORE the
     safety backup, so a typo'd shop id does not cost a backup run. */
  const probe = await db.connect();
  let plan: { preview: TenantRestorePreview; tables: string[]; edges: FkEdge[] };
  try {
    plan = await buildTenantPreview(probe, snapshot, tenantId, isEncryptedBackup(bytes));
  } finally {
    probe.release();
  }
  if (plan.preview.totalSnapshot === 0) {
    throw new Error(
      `This backup holds no data for "${plan.preview.tenantName}" — restoring it would only empty the shop. Nothing was changed.`,
    );
  }

  const client = await db.connect();
  let inTransaction = false;
  try {
    const { edges } = plan;
    const deleteOrder = childFirstOrder(plan.tables, edges);
    const pks = await primaryKeys(client);

    await client.query("BEGIN");
    inTransaction = true;
    /* The shop's tables plus every table that can point INTO them: a row
       inserted elsewhere mid-restore could otherwise pin (or be cascaded
       away with) a parent the delete phase has already judged. */
    const scopedSet = new Set(plan.tables);
    await lockTablesForRestore(client, [
      ...plan.tables,
      ...edges.filter((e) => scopedSet.has(e.parent)).map((e) => e.child),
    ]);

    const safetyBackup = await takeSafetyBackup(opts);

    /* ── Delete phase: the shop's rows, children first, minus anything still
       referenced from outside the shop (those are overwritten below). ── */
    let rowsDeleted = 0;
    const pinnedIds = new Map<string, Set<string>>();
    for (const table of deleteOrder) {
      try {
        rowsDeleted += await clearTenantRows(client, table, tenantId, edges);
      } catch (err) {
        logger.error({ err, table, tenantId }, "per-shop restore: could not clear table");
        throw new Error(
          `Could not clear "${table}" for this shop (${err instanceof Error ? err.message : String(err)}). Nothing was changed.`,
        );
      }
      const pk = pks.get(table);
      if (!pk) continue;
      const { rows } = await client.query<Record<string, unknown>>(
        `SELECT ${pk.map(qi).join(", ")} FROM ${qi(table)} WHERE tenant_id = $1`, [tenantId],
      );
      if (rows.length > 0) pinnedIds.set(table, new Set(rows.map((r) => pk.map((c) => String(r[c])).join("\u0000"))));
    }

    /* ── Insert phase: snapshot rows, upserting over the pinned ones. Pinned
       rows go first within each table so a unique key they still hold (a
       SKU, say) is released before another row claims it. ── */
    let rowsKept = 0;
    let rowsKeptStale = 0;
    const toInsert: Record<string, SnapshotRow[]> = {};
    for (const table of plan.tables) {
      const rows = tenantRowsOf(snapshot.data[table], tenantId);
      const pinned = pinnedIds.get(table);
      const pk = pks.get(table);
      if (!pinned || !pk) { toInsert[table] = rows; continue; }
      const keyOf = (r: SnapshotRow) => pk.map((c) => String(r[c])).join("\u0000");
      const inSnapshot = new Set(rows.filter((r) => pinned.has(keyOf(r))).map(keyOf));
      rowsKept += pinned.size;
      rowsKeptStale += pinned.size - inSnapshot.size;
      toInsert[table] = [...rows].sort((a, b) => Number(pinned.has(keyOf(b))) - Number(pinned.has(keyOf(a))));
    }
    const rowsRestored = await insertTablesInDependencyOrder(client, toInsert, { tenantId, primaryKeys: pks });
    await resetSerialSequences(client, await listLiveTables(client));

    await client.query("COMMIT");
    inTransaction = false;
    logger.info(
      { key, tenantId, tables: plan.tables.length, rowsDeleted, rowsRestored, rowsKept, rowsKeptStale },
      "per-shop restore complete",
    );
    return { ...plan.preview, rowsDeleted, rowsRestored, rowsKept, rowsKeptStale, safetyBackup };
  } catch (err) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/* Minimal structural view of pg's PoolClient — pg itself is a lib/db
   dependency, so its types can't be imported here directly. */
interface DbClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Per-shop restores upsert: a row that survived the delete phase because
 *  something outside the shop still points at it is overwritten in place. The
 *  update is confined to rows that already belong to the shop, so a primary
 *  key that somehow collides with another shop's row is refused, never
 *  hijacked. */
interface UpsertScope {
  tenantId: string;
  primaryKeys: Map<string, string[]>;
}

/** Insert one table's snapshot rows in parameterized chunks. Only columns that
 *  still exist are written; json/jsonb columns are explicitly re-serialised so
 *  a JSON array value can't be mistaken for a Postgres array. */
async function insertTableRows(
  client: DbClient,
  table: string,
  rows: Record<string, unknown>[],
  upsert?: UpsertScope,
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

  const pk = upsert?.primaryKeys.get(table);
  const canUpsert = !!upsert && !!pk && pk.every((c) => cols.includes(c)) && cols.includes("tenant_id");
  const updatable = canUpsert ? cols.filter((c) => !pk!.includes(c)) : [];

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
    let sql = `INSERT INTO ${qi(table)} (${colSql}) VALUES ${tuples}`;
    if (canUpsert) {
      params.push(upsert!.tenantId);
      const own = `${qi(table)}.tenant_id = $${params.length}`;
      sql += updatable.length > 0
        ? ` ON CONFLICT (${pk!.map(qi).join(", ")}) DO UPDATE SET ${updatable.map((c) => `${qi(c)} = EXCLUDED.${qi(c)}`).join(", ")} WHERE ${own}`
        : ` ON CONFLICT (${pk!.map(qi).join(", ")}) DO NOTHING`;
      sql += " RETURNING 1";
    }
    const { rows: landed } = await client.query(sql, params);
    if (canUpsert && updatable.length > 0 && landed.length !== chunk.length) {
      throw new Error(
        `${chunk.length - landed.length} row(s) in "${table}" collide with rows that belong to another shop; refusing to overwrite them.`,
      );
    }
    inserted += chunk.length;
  }
  return inserted;
}
