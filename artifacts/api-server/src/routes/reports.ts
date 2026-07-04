import { Router, type IRouter } from "express";
import { desc, gte, sql, and, eq } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable, returnsTable, billPaymentsTable } from "@workspace/db";
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
      gte(billsTable.createdAt, sql`NOW() - make_interval(days => ${days})`),
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
 * GET /api/reports/sku-performance?days=30
 * Aggregated per-SKU sales over the last N days (default 30, max 365):
 * units sold, revenue, bills, and — when a purchase price is set — profit
 * and margin. Ordered by revenue, capped at the top 100 SKUs.
 *
 * Manual (custom-name) line items have no productId, so the inner join on
 * products naturally drops them — only real catalogue SKUs are counted.
 */
router.get("/reports/sku-performance", async (req, res): Promise<void> => {
  const days = Math.min(parseInt(String(req.query.days ?? 30), 10) || 30, 365);

  const rows = await db
    .select({
      productId:     saleItemsTable.productId,
      productName:   productsTable.name,
      productSku:    productsTable.sku,
      category:      productsTable.category,
      purchasePrice: productsTable.purchasePrice,
      totalQty:      sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
      totalRevenue:  sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
      billCount:     sql<number>`COUNT(DISTINCT ${saleItemsTable.saleId})::int`.as("bill_count"),
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
    .innerJoin(billsTable,    sql`${saleItemsTable.saleId}    = ${billsTable.id}`)
    .where(and(
      gte(billsTable.createdAt, sql`NOW() - make_interval(days => ${days})`),
      tenantWhere(billsTable.tenantId, req.tenantId),
    ))
    .groupBy(
      saleItemsTable.productId, productsTable.name, productsTable.sku,
      productsTable.category, productsTable.purchasePrice,
    )
    .orderBy(desc(sql`SUM(${saleItemsTable.subtotal})`))
    .limit(100);

  res.json(rows.map((p) => {
    const qty     = Number(p.totalQty);
    const revenue = Number(p.totalRevenue);
    const cost    = p.purchasePrice != null ? Number(p.purchasePrice) * qty : null;
    const profit  = cost != null ? revenue - cost : null;
    const margin  = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;
    return {
      productId:    p.productId,
      productName:  p.productName,
      productSku:   p.productSku,
      category:     p.category,
      totalQty:     qty,
      totalRevenue: revenue,
      billCount:    Number(p.billCount),
      profit,
      margin,
    };
  }));
});

/* ── Helpers ─────────────────────────────────────────────────────── */
type SalesTotals = {
  totalAmount: number;
  billCount:   number;
  itemsSold:   number;
  cashSales:   number;
  upiSales:    number;
  creditSales: number;
  discount:    number;
  uniqueCustomers: number;
};

/** One day's totals — used both for the requested date AND for the
 *  "yesterday" / "same day last week" comparison rows so the front-end
 *  can render delta chips without an extra round trip. */
async function dailyTotals(targetDate: string, tenantId: string | null): Promise<SalesTotals> {
  const [row] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${billsTable.totalAmount}), 0)`.as("total_amount"),
      billCount:   sql<number>`COUNT(*)::int`.as("bill_count"),
      itemsSold:   sql<number>`COALESCE(SUM(${billsTable.itemsCount}), 0)::int`.as("items_sold"),
      cashSales:   sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'cash'   THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("cash"),
      upiSales:    sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'upi'    THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("upi"),
      creditSales: sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'credit' THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("credit"),
      discount:    sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.discount} IS NOT NULL AND ${billsTable.discountType} = 'amount'  THEN ${billsTable.discount}
                                                  WHEN ${billsTable.discount} IS NOT NULL AND ${billsTable.discountType} = 'percent' THEN ${billsTable.totalAmount} * ${billsTable.discount} / 100
                                                  ELSE 0 END), 0)`.as("discount"),
      uniqueCustomers: sql<number>`COUNT(DISTINCT ${billsTable.customerPhone})::int`.as("unique_customers"),
    })
    .from(billsTable)
    .where(and(
      sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(billsTable.tenantId, tenantId),
    ));

  return {
    totalAmount: Number(row?.totalAmount ?? 0),
    billCount:   row?.billCount ?? 0,
    itemsSold:   row?.itemsSold ?? 0,
    cashSales:   Number(row?.cashSales ?? 0),
    upiSales:    Number(row?.upiSales ?? 0),
    creditSales: Number(row?.creditSales ?? 0),
    discount:    Number(row?.discount ?? 0),
    uniqueCustomers: row?.uniqueCustomers ?? 0,
  };
}

