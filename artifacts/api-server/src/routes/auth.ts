/**
 * Email/password SaaS auth routes.
 *
 * Coexists with the PIN-login flow in `routes/staff.ts`. Both write to
 * the same `tenant_session` cookie (discriminated by the cookie's `kind`
 * field), so the rest of the app doesn't care which login flow was used.
 *
 * Endpoints:
 *   POST   /api/auth/login-email           — public, sets the cookie
 *   POST   /api/auth/users                 — admin: create
 *   GET    /api/auth/users                 — admin: list (current tenant)
 *   GET    /api/auth/users/:id             — admin: fetch one
 *   PATCH  /api/auth/users/:id             — admin: update (email/role/isActive)
 *   POST   /api/auth/users/:id/password    — admin: set a new password
 *   POST   /api/auth/users/:id/disable     — admin: deactivate
 *   POST   /api/auth/users/:id/enable      — admin: re-activate
 *
 * Tenant scoping: every read uses `tenantWhere(authUsersTable.tenantId,
 * req.tenantId)` so admins only see their own tenant's users (plus
 * legacy NULL-tenant users during migration). Writes stamp
 * `tenant_id = req.tenantId`.
 */
import { Router, type IRouter } from "express";
import { eq, ne, and, asc, desc, isNull, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, authUsersTable, authSessionsTable, staffProfilesTable } from "@workspace/db";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { recordAudit } from "../lib/audit";
import { requireAdmin } from "../middlewares/auth";
import { clientMeta, createSession } from "../lib/sessions";
import {
  TENANT_COOKIE_NAME,
  signTenantCookie,
  tenantCookieOptions,
} from "../middlewares/tenant";

const router: IRouter = Router();

const VALID_ROLES = ["owner", "admin", "manager", "cashier"] as const;
type Role = typeof VALID_ROLES[number];

const BCRYPT_ROUNDS    = 12;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;
const EMAIL_RE         = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───── helpers ───── */

function safeUser(u: typeof authUsersTable.$inferSelect) {
  return {
    id:          u.id,
    tenantId:    u.tenantId,
    email:       u.email,
    role:        u.role,
    isActive:    u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt:   u.createdAt,
    updatedAt:   u.updatedAt,
  };
}

function isValidPassword(pw: unknown): pw is string {
  return typeof pw === "string"
    && pw.length >= MIN_PASSWORD_LEN
    && pw.length <= MAX_PASSWORD_LEN;
}

function isValidEmail(e: unknown): e is string {
  return typeof e === "string" && EMAIL_RE.test(e) && e.length <= 254;
}

function normaliseEmail(e: string): string {
  return e.trim().toLowerCase();
}

