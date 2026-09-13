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
import { eq, sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  authUsersTable,
  tenantsTable,
  staffProfilesTable,
  staffPermissionsTable,
  storeSettingsTable,
  platformSettingsTable,
  productsTable,
  salesTable,
  auditEventsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { recordAudit } from "../lib/audit";
import { requirePlatformAdmin } from "../middlewares/platform-admin";
import { anchorExtension, resolveExpiry, PRESET_DURATIONS } from "../lib/tenant-access";
import { runDatabaseBackup } from "../lib/backup";
import { resolveBackupKey, BackupKeyError } from "../lib/backup-crypto";
import { recentRuns } from "../lib/backup-runs";
import { INTRADAY_CHOICES, describeNextNightly } from "../lib/backup-schedule";
import { isConfigured as telegramConfigured } from "../lib/telegram";
import { isR2Configured, listR2Backups, downloadR2Backup, isBackupKey } from "../lib/r2";
import { getBackupSettings, applyBackupSettings, getBackupFreshness } from "../lib/backup-scheduler";
import {
  restoreDatabaseBackup, restoreSnapshot, restoreTenantSnapshot, previewTenantRestore,
  parseSnapshotBytes, isEncryptedBackup,
} from "../lib/restore";
import multer from "multer";
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
  "dashboard", "products", "productEntry", "stockEntry", "scan", "billing",
  "logs", "stockAlert", "productReports", "reports", "analytics", "customers",
  "categories", "labels", "suppliers", "deals", "staff", "settings",
] as const;

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LEN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE  = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

function isValidEmail(e: unknown): e is string {
  return typeof e === "string" && EMAIL_RE.test(e) && e.length <= 254;
}

function isValidPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD_LEN && pw.length <= 128;
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
        maxStaff:  tenantsTable.maxStaff,
        maxProducts: tenantsTable.maxProducts,
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
    /* Pre-compute the slow bcrypt hashes OUTSIDE the transaction so the DB
       transaction stays short (no connection is held open during hashing). */
    const hashedPwd = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const hashedPin = await bcrypt.hash(DEFAULT_OWNER_PIN, BCRYPT_ROUNDS);

    /* Provision the tenant ATOMICALLY: tenant row + owner email-login + staff
       profile + permissions + store_settings all commit together or not at
       all. Previously these were five independent writes, so a failure midway
       could strand a half-created tenant (e.g. a login with no staff profile,
       leaving the owner stuck at "No staff accounts found"). */
    const { tenant, owner, staffOwner } = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenantsTable)
        .values({ id, name, expiresAt })
        .returning();

      /* 1. Email-login row (used at /login). */
      const [owner] = await tx
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
      const [staffOwner] = await tx
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
      await tx
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
         with default=1, so we pick the next free id explicitly — inside the
         same transaction so it can't race a concurrent onboarding. */
      const [maxRow] = await tx
        .select({ nextId: sql<number>`COALESCE(MAX(${storeSettingsTable.id}), 0) + 1` })
        .from(storeSettingsTable);
      const settingsId = Number(maxRow?.nextId) || 2;
      /* Minimal seed — only the shop name is pre-filled (from the tenant's
         display name). Everything else is blank so the client fills it in
         from Settings on first login. */
      await tx
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

      return { tenant, owner, staffOwner };
    });

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

  /* Per-shop caps. null/"" clears the cap back to unlimited; anything else
     must be a sane whole number. */
  for (const key of ["maxStaff", "maxProducts"] as const) {
    if (req.body?.[key] === undefined) continue;
    const raw = req.body[key];
    if (raw === null || raw === "") { updates[key] = null; continue; }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 100_000) {
      res.status(400).json({ error: `${key === "maxStaff" ? "Staff" : "Product"} limit must be a whole number of at least 1, or empty for unlimited` });
      return;
    }
    updates[key] = n;
  }

  /* Optional owner-email change. Targets the SAME owner the panel displays
     (earliest-created) and is applied in the same transaction as the tenant
     update so a rename + email change can never half-apply. */
  let newOwnerEmail: string | null = null;
  if (req.body?.ownerEmail !== undefined) {
    if (!isValidEmail(req.body.ownerEmail)) {
      res.status(400).json({ error: "Valid owner email required" }); return;
    }
    newOwnerEmail = String(req.body.ownerEmail).trim().toLowerCase();
  }

  if (Object.keys(updates).length === 0 && newOwnerEmail == null) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  try {
    const { tenant, ownerEmailChanged } = await db.transaction(async (tx) => {
      let tenant: typeof tenantsTable.$inferSelect | undefined;
      if (Object.keys(updates).length > 0) {
        [tenant] = await tx
          .update(tenantsTable)
          .set(updates)
          .where(eq(tenantsTable.id, id))
          .returning();
      } else {
        [tenant] = await tx
          .select()
          .from(tenantsTable)
          .where(eq(tenantsTable.id, id));
      }
      /* Throw (not return) on the not-found paths so the surrounding
         transaction rolls back any tenant update already staged above. */
      if (!tenant) throw Object.assign(new Error("Tenant not found"), { httpStatus: 404 });

      let ownerEmailChanged: string | undefined;
      if (newOwnerEmail != null) {
        const [owner] = await tx
          .select({ id: authUsersTable.id })
          .from(authUsersTable)
          .where(sql`${authUsersTable.tenantId} = ${id} AND ${authUsersTable.role} = 'owner'`)
          .orderBy(authUsersTable.createdAt);
        if (!owner) throw Object.assign(new Error("Owner not found for this tenant"), { httpStatus: 404 });
        await tx
          .update(authUsersTable)
          .set({ email: newOwnerEmail, updatedAt: new Date() })
          .where(eq(authUsersTable.id, owner.id));
        ownerEmailChanged = newOwnerEmail;
      }
      return { tenant, ownerEmailChanged };
    });

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
      metadata:     { ...updates, ...(ownerEmailChanged ? { ownerEmail: ownerEmailChanged } : {}) },
    });
    res.json({ tenant });
  } catch (err: any) {
    if (err?.httpStatus) { res.status(err.httpStatus).json({ error: err.message }); return; }
    if (err?.code === "23505") { res.status(409).json({ error: "That email is already in use by another login" }); return; }
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
    res.status(400).json({ error: "duration must be 'lifetime' or one of 3d/7d/30d/90d/180d/365d" });
    return;
  }

  try {
    const [existing] = await db
      .select({ expiresAt: tenantsTable.expiresAt })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Tenant not found" }); return; }

    const newExpiry = anchorExtension(existing.expiresAt, PRESET_DURATIONS[duration]);

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
        id:          authUsersTable.id,
        email:       authUsersTable.email,
        role:        authUsersTable.role,
        isActive:    authUsersTable.isActive,
        lastLoginAt: authUsersTable.lastLoginAt,
        createdAt:   authUsersTable.createdAt,
      })
      .from(authUsersTable)
      .where(eq(authUsersTable.tenantId, id))
      .orderBy(authUsersTable.createdAt);
    /* PIN-based staff profiles live in a separate table from the email logins
       above; the panel shows both so the vendor sees the full roster. */
    const staff = await db
      .select({
        id:             staffProfilesTable.id,
        name:           staffProfilesTable.name,
        role:           staffProfilesTable.role,
        isActive:       staffProfilesTable.isActive,
        lockedUntil:    staffProfilesTable.lockedUntil,
        failedAttempts: staffProfilesTable.failedAttempts,
        createdAt:      staffProfilesTable.createdAt,
      })
      .from(staffProfilesTable)
      .where(eq(staffProfilesTable.tenantId, id))
      .orderBy(staffProfilesTable.createdAt);
    res.json({ users: emailUsers, staff });
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
    /* Order by creation time so we deterministically target the SAME owner the
       admin panel displays (the earliest-created one) when a tenant somehow
       has more than one owner row. */
    const [owner] = await db
      .select({ id: authUsersTable.id, email: authUsersTable.email })
      .from(authUsersTable)
      .where(sql`${authUsersTable.tenantId} = ${tenantId} AND ${authUsersTable.role} = 'owner'`)
      .orderBy(authUsersTable.createdAt);
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
    /* "Legacy NULL" = real tenant-less data left over from before multi-tenancy.
       Exclude the vendor's own platform_admin accounts (also tenant_id NULL by
       design) so they don't inflate this number. */
    const [legacy]   = await db.select({ c: sql<number>`count(*)::int` }).from(authUsersTable).where(sql`${authUsersTable.tenantId} IS NULL AND ${authUsersTable.role} <> 'platform_admin'`);
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

/* ───── GET /api/platform/audit — recent platform-admin actions ─────
 *
 * Read-only view over the append-only audit_events log. Optional
 * `?tenant=<id>` narrows to one tenant; `?limit=` caps rows (default 100,
 * max 200). Newest first.
 */
