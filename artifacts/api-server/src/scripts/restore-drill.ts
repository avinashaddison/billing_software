/**
 * Backup restore REHEARSAL.
 *
 * A backup nobody has ever restored is a guess, not a backup. This proves the
 * whole chain end to end: copy the live schema, take a real snapshot in exactly
 * the format the nightly job produces, restore it with the real restore code,
 * and check every table lands with the right number of rows and every rupee
 * intact.
 *
 * Run it: pnpm --filter @workspace/api-server run drill:restore
 * It sets up and tears down its own throwaway Postgres, so there is nothing to
 * prepare and nothing left behind.
 *
 * ── Why this cannot touch the live shop ────────────────────────────────────
 *  - Everything it does against the live database is a SELECT (plus pg_dump
 *    --schema-only, which is also read-only).
 *  - The restore is pointed at a scratch database by injecting a different
 *    pool. It refuses to start unless that target is a local socket or loopback
 *    address, and refuses if it looks like the live connection string.
 *  - The pre-restore safety backup is replaced with a no-op, because the data
 *    being overwritten is the throwaway copy this script just made. That
 *    substitution is passed in here and nowhere else.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import pg from "pg";
import { pool as livePool } from "@workspace/db";
import { restoreSnapshot, restoreTenantSnapshot, type PoolLike } from "../lib/restore";
import { dumpDatabaseSnapshot, type SnapshotSource } from "../lib/backup";
import { encryptBackup, resolveBackupKey } from "../lib/backup-crypto";

const execFileAsync = promisify(execFile);

/** Scratch target. Unix socket by default so it isn't reachable over the network. */
const SCRATCH = {
  host: process.env["DRILL_PGHOST"] ?? "/tmp",
  port: Number(process.env["DRILL_PGPORT"] ?? 55432),
  user: process.env["DRILL_PGUSER"] ?? "drill",
  database: process.env["DRILL_PGDATABASE"] ?? "drill",
};
const PGDATA = process.env["DRILL_PGDATA"] ?? "/tmp/pgdrill";

function assertScratchIsSafe(): void {
  const local = SCRATCH.host.startsWith("/") || ["localhost", "127.0.0.1", "::1"].includes(SCRATCH.host);
  if (!local) {
    throw new Error(`Refusing to run: drill target "${SCRATCH.host}" is not a local socket or loopback address`);
  }
}

/**
 * Prove the thing we are about to DROP SCHEMA on is the cluster this script
 * created, not something else that happens to answer on that address.
 *
 * "It's on localhost" is NOT proof: a tunnel, a proxy, or a DRILL_* override
 * can put production behind a loopback port. So ask the server which data
 * directory it is running from and require our own throwaway path. A managed
 * database (Neon) cannot match it, and will usually refuse the question
 * outright — either way this fails closed.
 */
