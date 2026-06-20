import { Router, type IRouter } from "express";
import { eq, asc, sql, and } from "drizzle-orm";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";

const router: IRouter = Router();

/* ── GET /api/categories ── list all with product count ─────────── */
router.get("/categories", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id:           categoriesTable.id,
        name:         categoriesTable.name,
        emoji:        categoriesTable.emoji,
        skuCode:      categoriesTable.skuCode,
        createdAt:    categoriesTable.createdAt,
        productCount: sql<number>`cast(count(${productsTable.id}) as int)`,
        totalStock:   sql<number>`cast(coalesce(sum(${productsTable.stock}), 0) as int)`,
      })
      .from(categoriesTable)
      .leftJoin(productsTable, eq(productsTable.category, categoriesTable.name))
      .where(tenantWhere(categoriesTable.tenantId, req.tenantId))
      .groupBy(categoriesTable.id)
      .orderBy(asc(categoriesTable.name));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/* ── POST /api/categories ── create ─────────────────────────────── */
router.post("/categories", async (req, res): Promise<void> => {
  const { name, emoji, skuCode } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters" });
    return;
  }
  if (!skuCode || typeof skuCode !== "string" || skuCode.trim().length < 1) {
    res.status(400).json({ error: "SKU code is required" });
    return;
  }
  try {
    const [row] = await db.insert(categoriesTable).values({
      tenantId: req.tenantId,
      name:     name.trim(),
      emoji:    (emoji ?? "🎁").toString(),
      skuCode:  skuCode.trim().toUpperCase().slice(0, 6),
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: `Category "${name.trim()}" already exists` });
    } else {
      res.status(500).json({ error: "Failed to create category" });
    }
  }
});

/* ── PUT /api/categories/:id ── update ──────────────────────────── */
router.put("/categories/:id", async (req, res): Promise<void> => {
  const { name, emoji, skuCode } = req.body ?? {};
  const updates: Record<string, string> = {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters" });
      return;
    }
    updates.name = name.trim();
  }
  if (emoji !== undefined) updates.emoji = String(emoji);
  if (skuCode !== undefined) updates.skuCode = String(skuCode).toUpperCase().slice(0, 6);

  try {
    const [row] = await db
      .update(categoriesTable)
      .set(updates)
      .where(and(
        eq(categoriesTable.id, req.params.id),
        tenantWhereWrite(categoriesTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!row) { res.status(404).json({ error: "Category not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Another category with that name already exists" });
    } else {
      res.status(500).json({ error: "Failed to update category" });
    }
  }
});

/* ── DELETE /api/categories/:id ── delete ───────────────────────── */
router.delete("/categories/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .delete(categoriesTable)
      .where(and(
        eq(categoriesTable.id, req.params.id),
        tenantWhereWrite(categoriesTable.tenantId, req.tenantId),
      ))
      .returning();
    if (!row) { res.status(404).json({ error: "Category not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