router.get("/platform/audit", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenant = typeof req.query.tenant === "string" && req.query.tenant.trim()
    ? req.query.tenant.trim()
    : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  try {
    const cols = {
      id:           auditEventsTable.id,
      action:       auditEventsTable.action,
      actorEmail:   auditEventsTable.actorEmail,
      targetTenant: auditEventsTable.targetTenant,
      ip:           auditEventsTable.ip,
      metadata:     auditEventsTable.metadata,
      createdAt:    auditEventsTable.createdAt,
    };
    const events = tenant
      ? await db.select(cols).from(auditEventsTable)
          .where(eq(auditEventsTable.targetTenant, tenant))
          .orderBy(desc(auditEventsTable.createdAt)).limit(limit)
      : await db.select(cols).from(auditEventsTable)
          .orderBy(desc(auditEventsTable.createdAt)).limit(limit);
    res.json({ events });
  } catch {
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

/* ───── Platform-wide settings (global, NOT per-tenant) ─────────────
 *
 * A single-row `platform_settings` store (id = 1) holds vendor-level config.
 * Today that's just the public subscription pricing shown on the marketing
 * landing page: the deal price and the struck-through "original" price. The
 * per-month / per-day figures the landing page shows are DERIVED from the deal
 * price (÷ 12, ÷ 365) on the client — never stored — so they can't drift.
 */
const PLATFORM_SETTINGS_ID = 1;
const DEFAULT_PRICING = { dealPrice: 4999, originalPrice: 9999 } as const;

/** Read the singleton settings blob. Returns {} on any miss/error so callers
 *  fall back to defaults rather than failing. */
async function readPlatformSettings(): Promise<Record<string, unknown>> {
  try {
    const [row] = await db
      .select({ data: platformSettingsTable.data })
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.id, PLATFORM_SETTINGS_ID));
    return (row?.data as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/** Coerce stored settings into a valid pricing pair, defaulting any
 *  missing/invalid field. */
function pricingFromSettings(data: Record<string, unknown>): { dealPrice: number; originalPrice: number } {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };
  return {
    dealPrice:     num(data.dealPrice,     DEFAULT_PRICING.dealPrice),
    originalPrice: num(data.originalPrice, DEFAULT_PRICING.originalPrice),
  };
}

/* ───── GET /api/public/pricing — PUBLIC subscription pricing ─────────
 *
 * No auth: the marketing landing page fetches this before any session exists.
 * Reachable because platformRouter mounts BEFORE the tenant/auth gates, so this
 * handler responds and short-circuits before either gate runs. Returns the two
 * rupee amounts; the client derives ₹/month and ₹/day from the deal price.
 */
router.get("/public/pricing", async (_req, res): Promise<void> => {
  const data = await readPlatformSettings();
  res.json(pricingFromSettings(data));
});

/* ───── GET /api/platform/settings — vendor view of global settings ─── */
router.get("/platform/settings", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const data = await readPlatformSettings();
  res.json({ pricing: pricingFromSettings(data) });
});

/* ───── PATCH /api/platform/settings — update subscription pricing ────
 *
 * Body: { dealPrice: number, originalPrice: number } — whole rupees.
 */
router.patch("/platform/settings", requirePlatformAdmin, async (req, res): Promise<void> => {
  const isRupee = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= 100_000_000;
  const dealPrice     = req.body?.dealPrice;
  const originalPrice = req.body?.originalPrice;
  if (!isRupee(dealPrice) || !isRupee(originalPrice)) {
    res.status(400).json({ error: "dealPrice and originalPrice must be whole rupee amounts (0–100000000)" });
    return;
  }
  try {
    const existing = await readPlatformSettings();
    const nextData = { ...existing, dealPrice, originalPrice };
    await db
      .insert(platformSettingsTable)
      .values({ id: PLATFORM_SETTINGS_ID, data: nextData })
      .onConflictDoUpdate({
        target: platformSettingsTable.id,
        set:    { data: nextData, updatedAt: new Date() },
      });
    void recordAudit({
      action:     "platform.pricing_update",
      actorId:    req.platformActor!.id,
      actorEmail: req.platformActor!.email,
      ip:         req.ip,
      metadata:   { dealPrice, originalPrice },
    });
    res.json({ pricing: { dealPrice, originalPrice } });
  } catch {
    res.status(500).json({ error: "Failed to save pricing" });
  }
});

/* ───── POST /api/platform/backup — on-demand DB backup ───
 *
 * Runs the same routine as the nightly scheduled job, immediately, so the
 * vendor can verify backups work (and grab an ad-hoc copy) without waiting for
 * 02:30 IST. Awaits the send so the response reflects success/failure.
 */
router.post("/platform/backup", requirePlatformAdmin, async (req, res): Promise<void> => {
  try {
    const summary = await runDatabaseBackup({ kind: "manual" });
    void recordAudit({
      action:     "platform.backup",
      actorId:    req.platformActor!.id,
      actorEmail: req.platformActor!.email,
      ip:         req.ip,
      metadata:   { tables: summary.tables, totalRows: summary.totalRows, sizeBytes: summary.sizeBytes, encrypted: summary.encrypted, r2: summary.destinations.r2, telegram: summary.destinations.telegram },
    });
    res.json({ ok: true, ...summary });
  } catch (err: any) {
    logger.error({ err }, "manual database backup failed");
    res.status(500).json({ error: err?.message || "Backup failed — check server logs" });
  }
});

/** Encryption state for the admin page — never the key itself. */
function encryptionStatus(): { enabled: boolean; problem: string | null } {
  try {
    return { enabled: resolveBackupKey() !== null, problem: null };
  } catch (err) {
    return { enabled: false, problem: err instanceof BackupKeyError ? err.message : "BACKUP_ENCRYPTION_KEY is invalid" };
  }
}

/* ───── GET /api/platform/backups — status, config, ledger, stored files ───── */
router.get("/platform/backups", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const settings = getBackupSettings();
  const base = {
    r2Configured:       isR2Configured(),
    telegramConfigured: telegramConfigured(),
    encryption:         encryptionStatus(),
    backupHour:         settings.backupHour,
    intradayEveryHours: settings.intradayEveryHours,
    intradayChoices:    INTRADAY_CHOICES,
    nextNightly:        describeNextNightly(new Date(), settings),
    monitorPath:        "/api/healthz/backup",
  };
  const [freshness, runs] = await Promise.all([
    getBackupFreshness().catch((err) => { logger.error({ err }, "backup freshness failed"); return null; }),
    recentRuns(12).catch((err) => { logger.error({ err }, "backup_runs read failed"); return []; }),
  ]);
  if (!base.r2Configured) { res.json({ ...base, freshness, runs, files: [] }); return; }
  try {
    res.json({ ...base, freshness, runs, files: await listR2Backups() });
  } catch (err) {
    logger.error({ err }, "failed to list R2 backups");
    res.json({ ...base, freshness, runs, files: [], listError: "Could not reach Cloudflare R2 — check the R2_* credentials" });
  }
});

