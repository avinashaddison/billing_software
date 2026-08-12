import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * A notice the vendor shows inside the shop app.
 *
 * `tenantId === null` means every shop sees it; otherwise it is scoped to one
 * shop. The optional `startsAt`/`endsAt` window is evaluated in SQL when the
 * shop app asks for its notices, so a time-limited notice disappears on its
 * own without anyone having to switch it off.
 *
 * The `level` whitelist is enforced by a CHECK constraint in migration 0017.
 */
export const announcementsTable = pgTable("announcements", {
  id:             uuid("id").primaryKey().defaultRandom(),
  tenantId:       text("tenant_id"),
  title:          text("title").notNull(),
  body:           text("body").notNull(),
  level:          text("level").notNull().default("info"),
  isActive:       boolean("is_active").notNull().default(true),
  startsAt:       timestamp("starts_at", { withTimezone: true }),
  endsAt:         timestamp("ends_at", { withTimezone: true }),
  createdByEmail: text("created_by_email"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AnnouncementRow = typeof announcementsTable.$inferSelect;
export type AnnouncementLevel = "info" | "warning" | "critical";
