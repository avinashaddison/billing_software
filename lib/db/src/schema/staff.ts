import { pgTable, text, uuid, boolean, timestamp, integer, unique, index } from "drizzle-orm/pg-core";

export const staffProfilesTable = pgTable(
  "staff_profiles",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    /**
     * Tenant the staff member belongs to. Single-tenant model — each staff
     * row belongs to exactly one business. NULL = legacy Hira & Sons staff
     * (still works during migration window via the OR-IS-NULL fallback).
     */
    tenantId:       text("tenant_id"),
    name:           text("name").notNull(),
    pin:            text("pin").notNull(),               // bcrypt hash — never plain text
    role:           text("role").notNull().default("staff"),
    isActive:       boolean("is_active").notNull().default(true),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil:    timestamp("locked_until", { withTimezone: true }),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_profiles_tenant_idx").on(table.tenantId),
  ],
);

export const staffPermissionsTable = pgTable(
  "staff_permissions",
  {
    id:       uuid("id").primaryKey().defaultRandom(),
    /**
     * Tenant the permission belongs to. Always equals
     * staffProfiles.tenantId — denormalised here so a runaway query
     * cannot leak permissions across tenants without an explicit join.
     */
    tenantId: text("tenant_id"),
    staffId:  uuid("staff_id").notNull().references(() => staffProfilesTable.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    level:    text("level").notNull().default("read"),    // "none" | "read" | "write"
  },
  (table) => [
    unique("staff_resource_unique").on(table.staffId, table.resource),
    index("staff_permissions_tenant_idx").on(table.tenantId),
  ],
);

export type StaffProfile    = typeof staffProfilesTable.$inferSelect;
export type StaffPermission = typeof staffPermissionsTable.$inferSelect;