/* ───── PUT /api/platform/backup-settings — nightly hour / intraday interval ─
 * Persists to platform_settings AND applies to this process immediately; the
 * other process (workspace vs deployment) picks the change up on its next
 * one-minute tick. Nightly minute is fixed :30. */
router.put("/platform/backup-settings", requirePlatformAdmin, async (req, res): Promise<void> => {
  const hour  = req.body?.hour;
  const every = req.body?.intradayEveryHours;
  if (hour !== undefined && (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23)) {
    res.status(400).json({ error: "hour must be an integer 0–23 (IST)" });
    return;
  }
  if (every !== undefined && !(INTRADAY_CHOICES as readonly number[]).includes(every)) {
    res.status(400).json({ error: `intradayEveryHours must be one of ${INTRADAY_CHOICES.join(", ")} (0 = off)` });
    return;
  }
  if (hour === undefined && every === undefined) {
    res.status(400).json({ error: "Nothing to change" });
    return;
  }
  if (every !== undefined && every > 0 && !isR2Configured()) {
    res.status(400).json({ error: "Intraday backups need Cloudflare R2 (R2_* env vars) — they are not sent to Telegram" });
    return;
  }
  try {
    const existing = await readPlatformSettings();
    const nextData = {
      ...existing,
      ...(hour  !== undefined ? { backupHour: hour } : {}),
      ...(every !== undefined ? { intradayEveryHours: every } : {}),
    };
    await db
      .insert(platformSettingsTable)
      .values({ id: PLATFORM_SETTINGS_ID, data: nextData })
      .onConflictDoUpdate({
        target: platformSettingsTable.id,
        set:    { data: nextData, updatedAt: new Date() },
      });
    const applied = applyBackupSettings({ backupHour: hour, intradayEveryHours: every });
    void recordAudit({
      action:     "platform.backup_schedule_update",
      actorId:    req.platformActor!.id,
      actorEmail: req.platformActor!.email,
      ip:         req.ip,
      metadata:   { ...applied },
    });
    res.json({ ok: true, ...applied, nextNightly: describeNextNightly(new Date(), applied) });
  } catch (err) {
    logger.error({ err }, "failed to save backup settings");
    res.status(500).json({ error: "Failed to save backup settings" });
  }
});

