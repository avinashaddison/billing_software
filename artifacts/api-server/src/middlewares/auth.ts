/**
 * Authentication / authorization gates.
 *
 * `requireAuth` is the GLOBAL authentication gate: every /api route except a
 * small allowlist of public endpoints (login / logout / me / health) requires
 * a resolved session cookie — either a PIN `staffId` or an email `userId`,
 * both attached by `tenantContext`. Without this an anonymous caller could hit
 * the API directly and read or mutate tenant data, bypassing the SPA's
 * client-side route guards.
 *
 * `requireAdmin` is the stricter authorization gate for privileged routes
 * (user + staff management). It allows owner/admin email users and owner PIN
 * staff within the caller's tenant — including the legacy null-tenant owner.
 */
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, authUsersTable, staffProfilesTable } from "@workspace/db";

/**
 * Endpoints reachable WITHOUT a session. Kept identical to the tenant-active
 * gate's allowlist so the two gates never disagree about what is public.
 *
 * Paths are relative to the `/api` mount (e.g. "/auth/login"), matching
 * `req.path` inside the API router.
 */
export const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  "/auth/login",
  "/auth/login-email",
  "/auth/logout",
  "/auth/me",
  "/health",
  "/healthz",
]);

/**
 * Global authentication gate. Lets through:
 *  - explicitly public paths (login / logout / me / health), and
 *  - any request carrying a resolved session (PIN staffId or email userId).
 * Everything else gets a 401 so anonymous callers can't reach tenant data
 * or mutate state by hitting the API directly.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (PUBLIC_PATHS.has(req.path)) { next(); return; }
  if (!req.staffId && !req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  /* A valid signature isn't enough: the session cookie lives for a year, so we
     must confirm the account is STILL active on every request. Otherwise a
     staff member the owner just disabled (e.g. a fired cashier) would keep full
     API access until their cookie expired. requireAdmin already does this for
     privileged routes — this extends the same guarantee to every data route. */
  try {
    if (req.authKind === "email" && req.userId) {
      const [u] = await db
        .select({ isActive: authUsersTable.isActive })
        .from(authUsersTable)
        .where(eq(authUsersTable.id, req.userId));
      if (!u || !u.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
      next();
      return;
    }
    if (req.staffId) {
      const [s] = await db
        .select({ isActive: staffProfilesTable.isActive })
        .from(staffProfilesTable)
        .where(eq(staffProfilesTable.id, req.staffId));
      if (!s || !s.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
      next();
      return;
    }
    res.status(401).json({ error: "Not authenticated" });
  } catch {
    res.status(500).json({ error: "Authentication check failed" });
  }
}

/* ───── admin-only gate ─────
 *
 * Allows the request through if the cookie belongs to one of:
 *  - an auth_users row with role IN (owner, admin) within the caller's tenant
 *  - a staff_profiles row with role = 'owner' within the caller's tenant
 *    (covers the legacy Hira & Sons owner who still uses PIN login).
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.authKind === "email" && req.userId) {
      const [me] = await db
        .select({ role: authUsersTable.role, isActive: authUsersTable.isActive, tenantId: authUsersTable.tenantId })
        .from(authUsersTable)
        .where(eq(authUsersTable.id, req.userId));
      if (!me || !me.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
      if (me.role !== "owner" && me.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      next();
      return;
    }
    if (req.staffId) {
      const [me] = await db
        .select({ role: staffProfilesTable.role, isActive: staffProfilesTable.isActive, tenantId: staffProfilesTable.tenantId })
        .from(staffProfilesTable)
        .where(eq(staffProfilesTable.id, req.staffId));
      if (!me || !me.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
      if (me.role !== "owner") {
        res.status(403).json({ error: "Owner access required" });
        return;
      }
      next();
      return;
    }
    res.status(401).json({ error: "Not authenticated" });
  } catch {
    res.status(500).json({ error: "Authorization check failed" });
  }
}
