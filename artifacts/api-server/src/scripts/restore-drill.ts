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
import { restoreSnapshot, type PoolLike } from "../lib/restore";

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

  console.log(`0/5  Preparing a throwaway PostgreSQL ${serverMajor} to restore into…`);
  const binDir = await resolvePgBinDir(serverMajor);
  const stopCluster = await ensureCluster(binDir);
  const bin = (name: string) => (binDir ? path.join(binDir, name) : name);
  const psqlArgs = ["-h", SCRATCH.host, "-p", String(SCRATCH.port), "-U", SCRATCH.user, "-d", SCRATCH.database];
  let scratchPool: pg.Pool | null = null;

  try {
    scratchPool = new pg.Pool(SCRATCH);

    /* ── 1. Copy the schema (read-only against live) ── */
    console.log("1/5  Copying the live schema into the scratch database…");
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

    /* ── 2. Take a snapshot in the nightly backup's format (read-only) ── */
    console.log("2/5  Taking a snapshot of live data (SELECT only)…");
    const { rows: tableRows } = await livePool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const data: Record<string, unknown[]> = {};
    const liveCounts: Record<string, number> = {};
    let totalRows = 0;
    for (const { tablename } of tableRows) {
      const { rows } = await livePool.query(`SELECT * FROM "${tablename.replace(/"/g, '""')}"`);
      data[tablename] = rows;
      liveCounts[tablename] = rows.length;
      totalRows += rows.length;
    }
    const payload = {
      meta: {
        app: "addisonbill",
        format: "json-snapshot-v1",
        generatedAt: new Date().toISOString(),
        tables: tableRows.length,
        totalRows,
      },
      data,
    };
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 });
    console.log(`     ${tableRows.length} tables, ${totalRows} rows, ${(gz.length / 1024 / 1024).toFixed(2)} MB gzipped`);

    /* ── 3. Restore it into the scratch database with the REAL restore code ── */
    console.log("3/5  Restoring into the scratch database…");
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
    console.log("4/5  Verifying row counts…");
    const problems: string[] = [];
    for (const table of Object.keys(liveCounts)) {
      const { rows } = await scratchPool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${table.replace(/"/g, '""')}"`,
      );
      const got = Number(rows[0]?.n ?? -1);
      if (got !== liveCounts[table]) problems.push(`${table}: expected ${liveCounts[table]} rows, got ${got}`);
    }

    /* ── 5. Verify the money survived exactly (the point of the whole exercise) ── */
    console.log("5/5  Verifying money values…");
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

    console.log("");
    if (problems.length === 0) {
      console.log("RESULT: PASS — every table and every rupee restored exactly.");
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
