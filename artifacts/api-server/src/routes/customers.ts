import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte, isNotNull, inArray } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable } from "@workspace/db";
import { tenantWhere } from "../lib/tenant";

const router: IRouter = Router();

type Period = "all" | "week" | "month";
function parsePeriod(raw: unknown): Period {
  if (raw === "week" || raw === "month") return raw;
  return "all";
}

/**
 * GET /api/customers?period=all|week|month
 * Returns all unique customers (grouped by phone) with purchase stats — scoped to the caller's tenant.
 */
router.get("/customers", async (req, res): Promise<void> => {
  const period = parsePeriod(req.query.period);

  const conditions = [
    isNotNull(billsTable.customerPhone),
    tenantWhere(billsTable.tenantId, req.tenantId),
  ];
  if (period === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    conditions.push(gte(billsTable.createdAt, weekAgo));
  } else if (period === "month") {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    conditions.push(gte(billsTable.createdAt, monthStart));
  }

  const rows = await db
    .select({
      customerPhone: billsTable.customerPhone,
      totalSpent:    sql<string>`SUM(${billsTable.totalAmount})`.as("total_spent"),
      visitCount:    sql<number>`COUNT(*)`.as("visit_count"),
      lastVisit:     sql<string>`MAX(${billsTable.createdAt})`.as("last_visit"),
    })
    .from(billsTable)
    .where(and(...conditions))
    .groupBy(billsTable.customerPhone)
    .orderBy(desc(sql`SUM(${billsTable.totalAmount})`));

  res.json(
    rows.map((r) => ({
      phone:      r.customerPhone,
      totalSpent: Number(r.totalSpent),
      visitCount: Number(r.visitCount),
      lastVisit:  r.lastVisit,
    }))
  );
});

/**
 * GET /api/customers/:phone
 * Returns full purchase history + top products for a customer phone number,
 * scoped to bills owned by the caller's tenant.
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
    .where(and(
      eq(billsTable.customerPhone, phone),
      tenantWhere(billsTable.tenantId, req.tenantId),
    ))
    .orderBy(desc(billsTable.createdAt));

  if (bills.length === 0) {
    res.status(404).json({ error: "No customer found with this number" });
    return;
  }

  const billIds = bills.map((b) => b.id);

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
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(inArray(saleItemsTable.saleId, billIds))
    .orderBy(desc(saleItemsTable.createdAt));

  /* Top 5 most-purchased products (by total quantity) grouped by productId */
  const topProductsRaw = await db
    .select({
      productId:   saleItemsTable.productId,
      productName: productsTable.name,
      totalQty:    sql<number>`SUM(${saleItemsTable.quantity})`.as("total_qty"),
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(inArray(saleItemsTable.saleId, billIds))
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(desc(sql`SUM(${saleItemsTable.quantity})`))
    .limit(5);

  const itemsByBill = allItems.reduce<Record<string, typeof allItems>>((acc, item) => {
    (acc[item.saleId] ??= []).push(item);
    return acc;
  }, {});

  const totalSpent = bills.reduce((s, b) => s + Number(b.totalAmount), 0);

  res.json({
    phone,
    totalSpent,
    visitCount: bills.length,
    topProducts: topProductsRaw.map((p) => ({
      productName: p.productName ?? "Deleted Product",
      totalQty:    Number(p.totalQty),
    })),
    bills: bills.map((b) => ({
      ...b,
      totalAmount: Number(b.totalAmount),
      items: (itemsByBill[b.id] ?? []).map((i) => ({
        ...i,
        productName: i.productName ?? "Deleted Product",
        productSku:  i.productSku  ?? "—",
        price:       Number(i.price),
        subtotal:    Number(i.subtotal),
      })),
    })),
  });
});

export default router;
