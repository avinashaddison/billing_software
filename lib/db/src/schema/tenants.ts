import { pgTable, text, uuid, boolean, timestamp, index } from "drizzle-orm/pg-core";

/**
 * tenants — one row per business sharing this installation.
 *
 * Multi-tenant migration target. Existing Hira & Sons rows in all other
 * tables continue to use `tenant_id IS NULL` for backward compatibility
 * during the migration window (STRICT_TENANT=false).
 *
 * A NULL `tenant_id` in any other table is interpreted as "legacy Hira
 * & Sons data" and is always visible to every authenticated request as
 * a fallback. Once a tenant is added here and staff_profiles.tenant_id
 * is populated, that tenant's queries continue to see legacy NULL rows
 * until STRICT_TENANT is flipped on.
 */
export const tenantsTable = pgTable(
  "tenants",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    slug:      text("slug").notNull().unique(),
    name:      text("name").notNull(),
    isActive:  boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tenants_slug_idx").on(table.slug),
  ],
);

export type Tenant = typeof tenantsTable.$inferSelect;
