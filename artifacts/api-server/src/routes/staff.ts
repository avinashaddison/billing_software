import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, staffProfilesTable, staffPermissionsTable } from "@workspace/db";

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
router.get("/staff", async (_req, res): Promise<void> => {
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

    res.json({ id: member.id, name: member.name, role: member.role, permissions });
  } catch { res.status(500).json({ error: "Login failed" }); }
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
      .values({ name: name.trim(), pin: hashed, role: safeRole })
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
      .where(eq(staffProfilesTable.id, req.params.id))
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
      .where(eq(staffProfilesTable.id, req.params.id))
      .returning();
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete staff member" }); }
});

/* ── GET /api/staff/:id/permissions ─────────────────────────────── */
router.get("/staff/:id/permissions", async (req, res): Promise<void> => {
  try {
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
    for (const [resource, level] of Object.entries(permissions)) {
      if (!VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) continue;
      await db
        .insert(staffPermissionsTable)
        .values({ staffId: req.params.id, resource, level: String(level) })
        .onConflictDoUpdate({
          target: [staffPermissionsTable.staffId, staffPermissionsTable.resource],
          set: { level: String(level) },
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
