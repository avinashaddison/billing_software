import { pgTable, integer, timestamp, text } from "drizzle-orm/pg-core";

/**
 * Single-row table that records when this installation was first booted.
 * Used to compute the 14-day trial window when no LICENSE_KEY is configured.
 *
 * Row is always id = 1. The DB-side default keeps old installs working even
 * if migrations have not run (the row is upserted on first server boot).
 */
export const licenseStatusTable = pgTable("license_status", {
  id:          integer("id").primaryKey().notNull().default(1),
  firstBootAt: timestamp("first_boot_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Last license key seen (for diagnostics, never used for verification) */
  lastKeyHash: text("last_key_hash"),
  /** License key set via the in-app UI. Takes precedence over LICENSE_KEY env. */
  keyOverride: text("key_override"),
  /** When the in-app key was last updated */
  keyUpdatedAt: timestamp("key_updated_at", { withTimezone: true }),
});

export type LicenseStatusRow = typeof licenseStatusTable.$inferSelect;
