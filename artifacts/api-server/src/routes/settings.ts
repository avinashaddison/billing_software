import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, storeSettingsTable } from "@workspace/db";

const router: IRouter = Router();

const SINGLETON_ID = 1;

router.get("/settings", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, SINGLETON_ID));

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

  // Upsert row id=1 with the new JSON blob
  await db
    .insert(storeSettingsTable)
    .values({ id: SINGLETON_ID, data })
    .onConflictDoUpdate({
      target: storeSettingsTable.id,
      set: { data, updatedAt: sql`NOW()` },
    });

  res.json({ ok: true });
});

export default router;
