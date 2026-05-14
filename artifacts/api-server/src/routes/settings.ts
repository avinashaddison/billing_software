import { Router, type IRouter } from "express";
import { sql, isNull, eq, and } from "drizzle-orm";
import { db, storeSettingsTable } from "@workspace/db";

const router: IRouter = Router();

/** Legacy row id used by the original single-tenant Hira & Sons install. */
const LEGACY_SINGLETON_ID = 1;

/**
 * Resolve the settings row for a given tenant.
 *
 * - tenantId == null  → match the legacy row (tenant_id IS NULL, typically id=1).
 * - tenantId != null  → match the row with that tenant_id.
 *
 * Returns null if no row exists yet.
 */
async function findRow(tenantId: string | null) {
  if (tenantId == null) {
    const [row] = await db
      .select()
      .from(storeSettingsTable)
      .where(isNull(storeSettingsTable.tenantId))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

router.get("/settings", async (req, res): Promise<void> => {
  const row = await findRow(req.tenantId);
  if (!row) {
    res.json({ data: null, updatedAt: null });
    return;
  }
  res.json({ data: row.data, updatedAt: row.updatedAt });
});

router.put("/settings", async (req, res): Promise<void> => {
  const data = req.body;
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "Body must be a JSON object" });
    return;
  }

  const existing = await findRow(req.tenantId);

  if (existing) {
    await db
      .update(storeSettingsTable)
      .set({ data, updatedAt: sql`NOW()` })
      .where(and(
        eq(storeSettingsTable.id, existing.id),
        req.tenantId == null
          ? isNull(storeSettingsTable.tenantId)
          : eq(storeSettingsTable.tenantId, req.tenantId),
      ));
    res.json({ ok: true });
    return;
  }

  /* No row yet for this tenant — pick a fresh id.
     Legacy NULL row keeps id=1 (existing live data); per-tenant rows
     allocate the next free integer id. */
  let newId = LEGACY_SINGLETON_ID;
  if (req.tenantId != null) {
    const [{ nextId }] = await db.execute<{ nextId: number }>(
      sql`SELECT COALESCE(MAX(id), 0) + 1 AS "nextId" FROM ${storeSettingsTable}`,
    ) as unknown as Array<{ nextId: number }>;
    newId = Number(nextId) || 2;
  }

  await db
    .insert(storeSettingsTable)
    .values({ id: newId, tenantId: req.tenantId, data })
    .onConflictDoNothing();

  res.json({ ok: true });
});

export default router;
