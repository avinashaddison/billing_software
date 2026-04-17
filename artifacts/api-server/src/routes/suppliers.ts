import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import { broadcast } from "../lib/sse";

const router: IRouter = Router();

router.get("/suppliers", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(suppliersTable)
    .orderBy(desc(suppliersTable.createdAt));
  res.json(rows);
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const { name, contact, email, phone, address, notes } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [row] = await db
    .insert(suppliersTable)
    .values({ name: name.trim(), contact, email, phone, address, notes })
    .returning();
  broadcast("supplier_created", { id: row.id, name: row.name });
  res.status(201).json(row);
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [row] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(row);
});

router.patch("/suppliers/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, contact, email, phone, address, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name != null) updates.name = name;
  if (contact != null) updates.contact = contact;
  if (email != null) updates.email = email;
  if (phone != null) updates.phone = phone;
  if (address != null) updates.address = address;
  if (notes != null) updates.notes = notes;
  const [row] = await db.update(suppliersTable).set(updates).where(eq(suppliersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(row);
});

router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [row] = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.sendStatus(204);
});

export default router;
