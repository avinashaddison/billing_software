import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, staffProfilesTable, staffPermissionsTable } from "@workspace/db";

const router: IRouter = Router();

const VALID_LEVELS = ["none", "read", "write"] as const;
const VALID_ROLES  = ["owner", "staff"] as const;

/* ── GET /api/staff ─────────────────────────────────────────────── */
router.get("/staff", async (_req, res): Promise<void> => {
  try {
    const staff = await db
      .select({ id: staffProfilesTable.id, name: staffProfilesTable.name, role: staffProfilesTable.role, isActive: staffProfilesTable.isActive, createdAt: staffProfilesTable.createdAt })
      .from(staffProfilesTable)
      .orderBy(asc(staffProfilesTable.createdAt));
    res.json(staff);
  } catch { res.status(500).json({ error: "Failed to fetch staff" }); }
});

/* ── POST /api/auth/login ───────────────────────────────────────── */
router.post("/auth/login", async (req, res): Promise<void> => {
  const { staffId, pin } = req.body ?? {};
  if (!staffId || !pin) { res.status(400).json({ error: "staffId and pin required" }); return; }

  try {
    const [member] = await db.select().from(staffProfilesTable).where(eq(staffProfilesTable.id, staffId));
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    if (!member.isActive) { res.status(403).json({ error: "Account is inactive" }); return; }
    if (member.pin !== String(pin)) { res.status(401).json({ error: "Incorrect PIN" }); return; }

    const perms = await db.select().from(staffPermissionsTable).where(eq(staffPermissionsTable.staffId, staffId));
    const permissions: Record<string, string> = {};
    for (const p of perms) permissions[p.resource] = p.level;

    res.json({ id: member.id, name: member.name, role: member.role, permissions });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

/* ── POST /api/staff ── create ──────────────────────────────────── */
router.post("/staff", async (req, res): Promise<void> => {
  const { name, pin, role } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) { res.status(400).json({ error: "Name must be at least 2 characters" }); return; }
  if (!pin || !/^\d{4}$/.test(String(pin))) { res.status(400).json({ error: "PIN must be exactly 4 digits" }); return; }
  const safeRole = VALID_ROLES.includes(role) ? role : "staff";

  try {
    const [member] = await db.insert(staffProfilesTable).values({ name: name.trim(), pin: String(pin), role: safeRole }).returning();
    res.status(201).json(member);
  } catch { res.status(500).json({ error: "Failed to create staff member" }); }
});

/* ── PUT /api/staff/:id ── update ───────────────────────────────── */
router.put("/staff/:id", async (req, res): Promise<void> => {
  const { name, pin, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) { res.status(400).json({ error: "Name must be at least 2 characters" }); return; }
    updates.name = name.trim();
  }
  if (pin !== undefined) {
    if (!/^\d{4}$/.test(String(pin))) { res.status(400).json({ error: "PIN must be exactly 4 digits" }); return; }
    updates.pin = String(pin);
  }
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  try {
    const [member] = await db.update(staffProfilesTable).set(updates).where(eq(staffProfilesTable.id, req.params.id)).returning();
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    res.json(member);
  } catch { res.status(500).json({ error: "Failed to update staff member" }); }
});

/* ── DELETE /api/staff/:id ── delete ────────────────────────────── */
router.delete("/staff/:id", async (req, res): Promise<void> => {
  try {
    const [member] = await db.delete(staffProfilesTable).where(eq(staffProfilesTable.id, req.params.id)).returning();
    if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete staff member" }); }
});

/* ── GET /api/staff/:id/permissions ─────────────────────────────── */
router.get("/staff/:id/permissions", async (req, res): Promise<void> => {
  try {
    const perms = await db.select().from(staffPermissionsTable).where(eq(staffPermissionsTable.staffId, req.params.id));
    const map: Record<string, string> = {};
    for (const p of perms) map[p.resource] = p.level;
    res.json(map);
  } catch { res.status(500).json({ error: "Failed to fetch permissions" }); }
});

/* ── PUT /api/staff/:id/permissions ─────────────────────────────── */
router.put("/staff/:id/permissions", async (req, res): Promise<void> => {
  const { permissions } = req.body ?? {};
  if (!permissions || typeof permissions !== "object") { res.status(400).json({ error: "permissions object required" }); return; }

  try {
    for (const [resource, level] of Object.entries(permissions)) {
      if (!VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) continue;
      await db.insert(staffPermissionsTable)
        .values({ staffId: req.params.id, resource, level: String(level) })
        .onConflictDoUpdate({ target: [staffPermissionsTable.staffId, staffPermissionsTable.resource], set: { level: String(level) } });
    }
    const updated = await db.select().from(staffPermissionsTable).where(eq(staffPermissionsTable.staffId, req.params.id));
    const map: Record<string, string> = {};
    for (const p of updated) map[p.resource] = p.level;
    res.json(map);
  } catch { res.status(500).json({ error: "Failed to update permissions" }); }
});

export default router;