/* ── POST /api/auth/login-email ─────────────────────────────────── */
router.post("/auth/login-email", async (req, res): Promise<void> => {
  const rawEmail = req.body?.email;
  const password = req.body?.password;
  if (!isValidEmail(rawEmail)) {
    res.status(400).json({ error: "Valid email required" }); return;
  }
  if (typeof password !== "string" || password.length === 0) {
    res.status(400).json({ error: "Password required" }); return;
  }
  const email = normaliseEmail(rawEmail);

  try {
    /* We do NOT pre-filter by req.tenantId — email is the routing key.
       The looked-up user's tenantId then establishes the session tenant.
       Within a single email, uniqueness across tenants is enforced by
       the auth_users_email_per_tenant index (case-insensitive). */
    const matches = await db
      .select()
      .from(authUsersTable)
      .where(eq(authUsersTable.email, email));

    /* The same email can legitimately exist in more than one tenant
       (uniqueness is enforced PER tenant). Verify the password against EVERY
       candidate row and keep the one it actually matches, so a user is never
       authenticated against the wrong shop — and a valid login is never
       rejected just because another tenant's row happened to sort first. */
    let user: (typeof matches)[number] | undefined;
    for (const candidate of matches) {
      const matched = await bcrypt.compare(password, candidate.passwordHash);
      if (matched && !user) user = candidate;
    }
    /* No candidate rows at all → still run one compare so response timing
       can't be used to tell whether the email exists. */
    if (matches.length === 0) {
      await bcrypt.compare(password, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    }

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    /* Platform admins are vendor-side accounts. They have no tenant context
       and the staff/settings queries scoped by their NULL tenant would
       surface legacy data — so refuse them here and point them at /admin. */
    if (user.role === "platform_admin") {
      res.status(403).json({
        error: "platform_admin_login",
        message: "Platform admin accounts must sign in at /admin, not /login.",
      });
      return;
    }

    /* Record successful login (best-effort, never blocks the response). */
    db.update(authUsersTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(authUsersTable.id, user.id))
      .then(() => undefined, () => undefined);

    /* Register this device so it appears in the Devices & Sessions manager
       and can be revoked remotely. The row id becomes the cookie's sid. */
    const { userAgent, ip } = clientMeta(req);
    const sessionId = await createSession({
      tenantId:    user.tenantId ?? null,
      subjectKind: "email",
      subjectId:   user.id,
      userAgent,
      ip,
    });

    res.cookie(
      TENANT_COOKIE_NAME,
      signTenantCookie({
        tenantId:  user.tenantId ?? null,
        userId:    user.id,
        kind:      "email",
        sessionId,
      }),
      tenantCookieOptions(),
    );

    res.json({
      kind:     "email",
      id:       user.id,
      email:    user.email,
      role:     user.role,
      tenantId: user.tenantId ?? null,
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

/* ════════════════ Admin user-management endpoints ════════════════ */

/* ── POST /api/auth/users — create ──────────────────────────────── */
router.post("/auth/users", requireAdmin, async (req, res): Promise<void> => {
  const rawEmail = req.body?.email;
  const password = req.body?.password;
  const role     = req.body?.role;

  if (!isValidEmail(rawEmail)) { res.status(400).json({ error: "Valid email required" }); return; }
  if (!isValidPassword(password)) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} chars` });
    return;
  }
  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(", ")}` });
    return;
  }
  const email = normaliseEmail(rawEmail);

  try {
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [user] = await db
      .insert(authUsersTable)
      .values({
        tenantId:     req.tenantId, // creator's tenant
        email,
        passwordHash: hashed,
        role:         role as Role,
      })
      .returning();
    res.status(201).json(safeUser(user));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A user with that email already exists in this tenant" });
      return;
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

/* ── GET /api/auth/users — list (current tenant) ────────────────── */
router.get("/auth/users", requireAdmin, async (req, res): Promise<void> => {
  try {
    const users = await db
      .select()
      .from(authUsersTable)
      .where(tenantWhere(authUsersTable.tenantId, req.tenantId))
      .orderBy(asc(authUsersTable.createdAt));
    res.json(users.map(safeUser));
  } catch { res.status(500).json({ error: "Failed to list users" }); }
});

/* ── GET /api/auth/users/:id ────────────────────────────────────── */
router.get("/auth/users/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [user] = await db
      .select()
      .from(authUsersTable)
      .where(and(
        eq(authUsersTable.id, String(req.params.id)),
        tenantWhere(authUsersTable.tenantId, req.tenantId),
      ));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(safeUser(user));
  } catch { res.status(500).json({ error: "Failed to fetch user" }); }
});

/* ── PATCH /api/auth/users/:id ──────────────────────────────────── */
router.patch("/auth/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const { email, role, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (email !== undefined) {
    if (!isValidEmail(email)) { res.status(400).json({ error: "Valid email required" }); return; }
    updates.email = normaliseEmail(email);
  }
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(", ")}` });
      return;
    }
    updates.role = role;
  }
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  try {
    const [user] = await db
      .update(authUsersTable)
      .set(updates)
      .where(and(
        eq(authUsersTable.id, String(req.params.id)),
        tenantWhereWrite(authUsersTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(safeUser(user));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Another user with that email already exists in this tenant" });
      return;
    }
    res.status(500).json({ error: "Failed to update user" });
  }
});

/* ── POST /api/auth/users/:id/password — admin sets a new password ── */
router.post("/auth/users/:id/password", requireAdmin, async (req, res): Promise<void> => {
  const password = req.body?.password;
  if (!isValidPassword(password)) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} chars` });
    return;
  }
  try {
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [user] = await db
      .update(authUsersTable)
      .set({
        passwordHash: hashed,
        passwordResetToken:   null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(authUsersTable.id, String(req.params.id)),
        tenantWhereWrite(authUsersTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true, id: user.id });
  } catch { res.status(500).json({ error: "Failed to reset password" }); }
});

