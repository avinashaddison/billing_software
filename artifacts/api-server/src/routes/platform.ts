/**
 * Platform admin routes — vendor-level control plane for managing tenants.
 *
 * Mounted BEFORE the licenseGate so the vendor can reach this surface even
 * when a tenant is unlicensed or the legacy NULL-tenant trial has expired.
 *
 * Auth model:
 *   - A platform admin is an auth_users row with role = "platform_admin" and
 *     tenant_id = NULL. They log in through the normal /api/auth/login-email
 *     and arrive here with req.userId set + req.tenantId = null.
 *   - requirePlatformAdmin re-checks the role from the DB on every request
 *     (cookie alone is not trusted).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, sql, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  pool,
  authUsersTable,
  tenantsTable,
  staffProfilesTable,
  staffPermissionsTable,
  storeSettingsTable,
  productsTable,
  salesTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { recordAudit } from "../lib/audit";
import {
  PLATFORM_COOKIE_NAME,
  signTenantCookie,
  tenantCookieOptions,
} from "../middlewares/tenant";

/* Default PIN for the auto-created owner staff_profile on every new tenant.
   Owners are expected to change this from Staff Management on first login. */
const DEFAULT_OWNER_PIN = "8085";

/* Resources granted to the auto-created owner. Mirrors the frontend
   permissions resources — owners always get full write. */
const OWNER_RESOURCES = [
  "dashboard", "products", "scan", "billing", "logs", "reports",
  "customers", "categories", "labels", "suppliers", "deals", "staff",
  "settings",
] as const;

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LEN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE  = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

/* Allowed shorthand durations for the /admin "Access" picker. The presets
   keep the admin UX one-tap; anything else uses an explicit ISO date. */
const PRESET_DURATIONS: Record<string, number> = {
  "7d":     7  * 86_400_000,
  "30d":    30 * 86_400_000,
  "90d":    90 * 86_400_000,
  "180d":   180 * 86_400_000,
  "365d":   365 * 86_400_000,
};

/**
 * Resolve an expiry payload into a Date | null. Accepts:
 *   - "lifetime" / null / undefined  → null (no expiry)
 *   - one of the PRESET_DURATIONS keys → now() + that duration
 *   - any ISO 8601 date / datetime string → parsed Date
 * Throws on anything else.
 */
function resolveExpiry(raw: unknown): Date | null {
  if (raw == null || raw === "" || raw === "lifetime") return null;
  if (typeof raw === "string") {
    if (raw in PRESET_DURATIONS) return new Date(Date.now() + PRESET_DURATIONS[raw]);
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new Error("Invalid expiresAt — use 'lifetime', a preset (7d/30d/90d/180d/365d), or an ISO date");
}

function isValidEmail(e: unknown): e is string {
  return typeof e === "string" && EMAIL_RE.test(e) && e.length <= 254;
}

function isValidPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD_LEN && pw.length <= 128;
}

/** Block everything unless the platform_session cookie maps to an active
 *  auth_users row with role = "platform_admin". Independent of tenant_session
 *  so the vendor can stay signed into /admin while also signing into a
 *  tenant's /login on the same browser. */
async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
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

/* ───── POST /api/platform/login — vendor-only sign-in ───────────────
 *
 * Sets the `platform_session` cookie (NOT the shared tenant_session) so
 * /admin and /login can be active in the same browser without clobbering
 * each other. The payload reuses the tenant cookie shape; only the cookie
 * name differs on the wire.
 */
