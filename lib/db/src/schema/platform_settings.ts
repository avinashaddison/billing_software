import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Global, platform-wide settings — a single-row store (id = 1) shared across
 * ALL tenants. Unlike `store_settings` (one row per tenant), this holds
 * vendor-level config that isn't scoped to any shop.
 *
 * Currently it holds the public subscription pricing shown on the marketing
 * landing page (deal price + struck-through original), editable by the vendor
 * from /admin and read by the public `/api/public/pricing` endpoint. Kept as a
 * `jsonb` blob so new global keys can be added without a migration each time.
 */
export const platformSettingsTable = pgTable("platform_settings", {
  id:        integer("id").primaryKey().notNull().default(1),
  data:      jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PlatformSettingsRow = typeof platformSettingsTable.$inferSelect;