/* ───── GET /api/platform/backups/preview?key=&tenantId= — what's inside ─────
 * Downloads the snapshot from R2, opens it (decrypting if needed) and returns
 * ONLY the metadata + per-table row counts — never the row data itself (it
 * holds password hashes and every tenant's records; the full file is available
 * via /download). With tenantId, adds what a per-shop restore would change. */
router.get("/platform/backups/preview", requirePlatformAdmin, async (req, res): Promise<void> => {
  const key      = String(req.query.key ?? "");
  const tenantId = req.query.tenantId ? String(req.query.tenantId) : null;
  if (!isBackupKey(key)) { res.status(400).json({ error: "Invalid backup key" }); return; }
  if (!isR2Configured())  { res.status(400).json({ error: "Cloudflare R2 is not configured" }); return; }
  let bytes: Buffer;
  try {
    bytes = await downloadR2Backup(key);
  } catch (err) {
    logger.error({ err, key }, "backup download for preview failed");
    res.status(500).json({ error: "Could not download that backup file" });
    return;
  }
  try {
    const snapshot = parseSnapshotBytes(bytes);
    const tables = Object.entries(snapshot.data)
      .map(([name, rows]) => ({ name, rows: rows.length }))
      .sort((a, b) => b.rows - a.rows);
    const tenant = tenantId ? await previewTenantRestore(bytes, tenantId) : null;
    res.json({
      key,
      sizeBytes: bytes.length,
      encrypted: isEncryptedBackup(bytes),
      meta:      snapshot.meta,
      tables,
      tenant,
    });
  } catch (err: any) {
    logger.error({ err, key, tenantId }, "backup preview failed");
    /* The open/validate errors are written for the admin (wrong key, corrupt
       file, unknown shop) — pass them through. */
    res.status(400).json({ error: err?.message || "Could not read that backup file" });
  }
});

/* ───── POST /api/platform/backups/restore — replace the DB with a snapshot ─
 * The nuclear option, so belt and braces: the client must echo confirm:
 * "RESTORE", a safety backup of the CURRENT data is taken first (abort if it
 * fails), and the whole restore runs in one transaction — any failure rolls
 * back to the pre-restore state. Without tenantId it affects EVERY tenant;
 * with tenantId only that shop's rows are replaced (see restoreTenantSnapshot). */
router.post("/platform/backups/restore", requirePlatformAdmin, async (req, res): Promise<void> => {
  const key      = String(req.body?.key ?? "");
  const confirm  = String(req.body?.confirm ?? "");
  const tenantId = req.body?.tenantId ? String(req.body.tenantId) : null;
  if (!isBackupKey(key)) { res.status(400).json({ error: "Invalid backup key" }); return; }
  if (confirm !== "RESTORE") { res.status(400).json({ error: 'Confirmation missing — type RESTORE to proceed' }); return; }
  if (!isR2Configured())  { res.status(400).json({ error: "Cloudflare R2 is not configured" }); return; }
  try {
    if (tenantId) {
      const summary = await restoreTenantSnapshot(await downloadR2Backup(key), tenantId, { source: key });
      void recordAudit({
        action:     "platform.backup_restore_tenant",
        actorId:    req.platformActor!.id,
        actorEmail: req.platformActor!.email,
        ip:         req.ip,
        targetTenant: tenantId,
        metadata:   { key, tables: summary.tables.length, rowsDeleted: summary.rowsDeleted, rowsRestored: summary.rowsRestored, safetyBackup: summary.safetyBackup },
      });
      res.json({ ok: true, scope: "tenant", ...summary });
      return;
    }
    const summary = await restoreDatabaseBackup(key);
    void recordAudit({
      action:     "platform.backup_restore",
      actorId:    req.platformActor!.id,
      actorEmail: req.platformActor!.email,
      ip:         req.ip,
      metadata:   { key, tables: summary.tables, rowsRestored: summary.rowsRestored, safetyBackup: summary.safetyBackup },
    });
    res.json({ ok: true, scope: "platform", ...summary });
  } catch (err: any) {
    logger.error({ err, key, tenantId }, "database restore failed");
    res.status(500).json({ error: err?.message || "Restore failed — the database was left unchanged" });
  }
});

