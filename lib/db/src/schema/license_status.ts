import { pgTable, integer, timestamp, text, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Per-tenant license / trial tracking.
 *
 * Legacy singleton: the existing row uses `id = 1` and `tenant_id IS NULL`
 * — this is the Hira & Sons license row and the migration leaves it
 * untouched. For new tenants the route inserts a new row with its own
 * `id` and the tenant's UUID; uniqueness per tenant is enforced by a
 * partial unique index. The `id` column remains the PK to preserve
 * backward compat with any code still hard-coding `WHERE id = 1`.
 */
export const licenseStatusTable = pgTable(
  "license_status",
  {
    id:          integer("id").primaryKey().notNull().default(1),
    /** Tenant owner. NULL = legacy Hira & Sons singleton row. */
    tenantId:    uuid("tenant_id"),
    firstBootAt: timestamp("first_boot_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Last license key seen (for diagnostics, never used for verification) */
    lastKeyHash: text("last_key_hash"),
    /** License key set via the in-app UI. Takes precedence over LICENSE_KEY env. */
    keyOverride: text("key_override"),
    /** When the in-app key was last updated */
    keyUpdatedAt: timestamp("key_updated_at", { withTimezone: true }),
  },
  (table) => [
    /** One row per real tenant. NULL rows are not constrained (legacy). */
    uniqueIndex("license_status_tenant_unique")
      .on(table.tenantId)
      .where(sql`${table.tenantId} IS NOT NULL`),
  ],
);

export type LicenseStatusRow = typeof licenseStatusTable.$inferSelect;
