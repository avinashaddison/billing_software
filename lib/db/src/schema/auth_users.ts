import { pgTable, text, uuid, boolean, timestamp, index } from "drizzle-orm/pg-core";

/**
 * auth_users — modern email/password SaaS login.
 *
 * Lives ALONGSIDE the existing `staff_profiles` table:
 *   - `staff_profiles` keeps powering the POS staffId + PIN flow
 *     (cashier shortcut, browser/device login, legacy Hira & Sons compat).
 *   - `auth_users` powers the cloud / browser email-password login, the
 *     vendor admin panel, and per-tenant owner/admin accounts.
 *
 * The two tables are intentionally independent — a single human can have
 * a row in both (e.g. an owner with both an email login for the cloud
 * dashboard AND a PIN for fast POS access). The signed session cookie
 * carries a `kind` discriminator (`"pin"` or `"email"`) so the rest of
 * the app knows which table to look the session up against.
 *
 * `tenant_id` is `text NULL` to match the rest of the live schema and
 * preserve legacy/Hira NULL-tenant compatibility during migration.
 */
export const authUsersTable = pgTable(
  "auth_users",
  {
    id:                    uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy/Hira & Sons row (migration compat). */
    tenantId:              text("tenant_id"),
    email:                 text("email").notNull(),
    passwordHash:          text("password_hash").notNull(),
    /** owner | admin | manager | cashier — validated at the route layer. */
    role:                  text("role").notNull().default("cashier"),
    isActive:              boolean("is_active").notNull().default(true),
    lastLoginAt:           timestamp("last_login_at", { withTimezone: true }),
    passwordResetToken:    text("password_reset_token"),
    passwordResetExpires:  timestamp("password_reset_expires", { withTimezone: true }),
    createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_users_tenant_idx").on(table.tenantId),
    /* Uniqueness is enforced via a hand-written expression-based unique
       index (case-insensitive, COALESCE so NULL-tenant rows share a
       single bucket). See lib/db/migrations/0002_auth_users.sql. */
  ],
);

export type AuthUser = typeof authUsersTable.$inferSelect;
