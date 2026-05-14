import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, staffProfilesTable, staffPermissionsTable } from "@workspace/db";
import { tenantWhere } from "../lib/tenant";
import {
  TENANT_COOKIE_NAME,
  signTenantCookie,
  tenantCookieOptions,
} from "../middlewares/tenant";

const router: IRouter = Router();

const VALID_LEVELS = ["none", "read", "write"] as const;
const VALID_ROLES  = ["owner", "staff"] as const;
const BCRYPT_ROUNDS = 10;
const MAX_ATTEMPTS  = 5;
const LOCK_MINUTES  = 30;

/** Hash a 4-digit PIN */
async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

/** Safely compare plain PIN vs stored hash (works for both bcrypt and legacy plain) */
async function checkPin(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) return bcrypt.compare(plain, stored);
  return plain === stored; // fallback for pre-migration rows (migrated immediately below)
}

/* ── GET /api/staff ─────────────────────────────────────────────── */
router.get("/staff", async (req, res): Promise<void> => {
  try {
    const staff = await db
      .select({
        id:        staffProfilesTable.id,
        name:      staffProfilesTable.name,
        role:      staffProfilesTable.role,
        isActive:  staffProfilesTable.isActive,
        lockedUntil: staffProfilesTable.lockedUntil,
        createdAt: staffProfilesTable.createdAt,
      })
      .from(staffProfilesTable)
      .where(tenantWhere(staffProfilesTable.tenantId, req.tenantId))
      .orderBy(asc(staffProfilesTable.createdAt));
    res.json(staff);
  } catch { res.status(500).json({ error: "Failed to fetch staff" }); }
});

/* ── POST /api/auth/login ───────────────────────────────────────── */
router.post("/auth/login", async (req, res): Promise<void> => {
  const { staffId, pin } = req.body ?? {};
  if (!staffId || !pin) { res.status(400).json({ error: "staffId and pin required" }); return; }
  if (!/^\d{4}$/.test(String(pin))) { res.status(400).json({ error: "PIN must be 4 digits" }); return; }

  try {
    /* Login does NOT pre-filter by req.tenantId — the staffId itself is
       the routing key. The login result then ESTABLISHES the tenant
       for subsequent requests by issuing the signed cookie. */
    const [member] = await db.select().from(staffProfilesTable).where(eq(staffProfilesTable.id, staffId));
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    if (!member.isActive) { res.status(403).json({ error: "Account is inactive" }); return; }

    /* ── Lockout check ── */
    if (member.lockedUntil && member.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((member.lockedUntil.getTime() - Date.now()) / 60_000);
      res.status(429).json({
        error: "too_many_attempts",
        message: `Too many wrong PINs. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
        lockedUntil: member.lockedUntil.toISOString(),
      });
      return;
    }

    /* ── If previously locked and time has passed, reset counter ── */
    if (member.lockedUntil && member.lockedUntil <= new Date()) {
      await db.update(staffProfilesTable)
        .set({ failedAttempts: 0, lockedUntil: null })
        .where(eq(staffProfilesTable.id, staffId));
      member.failedAttempts = 0;
      member.lockedUntil    = null;
    }

    /* ── PIN verification ── */
    const pinOk = await checkPin(String(pin), member.pin);

    /* Auto-migrate plain-text PINs to bcrypt on successful login */
    if (pinOk && !member.pin.startsWith("$2")) {
      const hashed = await hashPin(String(pin));
      await db.update(staffProfilesTable).set({ pin: hashed }).where(eq(staffProfilesTable.id, staffId));
    }

    if (!pinOk) {
      const newAttempts = (member.failedAttempts ?? 0) + 1;
      const shouldLock  = newAttempts >= MAX_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : null;

      await db.update(staffProfilesTable)
        .set({ failedAttempts: newAttempts, ...(shouldLock ? { lockedUntil } : {}) })
        .where(eq(staffProfilesTable.id, staffId));

      const remaining = MAX_ATTEMPTS - newAttempts;
      if (shouldLock) {
        res.status(429).json({
          error: "too_many_attempts",
          message: `Too many wrong PINs. Account locked for ${LOCK_MINUTES} minutes.`,
          lockedUntil: lockedUntil!.toISOString(),
        });
      } else {
        res.status(401).json({
          error: "wrong_pin",
          message: `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
          attemptsLeft: remaining,
        });
      }
      return;
    }

    /* ── Success — reset failed counter ── */
    await db.update(staffProfilesTable)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(staffProfilesTable.id, staffId));

    const perms = await db.select().from(staffPermissionsTable).where(eq(staffPermissionsTable.staffId, staffId));
    const permissions: Record<string, string> = {};
    for (const p of perms) permissions[p.resource] = p.level;

    /* ── Issue signed tenant_session cookie ──
       member.tenantId is null for legacy Hira & Sons staff → cookie
       carries null and downstream queries match the IS-NULL branch. */
    res.cookie(
      TENANT_COOKIE_NAME,
      signTenantCookie(member.tenantId ?? null, member.id),
      tenantCookieOptions(),
    );

    res.json({
      id: member.id,
      name: member.name,
      role: member.role,
      tenantId: member.tenantId ?? null,
      permissions,
    });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

/* ── POST /api/auth/logout ──────────────────────────────────────── */
router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

/* ── GET /api/auth/me — who am I per the cookie? ───────────────── */
router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.staffId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const [member] = await db
      .select({
        id:       staffProfilesTable.id,
        name:     staffProfilesTable.name,
        role:     staffProfilesTable.role,
        tenantId: staffProfilesTable.tenantId,
        isActive: staffProfilesTable.isActive,
      })
      .from(staffProfilesTable)
      .where(eq(staffProfilesTable.id, req.staffId));
    if (!member || !member.isActive) {
      res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const perms = await db
      .select()
      .from(staffPermissionsTable)
      .where(eq(staffPermissionsTable.staffId, member.id));
    const permissions: Record<string, string> = {};
    for (const p of perms) permissions[p.resource] = p.level;
    res.json({ ...member, permissions });
  } catch { res.status(500).json({ error: "Failed to load session" }); }
});

