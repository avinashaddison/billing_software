import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * GET /api/customers
 * Returns all unique customers (grouped by phone) with purchase stats.
 */
router.get("/customers", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      customerPhone: billsTable.customerPhone,
      totalSpent:    sql<string>`SUM(${billsTable.totalAmount})`.as("total_spent"),
      visitCount:    sql<number>`COUNT(*)`.as("visit_count"),
      lastVisit:     sql<string>`MAX(${billsTable.createdAt})`.as("last_visit"),
    })
    .from(billsTable)
    .where(sql`${billsTable.customerPhone} IS NOT NULL`)
    .groupBy(billsTable.customerPhone)
    .orderBy(desc(sql`SUM(${billsTable.totalAmount})`));

  res.json(
    rows.map((r) => ({
      phone:       r.customerPhone,
      totalSpent:  Number(r.totalSpent),
      visitCount:  Number(r.visitCount),
      lastVisit:   r.lastVisit,
    }))
  );
});

/**
 * GET /api/customers/:phone
 * Returns full purchase history for a customer phone number.
 */
router.get("/customers/:phone", async (req, res): Promise<void> => {
  const { phone } = req.params;
  if (!/^\d{10}$/.test(phone)) {
    res.status(400).json({ error: "Invalid phone number" });
    return;
  }

  const bills = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.customerPhone, phone))
    .orderBy(desc(billsTable.createdAt));

  if (bills.length === 0) {
    res.status(404).json({ error: "No customer found with this number" });
    return;
  }

  const billIds = bills.map((b) => b.id);

  // Fetch all sale items for these bills
  const allItems = await db
    .select({
      saleId:      saleItemsTable.saleId,
      productName: productsTable.name,
      productSku:  productsTable.sku,
      quantity:    saleItemsTable.quantity,
      price:       saleItemsTable.price,
      subtotal:    saleItemsTable.subtotal,
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(sql`${saleItemsTable.saleId} = ANY(${sql.raw(`ARRAY['${billIds.join("','")}'::uuid]`)})`)
    .orderBy(desc(saleItemsTable.createdAt));

  const itemsByBill = allItems.reduce<Record<string, typeof allItems>>((acc, item) => {
    (acc[item.saleId] ??= []).push(item);
    return acc;
  }, {});

  const totalSpent = bills.reduce((s, b) => s + Number(b.totalAmount), 0);

  res.json({
    phone,
    totalSpent,
    visitCount: bills.length,
    bills: bills.map((b) => ({
      ...b,
      totalAmount: Number(b.totalAmount),
      items: (itemsByBill[b.id] ?? []).map((i) => ({
        ...i,
        price:    Number(i.price),
        subtotal: Number(i.subtotal),
      })),
    })),
  });
});

export default router;
