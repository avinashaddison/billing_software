/**
 * Audit-log helper. Every platform-admin write should call recordAudit()
 * so the action lands in the append-only audit_events table.
 *
 * Designed to never throw — if the insert fails the original request must
 * still succeed (we'd rather lose an audit row than block a recovery
 * action like ResetPassword during a DB hiccup). Errors get logged.
 */
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, auditEventsTable, authUsersTable, staffProfilesTable } from "@workspace/db";
import { logger } from "./logger";

export interface AuditInput {
  action:        string;
  /* Nullable: tenant PIN-staff actors have no auth_users row (the FK target),
     so they are identified via the actorEmail label instead. */
  actorId:       string | null;
  actorEmail:    string;
  targetTenant?: string | null;
  metadata?:     Record<string, unknown>;
  ip?:           string;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditEventsTable).values({
      actorId:      input.actorId,
      actorEmail:   input.actorEmail,
      action:       input.action,
      targetTenant: input.targetTenant ?? null,
      metadata:     input.metadata ?? {},
      ip:           input.ip ?? null,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "audit: insert failed (continuing)");
  }
}

/** Pull actor identity from a platform-admin request. Caller must have
 *  already passed the requirePlatformAdmin gate so these are non-null. */
export function actorFromReq(
  req: Request,
  actor: { id: string; email: string },
): Pick<AuditInput, "actorId" | "actorEmail" | "ip"> {
  return {
    actorId:    actor.id,
    actorEmail: actor.email,
    ip:         req.ip,
  };
}

/** Resolve a TENANT-side actor (email user or PIN staff) into audit fields.
 *  Tenant sessions carry either `userId` (an auth_users id) or `staffId`
 *  (a staff-profiles id from PIN login). A staffId must NEVER be written to
 *  actorId — the FK points at auth_users — so staff are identified in the
 *  actorEmail label instead. Lookup failures degrade to id-tagged labels;
 *  this must never block or fail the business write it documents. */
export async function tenantActor(
  req: { userId?: string | null; staffId?: string | null },
): Promise<Pick<AuditInput, "actorId" | "actorEmail">> {
  try {
    if (req.userId) {
      const [u] = await db
        .select({ email: authUsersTable.email })
        .from(authUsersTable)
        .where(eq(authUsersTable.id, req.userId));
      return { actorId: req.userId, actorEmail: u?.email ?? `user:${req.userId}` };
    }
    if (req.staffId) {
      const [s] = await db
        .select({ name: staffProfilesTable.name })
        .from(staffProfilesTable)
        .where(eq(staffProfilesTable.id, req.staffId));
      return { actorId: null, actorEmail: s?.name ? `staff:${s.name}` : `staff:${req.staffId}` };
    }
  } catch {
    /* fall through to the anonymous label */
  }
  return { actorId: null, actorEmail: "tenant:unknown" };
}