/* ── POST /api/auth/change-password — self-service for the owner ──
 *
 * Lets the shop owner rotate their own email-login password from Settings,
 * without going through the platform admin. Works from BOTH session kinds:
 *  - email session → the caller's own auth_users row
 *  - PIN owner session → the tenant's email account(s); the current
 *    password identifies which row (normally there is exactly one).
 * The current password is always verified, so a borrowed unlocked device
 * can't silently take over the account. */
router.post("/auth/change-password", requireAdmin, async (req, res): Promise<void> => {
  const currentPassword = req.body?.currentPassword;
  const newPassword     = req.body?.newPassword;
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    res.status(400).json({ error: "Current password required" }); return;
  }
  if (!isValidPassword(newPassword)) {
    res.status(400).json({ error: `New password must be ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} chars` });
    return;
  }
  try {
    const candidates = req.authKind === "email" && req.userId
      ? await db.select().from(authUsersTable)
          .where(eq(authUsersTable.id, req.userId))
      : await db.select().from(authUsersTable)
          .where(and(
            tenantWhere(authUsersTable.tenantId, req.tenantId),
            eq(authUsersTable.isActive, true),
          ));

    let user: (typeof candidates)[number] | undefined;
    for (const c of candidates) {
      const matched = await bcrypt.compare(currentPassword, c.passwordHash);
      if (matched && !user) user = c;
    }
    if (candidates.length === 0) {
      await bcrypt.compare(currentPassword, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    }
    if (!user) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.update(authUsersTable)
      .set({
        passwordHash: hashed,
        passwordResetToken:   null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(authUsersTable.id, user.id));

    /* Every OTHER device holding an email session for this account must sign
       in again with the new password. Best-effort: a failed revoke must not
       fail the password change that already happened. */
    db.update(authSessionsTable)
      .set({ revokedAt: sql`now()` })
      .where(and(
        eq(authSessionsTable.subjectKind, "email"),
        eq(authSessionsTable.subjectId, user.id),
        isNull(authSessionsTable.revokedAt),
        ...(req.sessionId ? [ne(authSessionsTable.id, req.sessionId)] : []),
      ))
      .then(() => undefined, () => undefined);

    void recordAudit({
      action:       "auth.password_changed",
      actorId:      user.id,
      actorEmail:   user.email,
      targetTenant: user.tenantId ?? null,
      ip:           req.ip,
    });

    res.json({ ok: true, email: user.email });
  } catch { res.status(500).json({ error: "Failed to change password" }); }
});

/* ── POST /api/auth/users/:id/disable ───────────────────────────── */
router.post("/auth/users/:id/disable", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [user] = await db
      .update(authUsersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(authUsersTable.id, String(req.params.id)),
        tenantWhereWrite(authUsersTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(safeUser(user));
  } catch { res.status(500).json({ error: "Failed to disable user" }); }
});

/* ── POST /api/auth/users/:id/enable ────────────────────────────── */
router.post("/auth/users/:id/enable", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [user] = await db
      .update(authUsersTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(
        eq(authUsersTable.id, String(req.params.id)),
        tenantWhereWrite(authUsersTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(safeUser(user));
  } catch { res.status(500).json({ error: "Failed to enable user" }); }
});

/* ════════════════ Devices & Sessions (owner-only) ════════════════
 *
 * Lets the owner see every device logged into the shop and log any of them
 * out (or all at once). "Logged out" = the session's revoked_at is stamped;
 * requireAuth then 401s that device on its next request.
 */

/** Derive a short human label ("Chrome on Windows") from a User-Agent. Best
 *  effort — falls back to "Unknown device". No external dependency. */
function deviceLabelFromUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  const s = ua.toLowerCase();

  let os = "";
  if (s.includes("windows"))                      os = "Windows";
  else if (s.includes("iphone") || s.includes("ipad")) os = s.includes("ipad") ? "iPad" : "iPhone";
  else if (s.includes("android"))                 os = "Android";
  else if (s.includes("mac os") || s.includes("macintosh")) os = "macOS";
  else if (s.includes("linux"))                   os = "Linux";

  let browser = "";
  if (s.includes("edg/") || s.includes("edga") || s.includes("edgios")) browser = "Edge";
  else if (s.includes("opr/") || s.includes("opera"))                    browser = "Opera";
  else if (s.includes("chrome") || s.includes("crios"))                  browser = "Chrome";
  else if (s.includes("firefox") || s.includes("fxios"))                 browser = "Firefox";
  else if (s.includes("safari"))                                         browser = "Safari";

  if (browser && os) return `${browser} on ${os}`;
  if (browser)       return browser;
  if (os)            return os;
  return "Unknown device";
}

/* ── GET /api/auth/sessions — list the tenant's active devices ────── */
router.get("/auth/sessions", requireAdmin, async (req, res): Promise<void> => {
  try {
    const sessions = await db
      .select()
      .from(authSessionsTable)
      .where(and(
        tenantWhere(authSessionsTable.tenantId, req.tenantId),
        isNull(authSessionsTable.revokedAt),
      ))
      .orderBy(desc(authSessionsTable.lastSeenAt));

    /* Resolve a display name per session, branching on subject kind. */
    const pinIds   = sessions.filter((s) => s.subjectKind === "pin").map((s) => s.subjectId);
    const emailIds = sessions.filter((s) => s.subjectKind === "email").map((s) => s.subjectId);

    const staffRows = pinIds.length
      ? await db.select({ id: staffProfilesTable.id, name: staffProfilesTable.name })
          .from(staffProfilesTable).where(inArray(staffProfilesTable.id, pinIds))
      : [];
    const userRows = emailIds.length
      ? await db.select({ id: authUsersTable.id, email: authUsersTable.email })
          .from(authUsersTable).where(inArray(authUsersTable.id, emailIds))
      : [];
    const nameByStaff = new Map(staffRows.map((r) => [r.id, r.name]));
    const emailByUser = new Map(userRows.map((r) => [r.id, r.email]));

    res.json(sessions.map((s) => ({
      id:         s.id,
      kind:       s.subjectKind,
      who:        s.subjectKind === "pin"
        ? (nameByStaff.get(s.subjectId) ?? "Staff")
        : (emailByUser.get(s.subjectId) ?? "User"),
      device:     deviceLabelFromUA(s.userAgent),
      ip:         s.ip,
      createdAt:  s.createdAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent:  s.id === req.sessionId,
    })));
  } catch { res.status(500).json({ error: "Failed to list sessions" }); }
});

/* ── DELETE /api/auth/sessions/:id — log out one device ───────────── */
router.delete("/auth/sessions/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .update(authSessionsTable)
      .set({ revokedAt: sql`now()` })
      .where(and(
        eq(authSessionsTable.id, String(req.params.id)),
        tenantWhereWrite(authSessionsTable.tenantId, req.tenantId),
        isNull(authSessionsTable.revokedAt),
      ))
      .returning({ id: authSessionsTable.id });
    if (!row) { res.status(404).json({ error: "Session not found" }); return; }
    res.json({ ok: true, id: row.id });
  } catch { res.status(500).json({ error: "Failed to revoke session" }); }
});

/* ── POST /api/auth/sessions/revoke-all — log out EVERY device ──────
 * Includes the caller's own device; the cookie is cleared here and the
 * next request 401s, so the owner is signed out too. */
router.post("/auth/sessions/revoke-all", requireAdmin, async (req, res): Promise<void> => {
  try {
    const revoked = await db
      .update(authSessionsTable)
      .set({ revokedAt: sql`now()` })
      .where(and(
        tenantWhereWrite(authSessionsTable.tenantId, req.tenantId),
        isNull(authSessionsTable.revokedAt),
      ))
      .returning({ id: authSessionsTable.id });
    res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
    res.json({ ok: true, count: revoked.length });
  } catch { res.status(500).json({ error: "Failed to revoke sessions" }); }
});

export default router;
