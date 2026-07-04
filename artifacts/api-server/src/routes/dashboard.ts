import { Router, type IRouter } from "express";
import { lte, sql, gte, and, desc, eq, gt } from "drizzle-orm";
import { db, productsTable, stockLogsTable, billsTable, returnsTable } from "@workspace/db";
import { tenantWhere } from "../lib/tenant";
import { istToday } from "../lib/ist";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [summary] = await db
    .select({
      totalProducts: sql<number>`count(*)::int`,
      totalStock: sql<number>`sum(${productsTable.stock})::int`,
      totalStockValue: sql<number>`sum(${productsTable.stock}::numeric * ${productsTable.price})`,
      lowStockCount: sql<number>`count(case when ${productsTable.stock} <= ${productsTable.lowStockThreshold} then 1 end)::int`,
    })
    .from(productsTable)
    .where(tenantWhere(productsTable.tenantId, req.tenantId));

  const today = istToday();

  const [todayActivity] = await db
    .select({
      todayInCount: sql<number>`count(case when ${stockLogsTable.type} = 'IN' then 1 end)::int`,
      todayOutCount: sql<number>`count(case when ${stockLogsTable.type} = 'OUT' then 1 end)::int`,
    })
    .from(stockLogsTable)
    .where(and(
      sql`DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${today}`,
      tenantWhere(stockLogsTable.tenantId, req.tenantId),
    ));

  res.json({
    totalProducts: summary?.totalProducts ?? 0,
    totalStock: summary?.totalStock ?? 0,
    totalStockValue: Number(summary?.totalStockValue ?? 0),
    lowStockCount: summary?.lowStockCount ?? 0,
    todayInCount: todayActivity?.todayInCount ?? 0,
    todayOutCount: todayActivity?.todayOutCount ?? 0,
  });
});

router.get("/dashboard/low-stock", async (req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .where(and(
      lte(productsTable.stock, productsTable.lowStockThreshold),
      tenantWhere(productsTable.tenantId, req.tenantId),
    ))
    .orderBy(productsTable.stock);

  res.json(products.map((p) => ({ ...p, price: Number(p.price) })));
});

router.get("/dashboard/today-activity", async (req, res): Promise<void> => {
  const today = istToday();

  const [activity] = await db
    .select({
      inCount: sql<number>`count(case when ${stockLogsTable.type} = 'IN' then 1 end)::int`,
      outCount: sql<number>`count(case when ${stockLogsTable.type} = 'OUT' then 1 end)::int`,
      inQuantity: sql<number>`coalesce(sum(case when ${stockLogsTable.type} = 'IN' then ${stockLogsTable.quantity} else 0 end), 0)::int`,
      outQuantity: sql<number>`coalesce(sum(case when ${stockLogsTable.type} = 'OUT' then ${stockLogsTable.quantity} else 0 end), 0)::int`,
    })
    .from(stockLogsTable)
    .where(and(
      sql`DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${today}`,
      tenantWhere(stockLogsTable.tenantId, req.tenantId),
    ));

  res.json({
    inCount: activity?.inCount ?? 0,
    outCount: activity?.outCount ?? 0,
    inQuantity: activity?.inQuantity ?? 0,
    outQuantity: activity?.outQuantity ?? 0,
  });
});

router.get("/dashboard/categories", async (req, res): Promise<void> => {
  const categories = await db
    .select({
      category: productsTable.category,
      productCount: sql<number>`count(*)::int`,
      totalStock: sql<number>`sum(${productsTable.stock})::int`,
      stockValue: sql<number>`sum(${productsTable.stock}::numeric * ${productsTable.price})`,
    })
    .from(productsTable)
    .where(tenantWhere(productsTable.tenantId, req.tenantId))
    .groupBy(productsTable.category)
    .orderBy(productsTable.category);

  res.json(
    categories.map((c) => ({
      ...c,
      stockValue: Number(c.stockValue ?? 0),
    }))
  );
});

/**
 * GET /api/dashboard/receivables
 * Outstanding money owed to the shop:
 *   outstanding = max(0, total - paid - refunds)
 * Subtracting refunds matters: when a credit customer returns goods, the
 * receivable should shrink even if the cashier never marked it "paid".
 */
router.get("/dashboard/receivables", async (req, res): Promise<void> => {
  const refundsSubquery = db
    .select({
      billId:   returnsTable.billId,
      refunded: sql<string>`sum(${returnsTable.refundAmount})`.as("refunded"),
    })
    .from(returnsTable)
    .groupBy(returnsTable.billId)
    .as("refunds_sq");

  const outstandingPerBill = sql<string>`GREATEST(0, ${billsTable.totalAmount} - ${billsTable.amountPaid} - COALESCE(${refundsSubquery.refunded}, 0))`;

  /* A bill is "open" when (total - paid - refunds) > 0. We can't filter by
   * the stored payment_status alone because returns may shrink the balance
   * to zero without that column being recomputed on the legacy bill. */
  const tenantCond = tenantWhere(billsTable.tenantId, req.tenantId);

  const [totals] = await db
    .select({
      totalOutstanding: sql<string>`coalesce(sum(${outstandingPerBill}), 0)`,
      billCount:        sql<number>`sum(case when ${outstandingPerBill} > 0 then 1 else 0 end)::int`,
    })
    .from(billsTable)
    .leftJoin(refundsSubquery, eq(refundsSubquery.billId, billsTable.id))
    .where(tenantCond);

  const topDebtors = await db
    .select({
      customerName:  billsTable.customerName,
      customerPhone: billsTable.customerPhone,
      outstanding:   sql<string>`sum(${outstandingPerBill})`.as("outstanding"),
      billCount:     sql<number>`sum(case when ${outstandingPerBill} > 0 then 1 else 0 end)::int`,
      lastBillAt:    sql<string>`max(${billsTable.createdAt})`.as("last_bill_at"),
    })
    .from(billsTable)
    .leftJoin(refundsSubquery, eq(refundsSubquery.billId, billsTable.id))
    .where(tenantCond)
    .groupBy(billsTable.customerPhone, billsTable.customerName)
    .having(gt(sql`sum(${outstandingPerBill})`, sql`0`))
    .orderBy(desc(sql`sum(${outstandingPerBill})`))
    .limit(5);

  res.json({
    totalOutstanding: Number(totals?.totalOutstanding ?? 0),
    billCount:        totals?.billCount ?? 0,
    topDebtors: topDebtors.map((d) => ({
      customerName:  d.customerName ?? null,
      customerPhone: d.customerPhone ?? null,
      outstanding:   Number(d.outstanding),
      billCount:     d.billCount,
      lastBillAt:    d.lastBillAt,
    })),
  });
});

export default router;
