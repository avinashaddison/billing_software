/**
 * Device-session helpers.
 *
 * A row in `auth_sessions` represents one logged-in device. Its id is embedded
 * in the signed `tenant_session` cookie (the `sid` claim) and validated on
 * every authenticated request by `requireAuth`. These helpers are shared by
 * the login handlers (which create a session up front) and the lazy-upgrade
 * path in `requireAuth` (which registers a device for pre-existing cookies
 * that predate device tracking).
 */
import type { Request } from "express";
import { db, authSessionsTable } from "@workspace/db";

/** Guard against oversized/spoofed headers bloating the row. */
const MAX_UA = 512;
const MAX_IP = 64;

export interface ClientMeta {
  userAgent: string | null;
  ip: string | null;
}

/** Extract the truncated User-Agent + client IP from a request. `req.ip`
 *  reflects the real client because the app sets `trust proxy` (Render's
 *  X-Forwarded-For). */
export function clientMeta(req: Request): ClientMeta {
  const ua = req.headers["user-agent"];
  return {
    userAgent: typeof ua === "string" && ua ? ua.slice(0, MAX_UA) : null,
    ip: req.ip ? req.ip.slice(0, MAX_IP) : null,
  };
}

/**
 * Insert a new device session and return its id (to embed as the cookie's
 * `sid`). `created_at` / `last_seen_at` default to DB now().
 */
export async function createSession(args: {
  tenantId: string | null;
  subjectKind: "pin" | "email";
  subjectId: string;
  userAgent: string | null;
  ip: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(authSessionsTable)
    .values({
      tenantId:    args.tenantId,
      subjectKind: args.subjectKind,
      subjectId:   args.subjectId,
      userAgent:   args.userAgent,
      ip:          args.ip,
    })
    .returning({ id: authSessionsTable.id });
  return row.id;
}
