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
import { eq, and, sql } from "drizzle-orm";
import { db, authUsersTable, staffProfilesTable, authSessionsTable, staffPermissionsTable } from "@workspace/db";
import { clientMeta, createSession } from "../lib/sessions";
import { logger } from "../lib/logger";
import { TENANT_COOKIE_NAME, signTenantCookie, tenantCookieOptions } from "./tenant";

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
/**
 * Device-session gate, run once the caller's account is confirmed active.
 *
 * Returns `true` if the request should proceed, `false` if it already sent a
 * 401 (the session was revoked). Three paths:
 *
 *  - cookie carries a `sid` → verify the auth_sessions row exists and is not
 *    revoked. Missing/revoked → fail CLOSED (401 + clear cookie) so a
 *    remotely-logged-out device stops working on its next request.
 *  - cookie has no `sid` (minted before device tracking) → lazily register a
 *    device and re-issue the cookie with the new `sid` (silent upgrade — the
 *    user is never logged out).
 *  - the session SELECT itself throws (Neon blip) → fail OPEN (proceed). A
 *    transient DB error must not mass-logout the whole tenant. This is
 *    deliberately different from the account-active check below, which 500s.
 */
/**
 * Idle window after which a dormant session stops being accepted.
 *
 * The cookie itself lives for a year and its `iat` was never checked, so a
 * copied cookie used to work indefinitely. Rather than enforce an age on the
 * cookie (which would sign everyone out the moment it shipped), expiry is
 * driven by `auth_sessions.lastSeenAt`, which every authenticated request
 * already refreshes. Anyone using the app regularly is therefore never
 * disturbed; only genuinely forgotten devices stop working.
 *
 * Set SESSION_IDLE_DAYS to tune, or 0 to disable.
 */
function sessionIdleTimeoutMs(): number {
  const raw = process.env["SESSION_IDLE_DAYS"];
  const days = raw === undefined || raw.trim() === "" ? 30 : Number(raw);
  if (!Number.isFinite(days) || days <= 0) return 0;
  return days * 24 * 60 * 60 * 1000;
}

async function validateOrUpgradeSession(
  req: Request,
  res: Response,
  subjectKind: "pin" | "email",
  subjectId: string,
): Promise<boolean> {
  if (req.sessionId) {
    let row: { revokedAt: Date | null; lastSeenAt: Date | null } | undefined;
    /* One retry, because Neon suspends idle connections and a single transient
       failure is routine. A PERSISTENT failure now denies the request. This
       used to fail OPEN — meaning a session the owner had just revoked kept
       working for as long as the database was unhappy. */
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        [row] = await db
          .select({
            revokedAt:  authSessionsTable.revokedAt,
            lastSeenAt: authSessionsTable.lastSeenAt,
          })
          .from(authSessionsTable)
          .where(and(
            eq(authSessionsTable.id, req.sessionId),
            eq(authSessionsTable.subjectKind, subjectKind),
            eq(authSessionsTable.subjectId, subjectId),
          ));
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr !== undefined) {
      /* 503 and deliberately NOT 401: the session is probably valid, we simply
         cannot confirm it right now. A 401 would clear the cookie and sign the
         whole shop out over a momentary database blip, which is exactly the
         mass-logout the old fail-open was trying to avoid. A 503 denies this
         one request — closed, but harmless — and the SPA retries. */
      logger.error({ err: lastErr }, "session status check failed twice — denying request (fail-closed)");
      res.status(503).json({ error: "Service temporarily unavailable, please retry" });
      return false;
    }
    if (!row || row.revokedAt) {
      res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Session revoked" });
      return false;
    }

    /* Idle expiry. Deliberately read-only: the session row is left alone and
       the scheduled cleanup job prunes it later, so nothing is written to a
       live database on the request path. */
    const idleMs = sessionIdleTimeoutMs();
    if (idleMs > 0 && row.lastSeenAt instanceof Date && Date.now() - row.lastSeenAt.getTime() > idleMs) {
      res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Session expired, please sign in again" });
      return false;
    }
    /* Throttled, fire-and-forget last-seen bump: at most one write per minute
       per session, and a failed write never blocks or fails the request. */
    db.update(authSessionsTable)
      .set({ lastSeenAt: sql`now()` })
      .where(and(
        eq(authSessionsTable.id, req.sessionId),
        sql`${authSessionsTable.lastSeenAt} < now() - interval '60 seconds'`,
      ))
      .then(() => undefined, () => undefined);
    return true;
  }

  /* Legacy cookie (no sid) → register a device row and re-issue the cookie
     carrying the new sid. Best-effort: never block auth if the write fails. */
  try {
    const { userAgent, ip } = clientMeta(req);
    const sid = await createSession({
      tenantId: req.tenantId,
      subjectKind,
      subjectId,
      userAgent,
      ip,
    });
    req.sessionId = sid;
    res.cookie(
      TENANT_COOKIE_NAME,
      signTenantCookie({
        tenantId:  req.tenantId,
        staffId:   subjectKind === "pin"   ? subjectId : null,
        userId:    subjectKind === "email" ? subjectId : null,
        kind:      subjectKind,
        sessionId: sid,
      }),
      tenantCookieOptions(),
    );
  } catch (err) {
    logger.warn({ err }, "session lazy-upgrade failed — allowing without sid");
  }
  return true;
}

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
      if (!(await validateOrUpgradeSession(req, res, "email", req.userId))) return;
      next();
      return;
    }
    if (req.staffId) {
      const [s] = await db
        .select({ isActive: staffProfilesTable.isActive })
        .from(staffProfilesTable)
        .where(eq(staffProfilesTable.id, req.staffId));
      if (!s || !s.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
      if (!(await validateOrUpgradeSession(req, res, "pin", req.staffId))) return;
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

/* ───── per-resource WRITE gate ─────
 *
 * Enforces the SAME permission model the SPA uses, but on the server, so a
 * restricted staff account can't bypass the UI and mutate data by calling the
 * API directly. Grants write when:
 *   - email user with role owner/admin (admins have full access; email
 *     manager/cashier accounts have no per-resource map and the SPA already
 *     shows them nothing, so they get no write), OR
 *   - PIN staff with role 'owner', OR
 *   - PIN staff whose staff_permissions[resource] === 'write'.
 * Everyone else gets 403. Apply as route middleware:
 *   router.post("/products", requireWrite("products"), handler)
 */
export function requireWrite(resource: string) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.authKind === "email" && req.userId) {
        const [me] = await db
          .select({ role: authUsersTable.role, isActive: authUsersTable.isActive })
          .from(authUsersTable)
          .where(eq(authUsersTable.id, req.userId));
        if (!me || !me.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
        if (me.role === "owner" || me.role === "admin") { next(); return; }
        res.status(403).json({ error: `No permission to modify ${resource}` });
        return;
      }
      if (req.staffId) {
        const [me] = await db
          .select({ role: staffProfilesTable.role, isActive: staffProfilesTable.isActive })
          .from(staffProfilesTable)
          .where(eq(staffProfilesTable.id, req.staffId));
        if (!me || !me.isActive) { res.status(401).json({ error: "Not authenticated" }); return; }
        if (me.role === "owner") { next(); return; }
        const [perm] = await db
          .select({ level: staffPermissionsTable.level })
          .from(staffPermissionsTable)
          .where(and(
            eq(staffPermissionsTable.staffId, req.staffId),
            eq(staffPermissionsTable.resource, resource),
          ));
        if (perm?.level === "write") { next(); return; }
        res.status(403).json({ error: `No permission to modify ${resource}` });
        return;
      }
      res.status(401).json({ error: "Not authenticated" });
    } catch {
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}
