import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth_users";

/**
 * Append-only log of platform-admin actions. Every sensitive write under
 * /api/platform/* inserts one row; nothing updates or deletes here. The
 * point is accountability + post-incident forensics, not state.
 */
export const auditEventsTable = pgTable(
  "audit_events",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    /** Auth user that performed the action. NULL only if the actor was deleted afterwards. */
    actorId:      uuid("actor_id").references(() => authUsersTable.id, { onDelete: "set null" }),
    /** Denormalised email so the row remains readable even if the actor row changes later. */
    actorEmail:   text("actor_email").notNull(),
    /** Free-form action verb, e.g. "tenant.suspend", "tenant.extend". */
    action:       text("action").notNull(),
    /** Tenant the action affected, if any. */
    targetTenant: text("target_tenant"),
    /** Arbitrary structured payload — old/new values, request body, etc. */
    metadata:     jsonb("metadata").notNull().default({}),
    /** Best-effort client IP from req.ip (honours X-Forwarded-For via trust-proxy). */
    ip:           text("ip"),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_target_idx").on(table.targetTenant, table.createdAt),
    index("audit_events_actor_idx").on(table.actorId, table.createdAt),
    index("audit_events_action_idx").on(table.action, table.createdAt),
  ],
);

export type AuditEvent = typeof auditEventsTable.$inferSelect;
