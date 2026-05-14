import { pgTable, integer, jsonb, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Per-tenant operator-configurable shop settings (store name, address,
 * phone, GST, logo, terms, …).
 *
 * Legacy singleton: the existing row uses `id = 1` and `tenant_id IS NULL`
 * — this is the Hira & Sons row and the migration leaves it untouched.
 * For new tenants, the route inserts a new row with its own `id` and the
 * tenant's UUID; uniqueness per tenant is enforced by a partial unique
 * index. The `id` column remains the PK to preserve backward compat with
 * any code still hard-coding `WHERE id = 1`.
 */
export const storeSettingsTable = pgTable(
  "store_settings",
  {
    id:        integer("id").primaryKey().notNull().default(1),
    /** Tenant owner. NULL = legacy Hira & Sons singleton row. */
    tenantId:  uuid("tenant_id"),
    data:      jsonb("data").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /** One row per real tenant. NULL rows are not constrained (legacy). */
    uniqueIndex("store_settings_tenant_unique")
      .on(table.tenantId)
      .where(sql`${table.tenantId} IS NOT NULL`),
  ],
);

export type StoreSettingsRow = typeof storeSettingsTable.$inferSelect;
