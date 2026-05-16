import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte, isNotNull, inArray } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, returnsTable } from "@workspace/db";
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

  /* Refunds reduce what the customer owes. We left-join the per-bill refund
   * totals so a bill with no returns yields NULL → coalesced to 0. */
  const refundsSubquery = db
    .select({
      billId:   returnsTable.billId,
      refunded: sql<string>`sum(${returnsTable.refundAmount})`.as("refunded"),
    })
    .from(returnsTable)
    .groupBy(returnsTable.billId)
    .as("refunds_sq");

  const rows = await db
    .select({
      customerPhone: billsTable.customerPhone,
      customerName:  sql<string | null>`MAX(${billsTable.customerName})`.as("customer_name"),
      totalSpent:    sql<string>`SUM(${billsTable.totalAmount})`.as("total_spent"),
      /* Outstanding clamps per-bill at 0 so an over-refunded bill (refund
       * larger than the unpaid portion) doesn't become a negative receivable. */
      outstanding:   sql<string>`SUM(GREATEST(0, ${billsTable.totalAmount} - ${billsTable.amountPaid} - COALESCE(${refundsSubquery.refunded}, 0)))`.as("outstanding"),
      unpaidCount:   sql<number>`SUM(CASE WHEN ${billsTable.totalAmount} - ${billsTable.amountPaid} - COALESCE(${refundsSubquery.refunded}, 0) > 0 THEN 1 ELSE 0 END)`.as("unpaid_count"),
      visitCount:    sql<number>`COUNT(*)`.as("visit_count"),
      lastVisit:     sql<string>`MAX(${billsTable.createdAt})`.as("last_visit"),
    })
    .from(billsTable)
    .leftJoin(refundsSubquery, eq(refundsSubquery.billId, billsTable.id))
    .where(and(...conditions))
    .groupBy(billsTable.customerPhone)
    .orderBy(desc(sql`SUM(${billsTable.totalAmount})`));

  res.json(
    rows.map((r) => ({
      phone:        r.customerPhone,
      name:         r.customerName ?? null,
      totalSpent:   Number(r.totalSpent),
      outstanding:  Number(r.outstanding),
      unpaidCount:  Number(r.unpaidCount),
      visitCount:   Number(r.visitCount),
      lastVisit:    r.lastVisit,
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

  /* Pull every return for these bills so the UI can show "Returned ₹X" inline
   * and the receivable calc subtracts refunds correctly. */
  const returnRows = await db
    .select({
      billId:       returnsTable.billId,
      productName:  productsTable.name,
      productSku:   productsTable.sku,
      quantity:     returnsTable.quantity,
      refundAmount: returnsTable.refundAmount,
      reason:       returnsTable.reason,
      createdAt:    returnsTable.createdAt,
    })
    .from(returnsTable)
    .leftJoin(productsTable, eq(returnsTable.productId, productsTable.id))
    .where(inArray(returnsTable.billId, billIds))
    .orderBy(desc(returnsTable.createdAt));

  const returnsByBill = returnRows.reduce<Record<string, typeof returnRows>>((acc, r) => {
    (acc[r.billId] ??= []).push(r);
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
    bills: bills.map((b) => {
      const refunds         = returnsByBill[b.id] ?? [];
      const refundedAmount  = refunds.reduce((s, r) => s + Number(r.refundAmount), 0);
      return {
        ...b,
        totalAmount:    Number(b.totalAmount),
        amountPaid:     Number(b.amountPaid),
        refundedAmount,
        items: (itemsByBill[b.id] ?? []).map((i) => ({
          ...i,
          productName: i.productName ?? "Deleted Product",
          productSku:  i.productSku  ?? "—",
          price:       Number(i.price),
          subtotal:    Number(i.subtotal),
        })),
        returns: refunds.map((r) => ({
          productName:  r.productName ?? "Deleted Product",
          productSku:   r.productSku  ?? "—",
          quantity:     r.quantity,
          refundAmount: Number(r.refundAmount),
          reason:       r.reason,
          createdAt:    r.createdAt,
        })),
      };
    }),
  });
});

export default router;
