/**
 * Audit-log helper. Every platform-admin write should call recordAudit()
 * so the action lands in the append-only audit_events table.
 *
 * Designed to never throw — if the insert fails the original request must
 * still succeed (we'd rather lose an audit row than block a recovery
 * action like ResetPassword during a DB hiccup). Errors get logged.
 */
import type { Request } from "express";
import { db, auditEventsTable } from "@workspace/db";
import { logger } from "./logger";

export interface AuditInput {
  action:        string;
  actorId:       string;
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
