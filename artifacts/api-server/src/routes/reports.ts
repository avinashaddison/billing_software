import { Router, type IRouter } from "express";
import { desc, gte, sql, and } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable } from "@workspace/db";
import { tenantWhere } from "../lib/tenant";

const router: IRouter = Router();

/**
 * GET /api/reports/revenue?days=7
 * Returns daily revenue for the past N days (default 7).
 */
router.get("/reports/revenue", async (req, res): Promise<void> => {
  const days = Math.min(parseInt(String(req.query.days ?? 7), 10) || 7, 90);

  const rows = await db
    .select({
      day:         sql<string>`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`.as("day"),
      totalAmount: sql<string>`SUM(${billsTable.totalAmount})`.as("total_amount"),
      billCount:   sql<number>`COUNT(*)`.as("bill_count"),
      itemsCount:  sql<number>`SUM(${billsTable.itemsCount})`.as("items_count"),
    })
    .from(billsTable)
    .where(and(
      gte(billsTable.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(days))} days'`),
      tenantWhere(billsTable.tenantId, req.tenantId),
    ))
    .groupBy(sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`)
    .orderBy(sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`);

  // Build a map of existing data
  const dataMap = new Map(
    rows.map((r) => [r.day, { totalAmount: Number(r.totalAmount), billCount: Number(r.billCount), itemsCount: Number(r.itemsCount) }])
  );

  // Fill every day in the window with zeros if no data
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00");
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toLocaleDateString("en-CA");
    const existing = dataMap.get(dayStr);
    result.push({ day: dayStr, totalAmount: existing?.totalAmount ?? 0, billCount: existing?.billCount ?? 0, itemsCount: existing?.itemsCount ?? 0 });
  }

  res.json(result);
});

/**
 * GET /api/reports/end-of-day?date=YYYY-MM-DD
 * End-of-day summary for a given date (default: today India time).
 */
router.get("/reports/end-of-day", async (req, res): Promise<void> => {
  const dateStr = String(req.query.date ?? "");
  const targetDate = dateStr || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // Total sales for the day
  const [salesSummary] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${billsTable.totalAmount}), 0)`.as("total_amount"),
      billCount:   sql<number>`COUNT(*)`.as("bill_count"),
      itemsSold:   sql<number>`COALESCE(SUM(${billsTable.itemsCount}), 0)`.as("items_sold"),
      cashSales:   sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'cash' THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("cash_sales"),
      upiSales:    sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'upi' THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("upi_sales"),
    })
    .from(billsTable)
    .where(and(
      sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(billsTable.tenantId, req.tenantId),
    ));

  // Top-selling products for the day
  const topProducts = await db
    .select({
      productId:     saleItemsTable.productId,
      productName:   productsTable.name,
      productSku:    productsTable.sku,
      purchasePrice: productsTable.purchasePrice,
      totalQty:      sql<number>`SUM(${saleItemsTable.quantity})`.as("total_qty"),
      totalRevenue:  sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
      totalCost:     sql<string>`COALESCE(${productsTable.purchasePrice}, 0) * SUM(${saleItemsTable.quantity})`.as("total_cost"),
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
    .innerJoin(billsTable, sql`${saleItemsTable.saleId} = ${billsTable.id}`)
    .where(and(
      sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(billsTable.tenantId, req.tenantId),
    ))
    .groupBy(saleItemsTable.productId, productsTable.name, productsTable.sku, productsTable.purchasePrice)
    .orderBy(desc(sql`SUM(${saleItemsTable.quantity})`))
    .limit(10);

  // Aggregate profit for the day (only products with purchasePrice set)
  const [profitSummary] = await db
    .select({
      totalCost:   sql<string>`COALESCE(SUM(${productsTable.purchasePrice} * ${saleItemsTable.quantity}), 0)`.as("total_cost"),
      coveredItems: sql<number>`COUNT(DISTINCT CASE WHEN ${productsTable.purchasePrice} IS NOT NULL THEN ${saleItemsTable.productId} END)`.as("covered_items"),
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
    .innerJoin(billsTable, sql`${saleItemsTable.saleId} = ${billsTable.id}`)
    .where(and(
      sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(billsTable.tenantId, req.tenantId),
    ));

  // Stock IN for the day
  const [stockIn] = await db
    .select({
      totalIn: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}), 0)`.as("total_in"),
      txCount:  sql<number>`COUNT(*)`.as("tx_count"),
    })
    .from(stockLogsTable)
    .where(and(
      sql`${stockLogsTable.type} = 'IN' AND DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(stockLogsTable.tenantId, req.tenantId),
    ));

  const totalRevenue = Number(salesSummary.totalAmount);
  const totalCost    = Number(profitSummary.totalCost);
  const grossProfit  = totalRevenue - totalCost;

  res.json({
    date:        targetDate,
    totalAmount: totalRevenue,
    billCount:   Number(salesSummary.billCount),
    itemsSold:   Number(salesSummary.itemsSold),
    cashSales:   Number(salesSummary.cashSales),
    upiSales:    Number(salesSummary.upiSales),
    grossProfit,
    totalCost,
    profitCoverage: Number(profitSummary.coveredItems),
    stockIn:     { totalUnits: Number(stockIn.totalIn), txCount: Number(stockIn.txCount) },
    topProducts: topProducts.map((p) => {
      const qty      = Number(p.totalQty);
      const revenue  = Number(p.totalRevenue);
      const cost     = p.purchasePrice != null ? Number(p.purchasePrice) * qty : null;
      const profit   = cost != null ? revenue - cost : null;
      const margin   = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;
      return {
        productId:   p.productId,
        productName: p.productName,
        productSku:  p.productSku,
        totalQty:    qty,
        totalRevenue: revenue,
        profit,
        margin,
      };
    }),
  });
});

export default router;
