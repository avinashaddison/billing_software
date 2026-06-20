/**
 * Tenant-scoping helpers used by every route in the multi-tenant migration.
 *
 * Rule (per migration spec):
 *
 *   WHERE tenant_id = req.tenantId OR tenant_id IS NULL
 *
 * The IS-NULL fallback is required during the migration window so legacy
 * Hira & Sons rows (which have not been backfilled yet) remain visible to
 * authenticated users. Flip STRICT_TENANT=true to drop the fallback once
 * every row has been backfilled and verified.
 */
import { or, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Migration switch. While `false` (default), reads use
 *   tenant_id = :tenantId OR tenant_id IS NULL
 * Once flipped to `true`, the IS-NULL fallback is removed so no tenant
 * can see another tenant's rows AND legacy null-tenant rows are hidden
 * from non-admin requests.
 *
 * Read via env each call — flipping the env var on a running server
 * takes effect on the next request without redeploy.
 */
export function strictTenantEnabled(): boolean {
  return process.env["STRICT_TENANT"] === "true";
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