router.post("/platform/login", async (req, res): Promise<void> => {
  const rawEmail = req.body?.email;
  const password = req.body?.password;
  if (!isValidEmail(rawEmail) || typeof password !== "string" || password.length === 0) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const email = String(rawEmail).trim().toLowerCase();
  try {
    const matches = await db.select().from(authUsersTable).where(eq(authUsersTable.email, email));
    const user = matches[0];
    /* Constant-time-ish: always run bcrypt even on no-match so an attacker
       can't enumerate vendor emails by response timing. */
    const hashToCheck = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await bcrypt.compare(password, hashToCheck);

    if (!user || !ok || !user.isActive || user.role !== "platform_admin") {
      res.status(401).json({ error: "Invalid platform admin credentials" });
      return;
    }

    /* Best-effort lastLoginAt stamp. */
    db.update(authUsersTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(authUsersTable.id, user.id))
      .then(() => undefined, () => undefined);

    res.cookie(
      PLATFORM_COOKIE_NAME,
      signTenantCookie({ tenantId: null, userId: user.id, kind: "email" }),
      tenantCookieOptions(),
    );
    void recordAudit({
      action:     "platform.login",
      actorId:    user.id,
      actorEmail: user.email,
      ip:         req.ip,
    });
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

/* ───── POST /api/platform/logout — clear the platform_session cookie ─── */
router.post("/platform/logout", (_req, res): void => {
  res.clearCookie(PLATFORM_COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

/* ───── GET /api/platform/me — quick role probe ───────────────────── */
router.get("/platform/me", async (req, res): Promise<void> => {
  if (!req.platformUserId) {
    res.status(401).json({ error: "Not authenticated" });
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
    if (!me || !me.isActive || me.role !== "platform_admin") {
      res.status(403).json({ error: "Not a platform admin" });
      return;
    }
    res.json({ id: me.id, email: me.email, role: me.role });
  } catch {
    res.status(500).json({ error: "Lookup failed" });
  }
});

/* ───── GET /api/platform/tenants — list with counts ──────────────── */
router.get("/platform/tenants", requirePlatformAdmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id:        tenantsTable.id,
        name:      tenantsTable.name,
        isActive:  tenantsTable.isActive,
        expiresAt: tenantsTable.expiresAt,
        createdAt: tenantsTable.createdAt,
      })
      .from(tenantsTable)
      .orderBy(tenantsTable.createdAt);

    /* Sidecar counts — one tiny query per metric, OK for the small N of tenants
       a single vendor manages. Switch to a single grouped query if N grows. */
    const userCounts = await db
      .select({ tenantId: authUsersTable.tenantId, c: sql<number>`count(*)::int` })
      .from(authUsersTable)
      .groupBy(authUsersTable.tenantId);
    const staffCounts = await db
      .select({ tenantId: staffProfilesTable.tenantId, c: sql<number>`count(*)::int` })
      .from(staffProfilesTable)
      .groupBy(staffProfilesTable.tenantId);
    const productCounts = await db
      .select({ tenantId: productsTable.tenantId, c: sql<number>`count(*)::int` })
      .from(productsTable)
      .groupBy(productsTable.tenantId);
    const saleCounts = await db
      .select({ tenantId: salesTable.tenantId, c: sql<number>`count(*)::int` })
      .from(salesTable)
      .groupBy(salesTable.tenantId);

    /* Owner email lookup. If a tenant has multiple auth_users with role
       'owner' we pick the earliest-created (typically the one auto-created
       on tenant onboarding) so the admin panel shows a stable value. */
    const owners = await db
      .select({
        tenantId:  authUsersTable.tenantId,
        email:     authUsersTable.email,
        createdAt: authUsersTable.createdAt,
      })
      .from(authUsersTable)
      .where(eq(authUsersTable.role, "owner"));

    const byTenant = (entries: { tenantId: string | null; c: number }[]) => {
      const m = new Map<string | null, number>();
      for (const e of entries) m.set(e.tenantId, e.c);
      return m;
    };
    const u = byTenant(userCounts);
    const s = byTenant(staffCounts);
    const p = byTenant(productCounts);
    const sl = byTenant(saleCounts);

    /* Build tenantId -> earliest owner email map. */
    const ownerByTenant = new Map<string, { email: string; at: Date }>();
    for (const o of owners) {
      if (o.tenantId == null) continue;
      const prev = ownerByTenant.get(o.tenantId);
      if (!prev || o.createdAt < prev.at) {
        ownerByTenant.set(o.tenantId, { email: o.email, at: o.createdAt });
      }
    }

    res.json({
      tenants: rows.map((t) => ({
        ...t,
        ownerEmail:   ownerByTenant.get(t.id)?.email ?? null,
        userCount:    u.get(t.id) ?? 0,
        staffCount:   s.get(t.id) ?? 0,
        productCount: p.get(t.id) ?? 0,
        saleCount:    sl.get(t.id) ?? 0,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to list tenants" });
  }
});

/* ───── POST /api/platform/tenants — create new tenant + owner ───── */
router.post("/platform/tenants", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id    = String(req.body?.id ?? "").trim().toLowerCase();
  const name  = String(req.body?.name ?? "").trim();
  const email = req.body?.ownerEmail;
  const password = req.body?.ownerPassword;

  if (!SLUG_RE.test(id)) {
    res.status(400).json({ error: "Tenant id must be 3–40 chars: lowercase letters, digits, hyphens, starting with a letter" });
    return;
  }
  if (!name) { res.status(400).json({ error: "Tenant name required" }); return; }
  if (!isValidEmail(email)) { res.status(400).json({ error: "Valid owner email required" }); return; }
  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Owner password must be 8–128 chars" }); return;
  }

  /* Optional `expiresAt` accepts presets (7d, 365d, ...) or an ISO date.
     Omitting it (or passing "lifetime") means no expiry. */
  let expiresAt: Date | null;
  try { expiresAt = resolveExpiry(req.body?.expiresAt); }
  catch (e: any) { res.status(400).json({ error: e?.message ?? "Invalid expiresAt" }); return; }

  try {
    const existing = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, id));
    if (existing.length > 0) {
      res.status(409).json({ error: "A tenant with that id already exists" });
      return;
    }
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ id, name, expiresAt })
      .returning();

    /* 1. Email-login row (used at /login). */
    const hashedPwd = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [owner] = await db
      .insert(authUsersTable)
      .values({
        tenantId:     tenant.id,
        email:        String(email).trim().toLowerCase(),
        passwordHash: hashedPwd,
        role:         "owner",
      })
      .returning();

    /* 2. Staff profile row + default PIN. The /login flow shows the staff
       list AFTER email-login, so without this row the owner can email-auth
       but then hit "No staff accounts found". PIN is 8085 by default —
       owner is told to change it from Staff Management. */
    const hashedPin = await bcrypt.hash(DEFAULT_OWNER_PIN, BCRYPT_ROUNDS);
    const [staffOwner] = await db
      .insert(staffProfilesTable)
      .values({
        tenantId: tenant.id,
        name:     "Owner",
        pin:      hashedPin,
        role:     "owner",
      })
      .returning();

    /* 3. Full write permissions on every resource. The Protected wrapper on
       each page checks per-resource access; owners always get write so they
       see every menu item out of the box. */
    await db
      .insert(staffPermissionsTable)
      .values(OWNER_RESOURCES.map((resource) => ({
        tenantId: tenant.id,
        staffId:  staffOwner.id,
        resource,
        level:    "write",
      })))
      .onConflictDoNothing();

    /* 4. store_settings row so /api/settings returns the new tenant's name,
       not the legacy NULL-tenant Hira & Sons singleton. `id` is an INT PK
       with default=1, so we must pick the next free id explicitly. Going
       through `pool` directly avoids drizzle's QueryResult vs rows[] shape
       trap with raw SQL. */
    const maxRow = await pool.query<{ next_id: number }>(
      "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM store_settings",
    );
    const settingsId = Number(maxRow.rows[0]?.next_id) || 2;
    /* Minimal seed — only the shop name is pre-filled (from the tenant's
       display name). Everything else is blank so the client fills it in
       from Settings on first login. */
    await db
      .insert(storeSettingsTable)
      .values({
        id:       settingsId,
        tenantId: tenant.id,
        data:     {
          name:               tenant.name,
          tagline:            "",
          phone:              "",
          email:              "",
          address:            "",
          gst:                "",
          logoEmoji:          "🏪",
          logoUrl:            "",
          appSubtitle:        "",
          footerNote:         "",
          termsAndConditions: [],
          upiId:              "",
          dynamicQrMode:      false,
          labelShowPrice:     true,
          scannerThresholdMs: 100,
          receiptPaperWidth:  "80mm",
        },
      })
      .onConflictDoNothing();

    void recordAudit({
      action:       "tenant.create",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenant.id,
      ip:           req.ip,
      metadata: {
        name:       tenant.name,
        ownerEmail: owner.email,
        expiresAt:  tenant.expiresAt,
      },
    });

    res.status(201).json({
      tenant,
      owner: { id: owner.id, email: owner.email, role: owner.role },
      staff: { id: staffOwner.id, name: staffOwner.name, pin: DEFAULT_OWNER_PIN },
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Tenant or owner email already exists" });
      return;
    }
    logger.error({ err, tenantId: id }, "platform: failed to create tenant");
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

/* ───── PATCH /api/platform/tenants/:id — toggle active / rename / set expiry */
router.patch("/platform/tenants/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const updates: Record<string, unknown> = {};
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
  if (typeof req.body?.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim();
  if (req.body?.expiresAt !== undefined) {
    try { updates.expiresAt = resolveExpiry(req.body.expiresAt); }
    catch (e: any) { res.status(400).json({ error: e?.message ?? "Invalid expiresAt" }); return; }
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  try {
    const [tenant] = await db
      .update(tenantsTable)
      .set(updates)
      .where(eq(tenantsTable.id, id))
      .returning();
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    /* Split the audit verb so suspend/activate show up distinctly in the
       log instead of being lumped under a generic "tenant.update". */
    const action =
      updates.isActive === false ? "tenant.suspend" :
      updates.isActive === true  ? "tenant.activate" :
                                    "tenant.update";
    void recordAudit({
      action,
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenant.id,
      ip:           req.ip,
      metadata:     updates,
    });
    res.json({ tenant });
  } catch {
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

/* ───── POST /api/platform/tenants/:id/extend — push expiry forward ───
 *
 * Body: { duration: "7d" | "30d" | "90d" | "180d" | "365d" }
 *
 * If the tenant is currently expired (or has no expiry yet) the new date
 * is anchored to `now()`. If it's still active with a future expiry, the
 * duration is added on top so a renewal doesn't lose unused days.
 * Passing duration: "lifetime" clears the expiry entirely.
 */
router.post("/platform/tenants/:id/extend", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const duration = req.body?.duration;

  if (duration === "lifetime") {
    try {
      const [tenant] = await db
        .update(tenantsTable)
        .set({ expiresAt: null })
        .where(eq(tenantsTable.id, id))
        .returning();
      if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
      void recordAudit({
        action:       "tenant.extend",
        actorId:      req.platformActor!.id,
        actorEmail:   req.platformActor!.email,
        targetTenant: tenant.id,
        ip:           req.ip,
        metadata:     { duration: "lifetime", newExpiresAt: null },
      });
      res.json({ tenant });
    } catch { res.status(500).json({ error: "Failed to update tenant" }); }
    return;
  }

  if (typeof duration !== "string" || !(duration in PRESET_DURATIONS)) {
    res.status(400).json({ error: "duration must be 'lifetime' or one of 7d/30d/90d/180d/365d" });
    return;
  }

  try {
    const [existing] = await db
      .select({ expiresAt: tenantsTable.expiresAt })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Tenant not found" }); return; }

    const now = Date.now();
    const anchor = existing.expiresAt && existing.expiresAt.getTime() > now
      ? existing.expiresAt.getTime()
      : now;
    const newExpiry = new Date(anchor + PRESET_DURATIONS[duration]);

    const [tenant] = await db
      .update(tenantsTable)
      .set({ expiresAt: newExpiry })
      .where(eq(tenantsTable.id, id))
      .returning();
    void recordAudit({
      action:       "tenant.extend",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenant.id,
      ip:           req.ip,
      metadata: {
        duration,
        previousExpiresAt: existing.expiresAt,
        newExpiresAt:      newExpiry,
      },
    });
    res.json({ tenant });
  } catch {
    res.status(500).json({ error: "Failed to extend tenant" });
  }
});

/* ───── GET /api/platform/tenants/:id/users — list owners/staff ──── */
router.get("/platform/tenants/:id/users", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const emailUsers = await db
      .select({
        id:       authUsersTable.id,
        email:    authUsersTable.email,
        role:     authUsersTable.role,
        isActive: authUsersTable.isActive,
        lastLoginAt: authUsersTable.lastLoginAt,
      })
      .from(authUsersTable)
      .where(eq(authUsersTable.tenantId, id));
    res.json({ users: emailUsers });
  } catch {
    res.status(500).json({ error: "Failed to list users" });
  }
});

/* ───── POST /api/platform/tenants/:id/owner-password ─────────────── */
router.post("/platform/tenants/:id/owner-password", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const password = req.body?.password;
  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Password must be 8–128 chars" }); return;
  }
  try {
    const [owner] = await db
      .select({ id: authUsersTable.id, email: authUsersTable.email })
      .from(authUsersTable)
      .where(sql`${authUsersTable.tenantId} = ${tenantId} AND ${authUsersTable.role} = 'owner'`);
    if (!owner) { res.status(404).json({ error: "Owner not found for this tenant" }); return; }
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db
      .update(authUsersTable)
      .set({ passwordHash: hashed, updatedAt: new Date() })
      .where(eq(authUsersTable.id, owner.id));
    void recordAudit({
      action:       "tenant.owner_password_reset",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { ownerId: owner.id, ownerEmail: owner.email },
    });
    res.json({ ok: true, ownerEmail: owner.email });
  } catch {
    res.status(500).json({ error: "Failed to reset owner password" });
  }
});

/* ───── GET /api/platform/stats — top-line numbers ────────────────── */
router.get("/platform/stats", requirePlatformAdmin, async (_req, res): Promise<void> => {
  try {
    const [tenants]  = await db.select({ c: sql<number>`count(*)::int` }).from(tenantsTable);
    const [active]   = await db.select({ c: sql<number>`count(*)::int` }).from(tenantsTable).where(eq(tenantsTable.isActive, true));
    const [users]    = await db.select({ c: sql<number>`count(*)::int` }).from(authUsersTable);
    const [legacy]   = await db.select({ c: sql<number>`count(*)::int` }).from(authUsersTable).where(isNull(authUsersTable.tenantId));
    res.json({
      totalTenants:  tenants?.c ?? 0,
      activeTenants: active?.c ?? 0,
      totalUsers:    users?.c ?? 0,
      legacyUsers:   legacy?.c ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;
