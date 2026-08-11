/**
 * Platform-admin authorization gate.
 *
 * Extracted from routes/platform.ts so every vendor-facing router shares one
 * definition rather than each growing its own copy.
 *
 * The cookie is never trusted on its own: the role is re-read from the DB on
 * every request, so revoking `platform_admin` takes effect immediately instead
 * of whenever the session cookie happens to expire.
 */
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, authUsersTable } from "@workspace/db";

/** Block everything unless the platform_session cookie maps to an active
 *  auth_users row with role = "platform_admin". Independent of tenant_session
 *  so the vendor can stay signed into /admin while also signing into a
 *  tenant's /login on the same browser. */
export async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.platformUserId) {
    res.status(401).json({ error: "Platform admin login required" });
    return;
  }
  try {
    const [me] = await db
      .select({
        id:       authUsersTable.id,
        email:    authUsersTable.email,
        role:     authUsersTable.role,
        isActive: authUsersTable.isActive,
      })
      .from(authUsersTable)
      .where(eq(authUsersTable.id, req.platformUserId));
    if (!me || !me.isActive) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (me.role !== "platform_admin") {
      res.status(403).json({ error: "Platform admin access required" });
      return;
    }
    /* Cache the actor on the request so audit logging doesn't re-query. */
    req.platformActor = { id: me.id, email: me.email };
    next();
  } catch {
    res.status(500).json({ error: "Authorization check failed" });
  }
}
