import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Single-row table that stores the operator-configurable shop settings
 * (store name, address, phone, GST, logo, terms, etc) so they survive
 * browser cache wipes and stay in sync across devices.
 *
 * Row is always id = 1 — the API uses an upsert so callers don't need
 * to know about the row id.
 */
export const storeSettingsTable = pgTable("store_settings", {
  id:        integer("id").primaryKey().notNull().default(1),
  data:      jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StoreSettingsRow = typeof storeSettingsTable.$inferSelect;
