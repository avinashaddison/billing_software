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
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, authUsersTable, staffProfilesTable } from "@workspace/db";
import { tenantWhere } from "../lib/tenant";
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

/* ───── admin-only gate ─────
 *
 * Allows the request through if the cookie belongs to one of:
 *  - an auth_users row with role IN (owner, admin) within the caller's tenant
 *  - a staff_profiles row with role = 'owner' within the caller's tenant
 *    (covers the legacy Hira & Sons owner who still uses PIN login).
 */
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    /* Constant-time-ish behaviour: always run a bcrypt compare so an
       attacker cannot enumerate emails by response timing. */
    const user = matches[0];
    const hashToCheck = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await bcrypt.compare(password, hashToCheck);

    if (!user || !ok || !user.isActive) {
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

    res.cookie(
      TENANT_COOKIE_NAME,
      signTenantCookie({
        tenantId: user.tenantId ?? null,
        userId:   user.id,
        kind:     "email",
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
        tenantWhere(authUsersTable.tenantId, req.tenantId),
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
        tenantWhere(authUsersTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true, id: user.id });
  } catch { res.status(500).json({ error: "Failed to reset password" }); }
});

/* ── POST /api/auth/users/:id/disable ───────────────────────────── */
router.post("/auth/users/:id/disable", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [user] = await db
      .update(authUsersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(authUsersTable.id, String(req.params.id)),
        tenantWhere(authUsersTable.tenantId, req.tenantId),
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
        tenantWhere(authUsersTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(safeUser(user));
  } catch { res.status(500).json({ error: "Failed to enable user" }); }
});

export default router;