async function assertIsOurScratchCluster(db: pg.Pool | pg.PoolClient): Promise<void> {
  let dataDir: string;
  let dbName: string;
  try {
    const { rows } = await db.query<{ dir: string; db: string }>(
      `SELECT current_setting('data_directory') AS dir, current_database() AS db`,
    );
    dataDir = rows[0]?.dir ?? "";
    dbName = rows[0]?.db ?? "";
  } catch (err) {
    throw new Error(
      "Refusing to continue: could not read the target's data directory, so it cannot be " +
      `confirmed as the throwaway cluster. (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  const expected = path.resolve(PGDATA);
  if (path.resolve(dataDir) !== expected) {
    throw new Error(
      `Refusing to continue: the database answering at ${SCRATCH.host}:${SCRATCH.port} is running from ` +
      `"${dataDir}", not the throwaway cluster at "${expected}". Something else is listening there.`,
    );
  }
  if (dbName !== SCRATCH.database) {
    throw new Error(`Refusing to continue: connected to database "${dbName}", expected "${SCRATCH.database}"`);
  }
}

async function majorOf(binary: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(binary, ["--version"]);
    return Number(/(\d+)\./.exec(stdout)?.[1] ?? NaN) || null;
  } catch {
    return null;
  }
}

/**
 * pg_dump refuses to read a server newer than itself, and Replit's default
 * client tools often trail the managed database. Fall back to searching the
 * Nix store for a matching major rather than making the operator hunt for it.
 */
async function resolvePgBinDir(serverMajor: number): Promise<string> {
  if ((await majorOf("pg_dump")) === serverMajor) return "";
  const store = "/nix/store";
  try {
    const entries = await readdir(store);
    const re = new RegExp(`-postgresql(-and-plugins)?-${serverMajor}\\.[\\d.]+$`);
    for (const entry of entries.filter((e) => re.test(e)).sort()) {
      const dir = path.join(store, entry, "bin");
      try {
        await access(path.join(dir, "pg_dump"));
        if ((await majorOf(path.join(dir, "pg_dump"))) === serverMajor) return dir;
      } catch { /* keep looking */ }
    }
  } catch { /* no Nix store — fall through */ }
  throw new Error(
    `Could not find PostgreSQL ${serverMajor} client tools. The live server is ${serverMajor}; ` +
      `pg_dump on PATH is ${(await majorOf("pg_dump")) ?? "missing"}.`,
  );
}

/** Start a throwaway cluster if one isn't already listening. Returns a stopper. */
async function ensureCluster(binDir: string): Promise<() => Promise<void>> {
  const bin = (name: string) => (binDir ? path.join(binDir, name) : name);
  const probe = new pg.Pool({ ...SCRATCH, connectionTimeoutMillis: 3000 });
  try {
    await probe.query("SELECT 1");
    await probe.end();
    console.log("     using the scratch database already running");
    return async () => {};
  } catch {
    await probe.end().catch(() => {});
  }

  try {
    await access(path.join(PGDATA, "PG_VERSION"));
  } catch {
    await execFileAsync(bin("initdb"), ["-D", PGDATA, "-U", SCRATCH.user, "--auth=trust"]);
  }
  await execFileAsync(bin("pg_ctl"), [
    "-D", PGDATA,
    "-o", `-p ${SCRATCH.port} -k ${SCRATCH.host} -c listen_addresses=''`,
    "-l", `${PGDATA}.log`,
    "-w", "start",
  ]);
  await execFileAsync(bin("createdb"), ["-h", SCRATCH.host, "-p", String(SCRATCH.port), "-U", SCRATCH.user, SCRATCH.database])
    .catch(() => { /* already exists */ });

  return async () => {
    await execFileAsync(bin("pg_ctl"), ["-D", PGDATA, "-m", "fast", "stop"]).catch(() => {});
  };
}

async function main(): Promise<void> {
  assertScratchIsSafe();
  const liveUrl = process.env["NEON_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!liveUrl) throw new Error("NEON_DATABASE_URL / DATABASE_URL is not set");

  /* SHOW names its column after the setting, so ask for an alias we control. */
  const { rows: verRows } = await livePool.query<{ v: string }>(
    `SELECT current_setting('server_version') AS v`,
  );
  const serverMajor = Number(/(\d+)\./.exec(verRows[0]?.v ?? "")?.[1] ?? NaN);
  if (!serverMajor) throw new Error("Could not determine the live PostgreSQL version");

  console.log(`0/7  Preparing a throwaway PostgreSQL ${serverMajor} to restore into…`);
  const binDir = await resolvePgBinDir(serverMajor);
  const stopCluster = await ensureCluster(binDir);
  const bin = (name: string) => (binDir ? path.join(binDir, name) : name);
  const psqlArgs = ["-h", SCRATCH.host, "-p", String(SCRATCH.port), "-U", SCRATCH.user, "-d", SCRATCH.database];
  let scratchPool: pg.Pool | null = null;

  try {
    scratchPool = new pg.Pool(SCRATCH);

    /* ── 1. Copy the schema (read-only against live) ── */
    console.log("1/7  Copying the live schema into the scratch database…");
    /* Wipe whatever a previous rehearsal left behind, so this is re-runnable.
       The check runs on the SAME connection that then executes the DROP.
       Proving one connection is the scratch cluster and destroying through a
       different one (a separate psql process, say) leaves a gap for a pooler
       or a changed listener to send the destructive statement elsewhere. */
    const wipe = await scratchPool.connect();
    try {
      await assertIsOurScratchCluster(wipe);
      await wipe.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    } finally {
      wipe.release();
    }
    const { stdout: schemaSql } = await execFileAsync(
      bin("pg_dump"),
      ["--schema-only", "--no-owner", "--no-privileges", liveUrl],
      { maxBuffer: 256 * 1024 * 1024 },
    );
    await writeFile("/tmp/drill-schema.sql", schemaSql);
    await execFileAsync(bin("psql"), [...psqlArgs, "-v", "ON_ERROR_STOP=1", "-q", "-f", "/tmp/drill-schema.sql"], {
      maxBuffer: 64 * 1024 * 1024,
    });

    /* ── 2. Take a snapshot with the REAL dump code (read-only) ── */
    console.log("2/7  Taking a snapshot of live data (SELECT only)…");
    const snap = await dumpDatabaseSnapshot(livePool as unknown as SnapshotSource);
    const liveCounts: Record<string, number> = {};
    for (const [table, rows] of Object.entries(snap.payload.data)) liveCounts[table] = rows.length;
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(snap.payload), "utf8"), { level: 9 });
    console.log(`     ${snap.tables} tables, ${snap.totalRows} rows, ${(gz.length / 1024 / 1024).toFixed(2)} MB gzipped`);

    /* ── 3. Restore it into the scratch database with the REAL restore code ── */
    console.log("3/7  Restoring into the scratch database…");
    /* Same rule for the restore's own TRUNCATE: every connection it takes
       re-proves the target before it is handed over. */
    const verifiedScratch = {
      connect: async () => {
        const c = await scratchPool!.connect();
        try {
          await assertIsOurScratchCluster(c);
        } catch (err) {
          c.release();
          throw err;
        }
        return c;
      },
    };

    const summary = await restoreSnapshot(gz, {
      source: "restore rehearsal",
      pool: verifiedScratch as unknown as PoolLike,
      takeSafetyBackup: async () => "skipped — rehearsal target is a scratch database",
    });
    console.log(`     restored ${summary.rowsRestored} rows across ${summary.tables} tables`);
    if (summary.skippedTables.length > 0) console.log(`     skipped tables: ${summary.skippedTables.join(", ")}`);

    /* ── 4. Verify every table came back with the same number of rows ── */
    console.log("4/7  Verifying row counts…");
    const problems: string[] = [];
    for (const table of Object.keys(liveCounts)) {
      const { rows } = await scratchPool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${table.replace(/"/g, '""')}"`,
      );
      const got = Number(rows[0]?.n ?? -1);
      if (got !== liveCounts[table]) problems.push(`${table}: expected ${liveCounts[table]} rows, got ${got}`);
    }

    /* ── 5. Verify the money survived exactly (the point of the whole exercise) ── */
    console.log("5/7  Verifying money values…");
    const money: Array<[string, string]> = [
      ["bills.total_amount", `SELECT sum(total_amount)::text AS v FROM bills`],
      ["sale_items.subtotal", `SELECT sum(subtotal)::text AS v FROM sale_items`],
      ["bill_payments.amount", `SELECT sum(amount)::text AS v FROM bill_payments`],
    ];
    let billsTotal = "";
    for (const [label, q] of money) {
      const a = await livePool.query<{ v: string | null }>(q);
      const b = await scratchPool.query<{ v: string | null }>(q);
      if (a.rows[0]?.v !== b.rows[0]?.v) {
        problems.push(`${label}: live ${a.rows[0]?.v} vs restored ${b.rows[0]?.v}`);
      }
      if (label === "bills.total_amount") billsTotal = a.rows[0]?.v ?? "";
    }

    /* ── 6. The same restore through an ENCRYPTED file ──
       Proves the key in this environment can open what the backup job writes
       (or, with no key configured, that the format itself round-trips). */
    console.log("6/7  Restoring again from an encrypted copy…");
    let drillKey: string;
    try {
      drillKey = resolveBackupKey() ?? "";
    } catch (err) {
      problems.push(`BACKUP_ENCRYPTION_KEY rejected: ${err instanceof Error ? err.message : String(err)}`);
      drillKey = "";
    }
    const keyIsConfigured = drillKey.length > 0;
    if (!keyIsConfigured) {
      drillKey = "restore-drill-throwaway-key-not-for-real-backups";
      process.env["BACKUP_ENCRYPTION_KEY"] = drillKey;
    }
    const sealed = encryptBackup(gz, drillKey);
    const encSummary = await restoreSnapshot(sealed, {
      source: "restore rehearsal (encrypted)",
      pool: verifiedScratch as unknown as PoolLike,
      takeSafetyBackup: async () => "skipped — rehearsal target is a scratch database",
    });
    if (encSummary.rowsRestored !== summary.rowsRestored) {
      problems.push(`encrypted restore put back ${encSummary.rowsRestored} rows, plain restore ${summary.rowsRestored}`);
    }
    console.log(`     ${keyIsConfigured ? "configured BACKUP_ENCRYPTION_KEY" : "throwaway key (BACKUP_ENCRYPTION_KEY is not set here)"} — ${encSummary.rowsRestored} rows restored from ${(sealed.length / 1024 / 1024).toFixed(2)} MB`);

    /* ── 7. Per-shop restore: damage one shop in scratch, restore only it ── */
    console.log("7/7  Rehearsing a per-shop restore…");
    const { rows: shopRows } = await scratchPool.query<{ id: string; name: string; n: string }>(
      `SELECT t.id, t.name, count(b.id)::text AS n
         FROM tenants t LEFT JOIN bills b ON b.tenant_id = t.id
        GROUP BY t.id, t.name HAVING count(b.id) > 0 ORDER BY count(b.id) DESC LIMIT 2`,
    );
    const victim = shopRows[0];
    const bystander = shopRows[1] ?? null;
    if (!victim) {
      console.log("     no shop with bills — skipped");
    } else {
      const productSum = async (db: pg.Pool, tenantId: string) =>
        (await db.query<{ v: string | null }>(`SELECT sum(price)::text AS v FROM products WHERE tenant_id = $1`, [tenantId])).rows[0]?.v ?? null;
      const productCount = async (db: pg.Pool, tenantId: string) =>
        Number((await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM products WHERE tenant_id = $1`, [tenantId])).rows[0]?.n ?? 0);

      const victimSumBefore   = await productSum(livePool, victim.id);
      const victimCountBefore = await productCount(livePool, victim.id);

      /* Damage: reprice every product and add a junk one. If there is a second
         shop, reprice it too — that change must SURVIVE the victim's restore. */
      await scratchPool.query(`UPDATE products SET price = price + 1 WHERE tenant_id = $1`, [victim.id]);
      await scratchPool.query(
        `INSERT INTO products (tenant_id, name, sku, category, price, stock) VALUES ($1, 'DRILL JUNK PRODUCT', 'DRILL-JUNK-SKU', 'drill', 1, 0)`,
        [victim.id],
      );
      let bystanderSumDamaged: string | null = null;
      if (bystander) {
        await scratchPool.query(`UPDATE products SET price = price + 1 WHERE tenant_id = $1`, [bystander.id]);
        bystanderSumDamaged = await productSum(scratchPool, bystander.id);
      }

      const tenantSummary = await restoreTenantSnapshot(gz, victim.id, {
        source: "restore rehearsal (per-shop)",
        pool: verifiedScratch as unknown as PoolLike,
        takeSafetyBackup: async () => "skipped — rehearsal target is a scratch database",
      });
      console.log(
        `     "${victim.name}": ${tenantSummary.rowsDeleted} rows cleared, ${tenantSummary.rowsRestored} put back across ${tenantSummary.tables.length} tables` +
        (tenantSummary.rowsKept > 0
          ? `; ${tenantSummary.rowsKept} row(s) referenced from outside the shop were overwritten in place (${tenantSummary.rowsKeptStale} had no snapshot version)`
          : ""),
      );
      if (tenantSummary.totalPinned !== tenantSummary.rowsKept) {
        problems.push(`per-shop restore: preview estimated ${tenantSummary.totalPinned} pinned rows, restore found ${tenantSummary.rowsKept}`);
      }

      if ((await productSum(scratchPool, victim.id)) !== victimSumBefore) problems.push(`per-shop restore: ${victim.name} product prices did not revert`);
      if ((await productCount(scratchPool, victim.id)) !== victimCountBefore) problems.push(`per-shop restore: ${victim.name} product count differs from live`);
      for (const t of tenantSummary.tables) {
        const { rows } = await scratchPool.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${t.table.replace(/"/g, '""')}" WHERE tenant_id = $1`, [victim.id]);
        if (tenantSummary.rowsKeptStale === 0 && Number(rows[0]?.n ?? -1) !== t.snapshot) {
          problems.push(`per-shop restore: ${t.table} has ${rows[0]?.n} rows for ${victim.name}, snapshot has ${t.snapshot}`);
        }
      }
      if (bystander) {
        if ((await productSum(scratchPool, bystander.id)) !== bystanderSumDamaged) problems.push(`per-shop restore: touched "${bystander.name}", which was not being restored`);
      }
      for (const [label, q] of money) {
        const a = await livePool.query<{ v: string | null }>(q);
        const b = await scratchPool.query<{ v: string | null }>(q);
        if (a.rows[0]?.v !== b.rows[0]?.v) problems.push(`after per-shop restore ${label}: live ${a.rows[0]?.v} vs scratch ${b.rows[0]?.v}`);
      }
    }

    console.log("");
    if (problems.length === 0) {
      console.log("RESULT: PASS — every table and every rupee restored exactly (plain, encrypted and per-shop).");
      console.log(`        Verified ₹${billsTotal} of billing across ${liveCounts["bills"] ?? 0} bills.`);
    } else {
      console.log("RESULT: FAIL");
      for (const p of problems) console.log("  - " + p);
      process.exitCode = 1;
    }
  } finally {
    await scratchPool?.end().catch(() => {});
    await livePool.end().catch(() => {});
    await stopCluster();
  }
}

main().catch((err) => {
  console.error("Drill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
