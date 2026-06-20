/**
 * Tenant-scoping helpers used by every route.
 *
 * Default rule (STRICT tenant isolation):
 *
 *   WHERE tenant_id = req.tenantId   — for a real tenant
 *   WHERE tenant_id IS NULL          — for the legacy null-tenant owner
 *
 * A real tenant only ever sees its OWN rows. The legacy null-tenant owner
 * (and any staff created under it) only ever sees the legacy NULL rows.
 * This prevents legacy Hira & Sons rows from leaking into newly created
 * shops (the "new shop already shows products / bills appear under another
 * account" class of bug).
 *
 * The old migration-window fallback (real tenants ALSO see legacy NULL rows)
 * is now OPT-IN: set STRICT_TENANT=false to temporarily restore it while
 * backfilling un-migrated legacy rows.
 */
import { or, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Tenant-isolation switch. Strict isolation is now the DEFAULT.
 *
 *   strict (default)     → reads use `tenant_id = :tenantId`
 *   STRICT_TENANT=false  → reads use `tenant_id = :tenantId OR tenant_id IS NULL`
 *
 * The opt-out exists only to temporarily re-expose un-backfilled legacy NULL
 * rows during a migration. A null-tenant caller ALWAYS scopes to
 * `tenant_id IS NULL` regardless of this flag, so the legacy owner is never
 * locked out of its own data.
 *
 * Read via env each call — flipping the env var on a running server takes
 * effect on the next request without redeploy.
 */
export function strictTenantEnabled(): boolean {
  return process.env["STRICT_TENANT"] !== "false";
}

/**
 * Build a WHERE clause that scopes a query to the current tenant.
 *
 * - tenantId = null  → only legacy NULL rows are matched (admin / pre-login).
 * - STRICT_TENANT=false → `tenant_id = :tenantId OR tenant_id IS NULL`.
 * - STRICT_TENANT=true  → strict `tenant_id = :tenantId`.
 *
 * Always returns an SQL fragment (never undefined) so callers can compose
 * with `and()` safely.
 */
export function tenantWhere(
  column: PgColumn,
  tenantId: string | null | undefined,
): SQL {
  if (tenantId == null) {
    return isNull(column) as SQL;
  }
  if (strictTenantEnabled()) {
    return eq(column, tenantId);
  }
  // Migration mode: include legacy NULL rows.
  return or(eq(column, tenantId), isNull(column)) as SQL;
}

/**
 * WHERE clause for MUTATIONS (UPDATE / DELETE and the lookups that gate them).
 *
 * Unlike `tenantWhere`, this NEVER includes the legacy `IS NULL` fallback for a
 * non-null tenant — regardless of STRICT_TENANT. A real tenant must only ever
 * touch its OWN rows; it must not be able to update or delete legacy
 * null-tenant rows or another tenant's rows. The null-tenant session (legacy
 * Hira & Sons / admin) still scopes to `IS NULL`, so legacy data stays
 * editable by its rightful owner.
 *
 * - tenantId == null  → `tenant_id IS NULL`     (legacy / admin session)
 * - tenantId != null  → `tenant_id = :tenantId` (strict, no NULL fallback)
 */
export function tenantWhereWrite(
  column: PgColumn,
  tenantId: string | null | undefined,
): SQL {
  if (tenantId == null) {
    return isNull(column) as SQL;
  }
  return eq(column, tenantId);
}
