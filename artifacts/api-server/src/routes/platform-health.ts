/**
 * "Is everything OK?" — one page of facts about the running system.
 *
 * Deliberately limited to things that are genuinely measurable from here.
 * There is no error-rate table in this app, so this does not invent one;
 * backup freshness is read by the panel from the existing backups endpoint
 * rather than duplicated here.
 */

import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, pool, tenantsTable, authSessionsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/platform-admin";

const router: IRouter = Router();

router.get("/platform/health", requirePlatformAdmin, async (_req, res): Promise<void> => {
  try {
    const [dbInfo, tableRows, connRows, migrationRows] = await Promise.all([
      pool.query<{ size: string; pretty: string; name: string }>(
        `SELECT pg_database_size(current_database())::text AS size,
                pg_size_pretty(pg_database_size(current_database())) AS pretty,
                current_database() AS name`,
      ),
      pool.query<{ table_name: string; pretty: string; bytes: string; row_estimate: string }>(
        `SELECT c.relname                                   AS table_name,
                pg_size_pretty(pg_total_relation_size(c.oid)) AS pretty,
                pg_total_relation_size(c.oid)::text           AS bytes,
                c.reltuples::bigint::text                     AS row_estimate
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND n.nspname = 'public'
          ORDER BY pg_total_relation_size(c.oid) DESC
          LIMIT 12`,
      ),
      pool.query<{ total: string; active: string }>(
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE state = 'active')::text AS active
           FROM pg_stat_activity
          WHERE datname = current_database()`,
      ),
      pool.query<{ count: string; latest: string | null }>(
        `SELECT count(*)::text AS count, max(name) AS latest FROM _migrations`,
      ).catch(() => ({ rows: [{ count: "0", latest: null }] })),
    ]);

    const [shops] = await db
      .select({
        total:      sql<number>`(count(*))::int`,
        active:     sql<number>`(count(*) filter (where ${tenantsTable.isActive} and (${tenantsTable.expiresAt} is null or ${tenantsTable.expiresAt} >= now())))::int`,
        suspended:  sql<number>`(count(*) filter (where not ${tenantsTable.isActive}))::int`,
        expired:    sql<number>`(count(*) filter (where ${tenantsTable.expiresAt} is not null and ${tenantsTable.expiresAt} < now()))::int`,
        expiring7d: sql<number>`(count(*) filter (where ${tenantsTable.expiresAt} is not null and ${tenantsTable.expiresAt} >= now() and ${tenantsTable.expiresAt} < now() + interval '7 days'))::int`,
        lifetime:   sql<number>`(count(*) filter (where ${tenantsTable.expiresAt} is null))::int`,
      })
      .from(tenantsTable);

    const [sessions] = await db
      .select({
        live:      sql<number>`(count(*) filter (where ${authSessionsTable.revokedAt} is null and ${authSessionsTable.lastSeenAt} > now() - interval '30 days'))::int`,
        activeDay: sql<number>`(count(*) filter (where ${authSessionsTable.revokedAt} is null and ${authSessionsTable.lastSeenAt} > now() - interval '24 hours'))::int`,
        revoked:   sql<number>`(count(*) filter (where ${authSessionsTable.revokedAt} is not null))::int`,
      })
      .from(authSessionsTable);

    const mem = process.memoryUsage();
    res.json({
      database: {
        name:        dbInfo.rows[0]?.name ?? "unknown",
        sizeBytes:   Number(dbInfo.rows[0]?.size ?? 0),
        sizePretty:  dbInfo.rows[0]?.pretty ?? "—",
        connections: {
          total:  Number(connRows.rows[0]?.total ?? 0),
          active: Number(connRows.rows[0]?.active ?? 0),
        },
        migrations: {
          applied: Number(migrationRows.rows[0]?.count ?? 0),
          latest:  migrationRows.rows[0]?.latest ?? null,
        },
        biggestTables: tableRows.rows.map((t) => ({
          name:         t.table_name,
          sizePretty:   t.pretty,
          sizeBytes:    Number(t.bytes),
          /* Planner estimate, not an exact count — exact counts on every table
             would mean a full scan of the whole database on each page load. */
          rowEstimate:  Math.max(0, Number(t.row_estimate)),
        })),
      },
      shops,
      sessions,
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion:   process.version,
        env:           process.env.NODE_ENV ?? "development",
        memory: {
          rssBytes:       mem.rss,
          heapUsedBytes:  mem.heapUsed,
          heapTotalBytes: mem.heapTotal,
        },
      },
      checkedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Failed to read system health" });
  }
});

export default router;