/* ───── POST /api/platform/backups/restore-upload — restore from a file ─────
 * The nightly backup can deliver to Telegram, but restore could previously only
 * read from Cloudflare R2. A shop with only Telegram configured therefore had
 * backups it had no way to restore — the worst kind of backup. This accepts the
 * .json.gz (or .json.gz.enc) directly, so the copy sitting in a Telegram chat
 * is enough to recover. Same protections as the R2 path: platform admin, typed
 * confirmation, safety backup first, one transaction; optional tenantId for a
 * per-shop restore. */
const backupUpload = multer({
  storage: multer.memoryStorage(),
  /* Comfortably above Telegram's own 50 MB document ceiling, so any file the
     backup job could have sent is accepted. */
  limits: { fileSize: 64 * 1024 * 1024 },
});

router.post(
  "/platform/backups/restore-upload",
  requirePlatformAdmin,
  backupUpload.single("file"),
  async (req, res): Promise<void> => {
    const confirm  = String(req.body?.confirm ?? "");
    const tenantId = req.body?.tenantId ? String(req.body.tenantId) : null;
    if (confirm !== "RESTORE") {
      res.status(400).json({ error: 'Confirmation missing — type RESTORE to proceed' });
      return;
    }
    if (!req.file?.buffer?.length) {
      res.status(400).json({ error: "No backup file uploaded" });
      return;
    }
    const source = req.file.originalname || "uploaded snapshot";
    try {
      if (tenantId) {
        const summary = await restoreTenantSnapshot(req.file.buffer, tenantId, { source });
        void recordAudit({
          action:     "platform.backup_restore_upload_tenant",
          actorId:    req.platformActor!.id,
          actorEmail: req.platformActor!.email,
          ip:         req.ip,
          targetTenant: tenantId,
          metadata:   { filename: req.file.originalname, sizeBytes: req.file.size, tables: summary.tables.length, rowsDeleted: summary.rowsDeleted, rowsRestored: summary.rowsRestored, safetyBackup: summary.safetyBackup },
        });
        res.json({ ok: true, scope: "tenant", ...summary });
        return;
      }
      const summary = await restoreSnapshot(req.file.buffer, { source });
      void recordAudit({
        action:     "platform.backup_restore_upload",
        actorId:    req.platformActor!.id,
        actorEmail: req.platformActor!.email,
        ip:         req.ip,
        metadata:   {
          filename:     req.file.originalname,
          sizeBytes:    req.file.size,
          tables:       summary.tables,
          rowsRestored: summary.rowsRestored,
          safetyBackup: summary.safetyBackup,
        },
      });
      res.json({ ok: true, scope: "platform", ...summary });
    } catch (err: any) {
      logger.error({ err, filename: req.file?.originalname, tenantId }, "database restore from upload failed");
      res.status(500).json({ error: err?.message || "Restore failed — the database was left unchanged" });
    }
  },
);

/* ───── GET /api/platform/backups/download?key= — fetch the stored file ───── */
router.get("/platform/backups/download", requirePlatformAdmin, async (req, res): Promise<void> => {
  const key = String(req.query.key ?? "");
  if (!isBackupKey(key)) { res.status(400).json({ error: "Invalid backup key" }); return; }
  if (!isR2Configured())  { res.status(400).json({ error: "Cloudflare R2 is not configured" }); return; }
  try {
    const bytes = await downloadR2Backup(key);
    void recordAudit({
      action:     "platform.backup_download",
      actorId:    req.platformActor!.id,
      actorEmail: req.platformActor!.email,
      ip:         req.ip,
      metadata:   { key, sizeBytes: bytes.length },
    });
    res.setHeader("Content-Type", key.endsWith(".enc") ? "application/octet-stream" : "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${key.slice(key.lastIndexOf("/") + 1)}"`);
    res.send(bytes);
  } catch (err) {
    logger.error({ err, key }, "backup download failed");
    res.status(500).json({ error: "Could not download that backup file" });
  }
});

export default router;
