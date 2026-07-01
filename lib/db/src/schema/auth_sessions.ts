import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * auth_sessions — one row per logged-in device.
 *
 * Powers the "Devices & Sessions" manager (list logged-in devices, revoke
 * one, revoke all). The row id is embedded in the signed `tenant_session`
 * cookie as its `sid` claim and validated on every authenticated request;
 * setting `revokedAt` logs that device out on its next request.
 *
 * `subjectKind` + `subjectId` identify the owner of the session:
 *   - "pin"   → staff_profiles.id
 *   - "email" → auth_users.id
 * The two auth tables are independent, so there is no FK here — resolve the
 * display name at read time by branching on `subjectKind`.
 *
 * `tenantId` is `text NULL` to match the rest of the schema and preserve
 * legacy Hira & Sons (NULL-tenant) compatibility.
 */
export const authSessionsTable = pgTable(
  "auth_sessions",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons session. */
    tenantId:    text("tenant_id"),
    /** "pin" | "email" — which auth table subjectId points at. */
    subjectKind: text("subject_kind").notNull(),
    subjectId:   uuid("subject_id").notNull(),
    userAgent:   text("user_agent"),
    ip:          text("ip"),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt:  timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** NULL = active. Set to now() to revoke (log the device out). */
    revokedAt:   timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("auth_sessions_subject_idx").on(table.subjectKind, table.subjectId),
    index("auth_sessions_tenant_idx").on(table.tenantId),
    index("auth_sessions_active_idx").on(table.tenantId, table.revokedAt),
  ],
);

export type AuthSession = typeof authSessionsTable.$inferSelect;
