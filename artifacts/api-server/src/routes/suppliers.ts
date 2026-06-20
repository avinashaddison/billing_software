import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, suppliersTable, supplierPaymentsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const PAYMENT_METHODS = ["cash", "upi", "bank", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

router.get("/suppliers", async (req, res): Promise<void> => {
  // Each supplier row carries a rollup of how much has been paid to them
  // (totalPaid) and how many payments were logged (paymentCount). The LEFT
  // JOIN keeps suppliers with zero payments. GROUP BY the supplier PK is safe
  // in Postgres (all other supplier columns are functionally dependent on it).
  const rows = await db
    .select({
      id:        suppliersTable.id,
      tenantId:  suppliersTable.tenantId,
      name:      suppliersTable.name,
      contact:   suppliersTable.contact,
      email:     suppliersTable.email,
      phone:     suppliersTable.phone,
      address:   suppliersTable.address,
      notes:     suppliersTable.notes,
      createdAt: suppliersTable.createdAt,
      totalPaid: sql<string>`COALESCE(SUM(${supplierPaymentsTable.amount}), 0)`.as("total_paid"),
      paymentCount: sql<number>`COUNT(${supplierPaymentsTable.id})::int`.as("payment_count"),
    })
    .from(suppliersTable)
    .leftJoin(
      supplierPaymentsTable,
      and(
        eq(supplierPaymentsTable.supplierId, suppliersTable.id),
        // Tenant-scope the joined payments so totalPaid/paymentCount can never
        // diverge from the (tenant-filtered) per-supplier history endpoint.
        tenantWhere(supplierPaymentsTable.tenantId, req.tenantId),
      ),
    )
    .where(tenantWhere(suppliersTable.tenantId, req.tenantId))
    .groupBy(suppliersTable.id)
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
    .values({ tenantId: req.tenantId, name: name.trim(), contact, email, phone, address, notes })
    .returning();
  broadcast("supplier_created", { id: row.id, name: row.name }, req.tenantId);
  res.status(201).json(row);
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [row] = await db
    .select()
    .from(suppliersTable)
    .where(and(
      eq(suppliersTable.id, id),
      tenantWhere(suppliersTable.tenantId, req.tenantId),
    ));
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
  const [row] = await db
    .update(suppliersTable)
    .set(updates)
    .where(and(
      eq(suppliersTable.id, id),
      tenantWhereWrite(suppliersTable.tenantId, req.tenantId),
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(row);
});

router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [row] = await db
    .delete(suppliersTable)
    .where(and(
      eq(suppliersTable.id, id),
      tenantWhereWrite(suppliersTable.tenantId, req.tenantId),
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.sendStatus(204);
});

/* ───── Supplier payment history ─────
 * Simple payment log: list / add / delete payments made to one supplier.
 * Every query is tenant-scoped; the supplier itself is verified against the
 * caller's tenant before any payment read or write. */

router.get("/suppliers/:id/payments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const [supplier] = await db
    .select({ id: suppliersTable.id })
    .from(suppliersTable)
    .where(and(
      eq(suppliersTable.id, id),
      tenantWhere(suppliersTable.tenantId, req.tenantId),
    ));
  if (!supplier) { res.status(404).json({ error: "Supplier not found" }); return; }

  const rows = await db
    .select()
    .from(supplierPaymentsTable)
    .where(and(
      eq(supplierPaymentsTable.supplierId, id),
      tenantWhere(supplierPaymentsTable.tenantId, req.tenantId),
    ))
    .orderBy(desc(supplierPaymentsTable.paidAt), desc(supplierPaymentsTable.createdAt));
  res.json(rows);
});

router.post("/suppliers/:id/payments", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const { amount, method, note, paidAt } = req.body as Record<string, unknown>;

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }
  // Guard the NUMERIC(15,2) range so an absurd value returns a clean 400
  // instead of a generic DB overflow error.
  if (amt > 9_999_999_999_999.99) {
    res.status(400).json({ error: "amount is too large" });
    return;
  }
  const m: PaymentMethod =
    typeof method === "string" && (PAYMENT_METHODS as readonly string[]).includes(method)
      ? (method as PaymentMethod)
      : "cash";

  let paidDate: Date | undefined;
  if (typeof paidAt === "string" && paidAt.trim()) {
    const d = new Date(paidAt);
    if (!Number.isNaN(d.getTime())) paidDate = d;
  }

  // Write guard: the supplier must belong to this tenant (strict — never the
  // NULL fallback) before we attach a payment to it.
  const [supplier] = await db
    .select({ id: suppliersTable.id })
    .from(suppliersTable)
    .where(and(
      eq(suppliersTable.id, id),
      tenantWhereWrite(suppliersTable.tenantId, req.tenantId),
    ));
  if (!supplier) { res.status(404).json({ error: "Supplier not found" }); return; }

  const [row] = await db
    .insert(supplierPaymentsTable)
    .values({
      tenantId:   req.tenantId,
      supplierId: id,
      amount:     amt.toFixed(2),
      method:     m,
      note:       typeof note === "string" && note.trim() ? note.trim() : null,
      ...(paidDate ? { paidAt: paidDate } : {}),
    })
    .returning();
  broadcast("supplier_payment_added", { supplierId: id }, req.tenantId, true);
  res.status(201).json(row);
});

router.delete("/suppliers/:id/payments/:paymentId", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const paymentId = String(req.params.paymentId);
  const [row] = await db
    .delete(supplierPaymentsTable)
    .where(and(
      eq(supplierPaymentsTable.id, paymentId),
      eq(supplierPaymentsTable.supplierId, id),
      tenantWhereWrite(supplierPaymentsTable.tenantId, req.tenantId),
    ))
    .returning();
  if (!row) { res.status(404).json({ error: "Payment not found" }); return; }
  broadcast("supplier_payment_deleted", { supplierId: id }, req.tenantId, true);
  res.sendStatus(204);
});

export default router;