function shiftDate(dateStr: string, days: number): string {
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dateVal = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dateVal}`;
}

/**
 * GET /api/reports/end-of-day?date=YYYY-MM-DD
 * Richer EOD payload: payment-mode breakdown including credit, dues created
 * vs collected today, returns, hourly distribution, top products + top
 * customers, plus same-day-last-week and yesterday totals for delta chips.
 */
router.get("/reports/end-of-day", async (req, res): Promise<void> => {
  const dateStr    = String(req.query.date ?? "");
  const targetDate = dateStr || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tenantId   = req.tenantId;

  /* Run independent queries in parallel — big speed win when the day has
   * a lot of bills, since these would otherwise be 6 sequential round trips. */
  const [
    today, yesterday, lastWeek,
    topProducts, profitSummary, stockIn, hourly, topCustomers, paymentsToday, returnsToday,
  ] = await Promise.all([
    dailyTotals(targetDate,              tenantId),
    dailyTotals(shiftDate(targetDate, -1), tenantId),
    dailyTotals(shiftDate(targetDate, -7), tenantId),

    db.select({
        productId:     saleItemsTable.productId,
        productName:   productsTable.name,
        productSku:    productsTable.sku,
        purchasePrice: productsTable.purchasePrice,
        totalQty:      sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
        totalRevenue:  sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
      })
      .from(saleItemsTable)
      .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
      .innerJoin(billsTable,    sql`${saleItemsTable.saleId}    = ${billsTable.id}`)
      .where(and(
        sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(billsTable.tenantId, tenantId),
      ))
      .groupBy(saleItemsTable.productId, productsTable.name, productsTable.sku, productsTable.purchasePrice)
      .orderBy(desc(sql`SUM(${saleItemsTable.quantity})`))
      .limit(10),

    /* Profit base. LEFT JOIN (not INNER) so MANUAL / non-inventory lines
       (productId IS NULL) are kept: they have no purchase cost, so their full
       subtotal is counted as profit (a gift-wrap, service charge, etc.). A
       line is "covered" — and thus part of the profit base — when it is either
       a manual line OR a catalogue item that has a purchase price set.
       Catalogue items with an UNSET purchase price stay excluded so we never
       overstate margin on items whose real cost we don't know. */
    db.select({
        totalCost:      sql<string>`COALESCE(SUM(CASE WHEN ${productsTable.purchasePrice} IS NOT NULL THEN ${productsTable.purchasePrice} * ${saleItemsTable.quantity} ELSE 0 END), 0)`.as("total_cost"),
        coveredItems:   sql<number>`COUNT(*) FILTER (WHERE ${saleItemsTable.productId} IS NULL OR ${productsTable.purchasePrice} IS NOT NULL)::int`.as("covered_items"),
        coveredRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${saleItemsTable.productId} IS NULL OR ${productsTable.purchasePrice} IS NOT NULL THEN ${saleItemsTable.subtotal} ELSE 0 END), 0)`.as("covered_revenue"),
      })
      .from(saleItemsTable)
      .leftJoin(productsTable,  sql`${saleItemsTable.productId} = ${productsTable.id}`)
      .innerJoin(billsTable,    sql`${saleItemsTable.saleId}    = ${billsTable.id}`)
      .where(and(
        sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(billsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0]),

    db.select({
        totalIn: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}), 0)::int`.as("total_in"),
        txCount: sql<number>`COUNT(*)::int`.as("tx_count"),
      })
      .from(stockLogsTable)
      .where(and(
        sql`${stockLogsTable.type} = 'IN' AND DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(stockLogsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { totalIn: 0, txCount: 0 }),

    /* Hourly distribution — 24 buckets (0..23) so the chart can render a
     * peak-hours view. Pads the response with zero rows on the client. */
    db.select({
        hour:        sql<number>`EXTRACT(HOUR FROM ${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')::int`.as("hour"),
        totalAmount: sql<string>`SUM(${billsTable.totalAmount})`.as("total_amount"),
        billCount:   sql<number>`COUNT(*)::int`.as("bill_count"),
      })
      .from(billsTable)
      .where(and(
        sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(billsTable.tenantId, tenantId),
      ))
      .groupBy(sql`EXTRACT(HOUR FROM ${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`)
      .orderBy(sql`EXTRACT(HOUR FROM ${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`),

    /* Top customers by spend on this date. We aggregate by phone so a
     * walk-in (NULL phone) is excluded; otherwise every anonymous bill
     * would collapse into one fake "customer". */
    db.select({
        customerPhone: billsTable.customerPhone,
        customerName:  sql<string | null>`MAX(${billsTable.customerName})`.as("customer_name"),
        totalSpent:    sql<string>`SUM(${billsTable.totalAmount})`.as("total_spent"),
        billCount:     sql<number>`COUNT(*)::int`.as("bill_count"),
      })
      .from(billsTable)
      .where(and(
        sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        sql`${billsTable.customerPhone} IS NOT NULL`,
        tenantWhere(billsTable.tenantId, tenantId),
      ))
      .groupBy(billsTable.customerPhone)
      .orderBy(desc(sql`SUM(${billsTable.totalAmount})`))
      .limit(5),

    /* Dues collected today: real cashflow from the bill_payments ledger,
     * counting only 'collection' rows (payments made against previously
     * outstanding credit/partial bills) on this IST date. At-checkout 'sale'
     * payments are excluded so we never double-count cash/UPI sales that
     * already appear in cashSales/upiSales. */
    db.select({
        collected: sql<string>`COALESCE(SUM(${billPaymentsTable.amount}), 0)`.as("collected"),
      })
      .from(billPaymentsTable)
      .where(and(
        sql`${billPaymentsTable.kind} = 'collection'`,
        sql`DATE(${billPaymentsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(billPaymentsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { collected: 0 }),

    /* Returns processed today — refund cash that flowed out the drawer. */
    db.select({
        total: sql<string>`COALESCE(SUM(${returnsTable.refundAmount}), 0)`.as("total"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(returnsTable)
      .where(and(
        sql`DATE(${returnsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(returnsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { total: 0, count: 0 }),
  ]);

  const totalCost      = Number(profitSummary?.totalCost ?? 0);
  /* Profit is computed over the "covered" revenue base: manual/non-inventory
   * lines (zero cost → full margin) plus catalogue items whose purchase price
   * is set. Catalogue items with an UNSET cost are excluded so we compare
   * like-with-like revenue and never overstate margin on unknown-cost items.
   * profitCoverage tells the UI how many lines are included so it can label
   * the figure ("based on N priced items"). */
  const coveredRevenue = Number(profitSummary?.coveredRevenue ?? 0);
  const grossProfit    = coveredRevenue - totalCost;
  const margin         = coveredRevenue > 0 ? (grossProfit / coveredRevenue) * 100 : 0;

  /* Receivables created today = credit sales (the entire bill is unpaid).
   * Receivables collected today = ledger 'collection' payments dated today
   * (see paymentsToday above) — accurate cash collected against outstanding
   * dues regardless of when the original bill was raised. */
  const duesCreated   = today.creditSales;
  const duesCollected = Number(paymentsToday?.collected ?? 0);

  /* Pad hourly buckets to 24 so the chart has a stable x-axis. */
  const hourlyMap = new Map(hourly.map((h) => [h.hour, h]));
  const hourlyFull = Array.from({ length: 24 }, (_, h) => {
    const r = hourlyMap.get(h);
    return {
      hour: h,
      totalAmount: r ? Number(r.totalAmount) : 0,
      billCount:   r ? r.billCount           : 0,
    };
  });

  res.json({
    date: targetDate,

    // Headline totals
    totalAmount:     today.totalAmount,
    billCount:       today.billCount,
    itemsSold:       today.itemsSold,
    uniqueCustomers: today.uniqueCustomers,

    // Profitability
    grossProfit,
    totalCost,
    margin,
    coveredRevenue,
    profitCoverage:  profitSummary?.coveredItems ?? 0,

    // Payment-mode split (now includes credit)
    cashSales:   today.cashSales,
    upiSales:    today.upiSales,
    creditSales: today.creditSales,

    // Receivables movement
    duesCreated,
    duesCollected,

    // Discounts + returns
    discount:       today.discount,
    returnsTotal:   Number(returnsToday?.total ?? 0),
    returnsCount:   returnsToday?.count ?? 0,

    // Stock IN
    stockIn: { totalUnits: stockIn.totalIn, txCount: stockIn.txCount },

    // Comparison rows for delta chips
    yesterday: { totalAmount: yesterday.totalAmount, billCount: yesterday.billCount, itemsSold: yesterday.itemsSold },
    lastWeek:  { totalAmount: lastWeek.totalAmount,  billCount: lastWeek.billCount,  itemsSold: lastWeek.itemsSold  },

    // Hourly
    hourly: hourlyFull,

    // Lists
    topProducts: topProducts.map((p) => {
      const qty     = Number(p.totalQty);
      const revenue = Number(p.totalRevenue);
      const cost    = p.purchasePrice != null ? Number(p.purchasePrice) * qty : null;
      const profit  = cost != null ? revenue - cost : null;
      const margin  = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;
      return {
        productId:    p.productId,
        productName:  p.productName,
        productSku:   p.productSku,
        totalQty:     qty,
        totalRevenue: revenue,
        profit,
        margin,
      };
    }),
    topCustomers: topCustomers.map((c) => ({
      customerPhone: c.customerPhone,
      customerName:  c.customerName,
      totalSpent:    Number(c.totalSpent),
      billCount:     c.billCount,
    })),
  });
});

export default router;