/* ── POST /api/staff ── create ──────────────────────────────────── */
router.post("/staff", async (req, res): Promise<void> => {
  const { name, pin, role } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters" }); return;
  }
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" }); return;
  }
  const safeRole = VALID_ROLES.includes(role) ? role : "staff";

  try {
    const hashed = await hashPin(String(pin));
    const [member] = await db
      .insert(staffProfilesTable)
      .values({
        name: name.trim(),
        pin: hashed,
        role: safeRole,
        tenantId: req.tenantId, // new staff inherit the creator's tenant
      })
      .returning({ id: staffProfilesTable.id, name: staffProfilesTable.name, role: staffProfilesTable.role, isActive: staffProfilesTable.isActive, createdAt: staffProfilesTable.createdAt });
    res.status(201).json(member);
  } catch { res.status(500).json({ error: "Failed to create staff member" }); }
});

/* ── PUT /api/staff/:id ── update ───────────────────────────────── */
router.put("/staff/:id", async (req, res): Promise<void> => {
  const { name, pin, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" }); return;
    }
    updates.name = name.trim();
  }
  if (pin !== undefined) {
    if (!/^\d{4}$/.test(String(pin))) {
      res.status(400).json({ error: "PIN must be exactly 4 digits" }); return;
    }
    updates.pin = await hashPin(String(pin));
    updates.failedAttempts = 0;   // reset lockout when PIN is changed
    updates.lockedUntil    = null;
  }
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  try {
    const [member] = await db
      .update(staffProfilesTable)
      .set(updates)
      .where(and(
        eq(staffProfilesTable.id, req.params.id),
        tenantWhere(staffProfilesTable.tenantId, req.tenantId),
      ))
      .returning({ id: staffProfilesTable.id, name: staffProfilesTable.name, role: staffProfilesTable.role, isActive: staffProfilesTable.isActive, createdAt: staffProfilesTable.createdAt });
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    res.json(member);
  } catch { res.status(500).json({ error: "Failed to update staff member" }); }
});

/* ── DELETE /api/staff/:id ── delete ────────────────────────────── */
router.delete("/staff/:id", async (req, res): Promise<void> => {
  try {
    const [member] = await db
      .delete(staffProfilesTable)
      .where(and(
        eq(staffProfilesTable.id, req.params.id),
        tenantWhere(staffProfilesTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete staff member" }); }
});

/* ── GET /api/staff/:id/permissions ─────────────────────────────── */
router.get("/staff/:id/permissions", async (req, res): Promise<void> => {
  try {
    /* Ensure the staff row belongs to the caller's tenant before
       returning permissions — prevents cross-tenant permission leaks. */
    const [member] = await db
      .select({ id: staffProfilesTable.id })
      .from(staffProfilesTable)
      .where(and(
        eq(staffProfilesTable.id, req.params.id),
        tenantWhere(staffProfilesTable.tenantId, req.tenantId),
      ));
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }

    const perms = await db
      .select()
      .from(staffPermissionsTable)
      .where(eq(staffPermissionsTable.staffId, req.params.id));
    const map: Record<string, string> = {};
    for (const p of perms) map[p.resource] = p.level;
    res.json(map);
  } catch { res.status(500).json({ error: "Failed to fetch permissions" }); }
});

/* ── PUT /api/staff/:id/permissions ─────────────────────────────── */
router.put("/staff/:id/permissions", async (req, res): Promise<void> => {
  const { permissions } = req.body ?? {};
  if (!permissions || typeof permissions !== "object") {
    res.status(400).json({ error: "permissions object required" }); return;
  }

  try {
    /* Confirm the staff row is in the caller's tenant before mutating. */
    const [member] = await db
      .select({ id: staffProfilesTable.id, tenantId: staffProfilesTable.tenantId })
      .from(staffProfilesTable)
      .where(and(
        eq(staffProfilesTable.id, req.params.id),
        tenantWhere(staffProfilesTable.tenantId, req.tenantId),
      ));
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }

    for (const [resource, level] of Object.entries(permissions)) {
      if (!VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) continue;
      await db
        .insert(staffPermissionsTable)
        .values({
          staffId: req.params.id,
          resource,
          level: String(level),
          tenantId: member.tenantId, // mirror the staff row's tenant
        })
        .onConflictDoUpdate({
          target: [staffPermissionsTable.staffId, staffPermissionsTable.resource],
          set: { level: String(level), tenantId: member.tenantId },
        });
    }
    const updated = await db
      .select()
      .from(staffPermissionsTable)
      .where(eq(staffPermissionsTable.staffId, req.params.id));
    const map: Record<string, string> = {};
    for (const p of updated) map[p.resource] = p.level;
    res.json(map);
  } catch { res.status(500).json({ error: "Failed to update permissions" }); }
});

export default router;
