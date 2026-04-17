import { pgTable, text, uuid, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const staffProfilesTable = pgTable("staff_profiles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  pin:       text("pin").notNull(),
  role:      text("role").notNull().default("staff"),   // "owner" | "staff"
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffPermissionsTable = pgTable("staff_permissions", {
  id:       uuid("id").primaryKey().defaultRandom(),
  staffId:  uuid("staff_id").notNull().references(() => staffProfilesTable.id, { onDelete: "cascade" }),
  resource: text("resource").notNull(),
  level:    text("level").notNull().default("read"),    // "none" | "read" | "write"
}, (table) => [
  unique("staff_resource_unique").on(table.staffId, table.resource),
]);

export type StaffProfile    = typeof staffProfilesTable.$inferSelect;
export type StaffPermission = typeof staffPermissionsTable.$inferSelect;
