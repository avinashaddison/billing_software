import { Router, type IRouter } from "express";
import { asc, desc, sql, and, eq } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable, returnsTable, billPaymentsTable } from "@workspace/db";
import { tenantWhere } from "../lib/tenant";
import { istToday, istShiftDay } from "../lib/ist";
import { requireRead, type ResourceReadView } from "../middlewares/auth";
import { buildProductReport } from "../lib/product-report";

const router: IRouter = Router();

/** timestamptz of IST midnight for a YYYY-MM-DD day — index-friendly lower
 *  bound that covers the WHOLE first calendar day of a report window (a
 *  rolling `NOW() - interval` cutoff silently drops the early hours of the
 *  window's oldest day). */
const istDayStart = (day: string) => sql`${day}::timestamp AT TIME ZONE 'Asia/Kolkata'`;

/**
 * CTE: per-(bill, product) sold quantity + cost of the ORIGINAL sale lines —
 * used to reverse cost-of-goods when units come back as returns. Aggregated
 * per bill+product BEFORE joining `returns` so a product billed on two lines
 * of the same bill can't fan out and double-count the refund. A bill-product
 * with `unknown_lines > 0` has no reliable cost, so its returns are excluded
 * from profit adjustments — mirroring the "covered" profit base used
 * everywhere else in this file (never invent a cost).
 */
const lineCostsCte = () => db.$with("line_costs").as(
  db.select({
      billId:       saleItemsTable.saleId,
      productId:    saleItemsTable.productId,
      soldQty:      sql<string>`SUM(${saleItemsTable.quantity})`.as("sold_qty"),
      totalCost:    sql<string>`SUM(COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) * ${saleItemsTable.quantity})`.as("total_cost"),
      unknownLines: sql<number>`COUNT(*) FILTER (WHERE COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) IS NULL)::int`.as("unknown_lines"),
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
    .where(sql`${saleItemsTable.productId} IS NOT NULL`)
    .groupBy(saleItemsTable.saleId, saleItemsTable.productId),
);

/**
 * GET /api/reports/revenue?days=7
 * Returns daily revenue for the past N days (default 7).
 */
router.get("/reports/revenue", async (req, res): Promise<void> => {
  const days = Math.min(parseInt(String(req.query.days ?? 7), 10) || 7, 90);
  const fromDay = istShiftDay(istToday(), -(days - 1));

  const [rows, refundRows] = await Promise.all([
    db.select({
        day:         sql<string>`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`.as("day"),
        totalAmount: sql<string>`SUM(${billsTable.totalAmount})`.as("total_amount"),
        billCount:   sql<number>`COUNT(*)`.as("bill_count"),
        itemsCount:  sql<number>`SUM(${billsTable.itemsCount})`.as("items_count"),
      })
      .from(billsTable)
      .where(and(
        sql`${billsTable.createdAt} >= ${istDayStart(fromDay)}`,
        tenantWhere(billsTable.tenantId, req.tenantId),
      ))
      .groupBy(sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`)
      .orderBy(sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`),

    /* Refunds processed per IST day — netted off the same day's revenue so a
     * return actually pulls the trend line down (bills stay immutable). */
    db.select({
        day:     sql<string>`DATE(${returnsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`.as("day"),
        refunds: sql<string>`SUM(${returnsTable.refundAmount})`.as("refunds"),
      })
      .from(returnsTable)
      .where(and(
        sql`${returnsTable.createdAt} >= ${istDayStart(fromDay)}`,
        tenantWhere(returnsTable.tenantId, req.tenantId),
      ))
      .groupBy(sql`DATE(${returnsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`),
  ]);

  // Build a map of existing data
  const dataMap = new Map(
    rows.map((r) => [r.day, { totalAmount: Number(r.totalAmount), billCount: Number(r.billCount), itemsCount: Number(r.itemsCount) }])
  );
  const refundMap = new Map(refundRows.map((r) => [r.day, Number(r.refunds)]));

  // Fill every day in the window with zeros if no data
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00");
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toLocaleDateString("en-CA");
    const existing = dataMap.get(dayStr);
    const gross    = existing?.totalAmount ?? 0;
    const refunds  = refundMap.get(dayStr) ?? 0;
    result.push({
      day: dayStr,
      totalAmount: gross,
      billCount:   existing?.billCount ?? 0,
      itemsCount:  existing?.itemsCount ?? 0,
      refunds,
      netAmount:   gross - refunds,
    });
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
  const fromDay = istShiftDay(istToday(), -(days - 1));

  /* Cost = the sale-time snapshot on the line item, falling back to the
     product's current purchase price for rows sold before snapshots existed.
     Profit is only reported when EVERY unit has a known cost, so a partially
     priced SKU never shows an overstated margin. */
  const lineCost = sql`COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice})`;

  const rows = await db
    .select({
      productId:     saleItemsTable.productId,
      productName:   productsTable.name,
      productSku:    productsTable.sku,
      category:      productsTable.category,
      totalQty:      sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
      totalRevenue:  sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
      billCount:     sql<number>`COUNT(DISTINCT ${saleItemsTable.saleId})::int`.as("bill_count"),
      totalCost:     sql<string>`COALESCE(SUM(${lineCost} * ${saleItemsTable.quantity}), 0)`.as("total_cost"),
      costedQty:     sql<number>`COALESCE(SUM(${saleItemsTable.quantity}) FILTER (WHERE ${lineCost} IS NOT NULL), 0)::int`.as("costed_qty"),
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
    .innerJoin(billsTable,    sql`${saleItemsTable.saleId}    = ${billsTable.id}`)
    .where(and(
      sql`${billsTable.createdAt} >= ${istDayStart(fromDay)}`,
      tenantWhere(billsTable.tenantId, req.tenantId),
    ))
    .groupBy(
      saleItemsTable.productId, productsTable.name, productsTable.sku,
      productsTable.category,
    )
    .orderBy(desc(sql`SUM(${saleItemsTable.subtotal})`))
    .limit(100);

  res.json(rows.map((p) => {
    const qty     = Number(p.totalQty);
    const revenue = Number(p.totalRevenue);
    const cost    = p.costedQty === qty ? Number(p.totalCost) : null;
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

/**
 * GET /api/reports/products?days=30
 *
 * Dedicated product report. Unlike sku-performance, this includes the full
 * catalogue (including unsold products) so managers can see current and
 * low-stock state beside sales performance.
 *
 * The read gate sets one of two views:
 * - manager: operational sales + stock fields only
 * - owner: manager fields plus purchase cost, stock value and profitability
 *
 * The response builder uses separate allow-listed shapes, so sensitive fields
 * are absent — not merely null — from a manager response.
 */
router.get("/reports/products", requireRead("productReports"), async (req, res): Promise<void> => {
  const rawDays = Number(req.query.days ?? 30);
  if (!Number.isInteger(rawDays) || ![7, 30, 90].includes(rawDays)) {
    res.status(400).json({ error: "days must be one of 7, 30, or 90" });
    return;
  }

  const days = rawDays;
  const toDay = istToday();
  const fromDay = istShiftDay(toDay, -(days - 1));
  const toDayExclusive = istShiftDay(toDay, 1);
  const tenantId = req.tenantId;
  const lineCost = sql`COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice})`;
  const lineCosts = lineCostsCte();

  /* Allocate the amount the customer actually paid back onto each line.
     sale_items.subtotal is after line discounts but before the whole-bill
     discount; using it directly would overstate every product's revenue and
     profit whenever checkout applied a bill-level discount or rounding. */
  const billLineTotals = db.$with("product_report_bill_totals").as(
    db.select({
        billId: saleItemsTable.saleId,
        lineSubtotal: sql<string>`SUM(${saleItemsTable.subtotal})`.as("line_subtotal"),
      })
      .from(saleItemsTable)
      .where(tenantWhere(saleItemsTable.tenantId, tenantId))
      .groupBy(saleItemsTable.saleId),
  );
  const allocatedLineRevenue = sql`
    CASE
      WHEN ${billLineTotals.lineSubtotal}::numeric <> 0
      THEN ${saleItemsTable.subtotal} * ${billsTable.totalAmount} / ${billLineTotals.lineSubtotal}
      ELSE 0
    END
  `;

  const productSales = db.$with("product_report_sales").as(
    db.select({
        productId: saleItemsTable.productId,
        totalQty: sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
        totalRevenue: sql<string>`SUM(${allocatedLineRevenue})`.as("total_revenue"),
        billCount: sql<number>`COUNT(DISTINCT ${saleItemsTable.saleId})::int`.as("bill_count"),
        totalCost: sql<string>`COALESCE(SUM(${lineCost} * ${saleItemsTable.quantity}) FILTER (WHERE ${lineCost} IS NOT NULL), 0)`.as("total_cost"),
        costedQty: sql<number>`COALESCE(SUM(${saleItemsTable.quantity}) FILTER (WHERE ${lineCost} IS NOT NULL), 0)::int`.as("costed_qty"),
        coveredRevenue: sql<string>`COALESCE(SUM(${allocatedLineRevenue}) FILTER (WHERE ${lineCost} IS NOT NULL), 0)`.as("covered_revenue"),
      })
      .from(saleItemsTable)
      .innerJoin(billsTable, eq(saleItemsTable.saleId, billsTable.id))
      .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
      .innerJoin(billLineTotals, eq(saleItemsTable.saleId, billLineTotals.billId))
      .where(and(
        sql`${billsTable.createdAt} >= ${istDayStart(fromDay)}`,
        sql`${billsTable.createdAt} < ${istDayStart(toDayExclusive)}`,
        tenantWhere(billsTable.tenantId, tenantId),
        tenantWhere(productsTable.tenantId, tenantId),
      ))
      .groupBy(saleItemsTable.productId),
  );

  /* Returns are reported on the IST day they are processed, matching the
     existing EOD/net-sales convention. Revenue loses the refund; cost comes
     back into stock. If any original bill-product line has unknown cost, its
     returned cost remains uncovered rather than being invented. */
  const productReturns = db.$with("product_report_returns").as(
    db.select({
        productId: returnsTable.productId,
        returnedQty: sql<number>`SUM(${returnsTable.quantity})::int`.as("returned_qty"),
        refunds: sql<string>`SUM(${returnsTable.refundAmount})`.as("refunds"),
        returnedCost: sql<string>`COALESCE(SUM(
          (${lineCosts.totalCost} / NULLIF(${lineCosts.soldQty}, 0)) * ${returnsTable.quantity}
        ) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)`.as("returned_cost"),
        costedReturnQty: sql<number>`COALESCE(SUM(${returnsTable.quantity}) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)::int`.as("costed_return_qty"),
        coveredRefunds: sql<string>`COALESCE(SUM(${returnsTable.refundAmount}) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)`.as("covered_refunds"),
      })
      .from(returnsTable)
      .innerJoin(lineCosts, and(
        eq(lineCosts.billId, returnsTable.billId),
        eq(lineCosts.productId, returnsTable.productId),
      ))
      .where(and(
        sql`${returnsTable.createdAt} >= ${istDayStart(fromDay)}`,
        sql`${returnsTable.createdAt} < ${istDayStart(toDayExclusive)}`,
        tenantWhere(returnsTable.tenantId, tenantId),
      ))
      .groupBy(returnsTable.productId),
  );

  const rows = await db
    .with(billLineTotals, lineCosts, productSales, productReturns)
    .select({
      productId: productsTable.id,
      productName: productsTable.name,
      productSku: productsTable.sku,
      category: productsTable.category,
      currentStock: productsTable.stock,
      lowStockThreshold: productsTable.lowStockThreshold,
      purchasePrice: productsTable.purchasePrice,
      totalQty: sql<number>`(COALESCE(${productSales.totalQty}, 0) - COALESCE(${productReturns.returnedQty}, 0))::int`,
      totalRevenue: sql<string>`COALESCE(${productSales.totalRevenue}, 0) - COALESCE(${productReturns.refunds}, 0)`,
      billCount: productSales.billCount,
      totalCost: sql<string>`COALESCE(${productSales.totalCost}, 0) - COALESCE(${productReturns.returnedCost}, 0)`,
      costedQty: sql<number>`(COALESCE(${productSales.costedQty}, 0) - COALESCE(${productReturns.costedReturnQty}, 0))::int`,
      coveredRevenue: sql<string>`COALESCE(${productSales.coveredRevenue}, 0) - COALESCE(${productReturns.coveredRefunds}, 0)`,
    })
    .from(productsTable)
    .leftJoin(productSales, eq(productsTable.id, productSales.productId))
    .leftJoin(productReturns, eq(productsTable.id, productReturns.productId))
    .where(tenantWhere(productsTable.tenantId, tenantId))
    .orderBy(
      desc(sql`COALESCE(${productSales.totalRevenue}, 0) - COALESCE(${productReturns.refunds}, 0)`),
      asc(productsTable.name),
    );

  const view: ResourceReadView =
    res.locals.resourceReadView === "owner" ? "owner" : "manager";
  res.json(buildProductReport(rows, view, days, fromDay, toDay));
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
  /** Refunds processed on this IST day — totalAmount − refunds = net revenue. */
  refunds:     number;
};

/** One day's totals — used both for the requested date AND for the
 *  "yesterday" / "same day last week" comparison rows so the front-end
 *  can render delta chips without an extra round trip. */
async function dailyTotals(targetDate: string, tenantId: string | null): Promise<SalesTotals> {
  const refundsQuery = db
    .select({ refunds: sql<string>`COALESCE(SUM(${returnsTable.refundAmount}), 0)`.as("refunds") })
    .from(returnsTable)
    .where(and(
      sql`DATE(${returnsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(returnsTable.tenantId, tenantId),
    ));

  const salesQuery = db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${billsTable.totalAmount}), 0)`.as("total_amount"),
      billCount:   sql<number>`COUNT(*)::int`.as("bill_count"),
      itemsSold:   sql<number>`COALESCE(SUM(${billsTable.itemsCount}), 0)::int`.as("items_sold"),
      cashSales:   sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'cash'   THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("cash"),
      upiSales:    sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'upi'    THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("upi"),
      creditSales: sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'credit' THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("credit"),
      /* discount_amount is the computed rupee discount stored at checkout
         (and backfilled by migration 0014). The raw `discount` column holds
         whatever the cashier typed (a percent or an unclamped amount) and
         must never be summed directly. */
      discount:    sql<string>`COALESCE(SUM(COALESCE(${billsTable.discountAmount}, 0)), 0)`.as("discount"),
      uniqueCustomers: sql<number>`COUNT(DISTINCT ${billsTable.customerPhone})::int`.as("unique_customers"),
    })
    .from(billsTable)
    .where(and(
      sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
      tenantWhere(billsTable.tenantId, tenantId),
    ));

  const [[row], [refundRow]] = await Promise.all([salesQuery, refundsQuery]);

  return {
    totalAmount: Number(row?.totalAmount ?? 0),
    billCount:   row?.billCount ?? 0,
    itemsSold:   row?.itemsSold ?? 0,
    cashSales:   Number(row?.cashSales ?? 0),
    upiSales:    Number(row?.upiSales ?? 0),
    creditSales: Number(row?.creditSales ?? 0),
    discount:    Number(row?.discount ?? 0),
    uniqueCustomers: row?.uniqueCustomers ?? 0,
    refunds:     Number(refundRow?.refunds ?? 0),
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

  const lineCosts = lineCostsCte();

  /* Run independent queries in parallel — big speed win when the day has
   * a lot of bills, since these would otherwise be 6 sequential round trips. */
  const [
    today, yesterday, lastWeek,
    topProducts, profitSummary, stockIn, hourly, topCustomers, paymentsToday, returnsToday,
    returnsImpact,
  ] = await Promise.all([
    dailyTotals(targetDate,              tenantId),
    dailyTotals(shiftDate(targetDate, -1), tenantId),
    dailyTotals(shiftDate(targetDate, -7), tenantId),

    db.select({
        productId:     saleItemsTable.productId,
        productName:   productsTable.name,
        productSku:    productsTable.sku,
        totalQty:      sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
        totalRevenue:  sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
        totalCost:     sql<string>`COALESCE(SUM(COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) * ${saleItemsTable.quantity}), 0)`.as("total_cost"),
        costedQty:     sql<number>`COALESCE(SUM(${saleItemsTable.quantity}) FILTER (WHERE COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) IS NOT NULL), 0)::int`.as("costed_qty"),
      })
      .from(saleItemsTable)
      .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
      .innerJoin(billsTable,    sql`${saleItemsTable.saleId}    = ${billsTable.id}`)
      .where(and(
        sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(billsTable.tenantId, tenantId),
      ))
      .groupBy(saleItemsTable.productId, productsTable.name, productsTable.sku)
      .orderBy(desc(sql`SUM(${saleItemsTable.quantity})`))
      .limit(10),

    /* Profit base. LEFT JOIN (not INNER) so MANUAL / non-inventory lines
       (productId IS NULL) are kept: they have no purchase cost, so their full
       subtotal is counted as profit (a gift-wrap, service charge, etc.). A
       line is "covered" — and thus part of the profit base — when it is either
       a manual line OR a catalogue item whose cost is known: the sale-time
       snapshot (sale_items.purchase_price) when present, else the product's
       current purchase price. Catalogue items with no known cost stay
       excluded so we never overstate margin. */
    db.select({
        totalCost:      sql<string>`COALESCE(SUM(CASE WHEN COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) IS NOT NULL THEN COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) * ${saleItemsTable.quantity} ELSE 0 END), 0)`.as("total_cost"),
        coveredItems:   sql<number>`COUNT(*) FILTER (WHERE ${saleItemsTable.productId} IS NULL OR COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) IS NOT NULL)::int`.as("covered_items"),
        coveredRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${saleItemsTable.productId} IS NULL OR COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice}) IS NOT NULL THEN ${saleItemsTable.subtotal} ELSE 0 END), 0)`.as("covered_revenue"),
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

    /* Profit impact of today's returns: the refund value on cost-covered
     * lines comes OUT of profit, while the cost of the returned goods goes
     * BACK (the units are in stock and sellable again). */
    db.with(lineCosts)
      .select({
        coveredRefunds: sql<string>`COALESCE(SUM(${returnsTable.refundAmount}) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)`.as("covered_refunds"),
        returnedCost:   sql<string>`COALESCE(SUM((${lineCosts.totalCost} / NULLIF(${lineCosts.soldQty}, 0)) * ${returnsTable.quantity}) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)`.as("returned_cost"),
      })
      .from(returnsTable)
      .innerJoin(lineCosts, and(
        eq(lineCosts.billId, returnsTable.billId),
        eq(lineCosts.productId, returnsTable.productId),
      ))
      .where(and(
        sql`DATE(${returnsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${targetDate}`,
        tenantWhere(returnsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { coveredRefunds: "0", returnedCost: "0" }),
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

  /* Net-of-returns view. A refund reduces the revenue of the day the return
   * was PROCESSED (bills stay immutable — standard net-sales practice).
   * Profit loses the refunded value but regains the cost of the returned
   * goods; both adjustments only apply to returns whose original line cost
   * is known (same "covered" rule as above). Refunds on unknown-cost lines
   * still reduce net revenue — the cash left the drawer either way. */
  const returnsTotal   = Number(returnsToday?.total ?? 0);
  const coveredRefunds = Number(returnsImpact?.coveredRefunds ?? 0);
  const returnsCost    = Number(returnsImpact?.returnedCost ?? 0);
  const netRevenue     = today.totalAmount - returnsTotal;
  const netProfit      = grossProfit - coveredRefunds + returnsCost;
  const netCoveredRev  = coveredRevenue - coveredRefunds;
  const netMargin      = netCoveredRev > 0 ? (netProfit / netCoveredRev) * 100 : 0;

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
    returnsTotal,
    returnsCount:   returnsToday?.count ?? 0,
    returnsCost,

    // Net-of-returns headline figures
    netRevenue,
    netProfit,
    netMargin,

    // Stock IN
    stockIn: { totalUnits: stockIn.totalIn, txCount: stockIn.txCount },

    // Comparison rows for delta chips (netAmount lets the UI compare net-to-net)
    yesterday: { totalAmount: yesterday.totalAmount, billCount: yesterday.billCount, itemsSold: yesterday.itemsSold, refunds: yesterday.refunds, netAmount: yesterday.totalAmount - yesterday.refunds },
    lastWeek:  { totalAmount: lastWeek.totalAmount,  billCount: lastWeek.billCount,  itemsSold: lastWeek.itemsSold,  refunds: lastWeek.refunds,  netAmount: lastWeek.totalAmount  - lastWeek.refunds  },

    // Hourly
    hourly: hourlyFull,

    // Lists
    topProducts: topProducts.map((p) => {
      const qty     = Number(p.totalQty);
      const revenue = Number(p.totalRevenue);
      const cost    = p.costedQty === qty ? Number(p.totalCost) : null;
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

/**
 * GET /api/reports/profit?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Full profit & investment statement over an arbitrary date range (IST
 * calendar days, both ends inclusive). Powers the Excel-style Profit tab.
 *
 * Per-item rows: every catalogue SKU sold in the range (qty, revenue,
 * cost-of-goods = investment, profit, margin) plus manual/non-inventory
 * lines grouped by their custom name (zero cost → full margin, matching the
 * EOD report's treatment). Catalogue items with NO known purchase price are
 * flagged (`costKnown: false`) and excluded from the profit totals so the
 * margin is never overstated.
 *
 * Also returns the period's stock purchases (stock IN) valued at the
 * product's CURRENT purchase price — stock_logs stores no price snapshot,
 * so it's an estimate, labelled as such in the UI.
 */
router.get("/reports/profit", async (req, res): Promise<void> => {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const today = istToday();
  let from = String(req.query.from ?? "");
  let to   = String(req.query.to   ?? "");
  if (!DATE_RE.test(to))   to   = today;
  if (!DATE_RE.test(from)) from = istShiftDay(to, -29);
  if (from > to) [from, to] = [to, from];
  /* Hard cap the window so a typo'd year can't scan the whole table. */
  if (istShiftDay(from, 366) < to) from = istShiftDay(to, -366);

  const tenantId = req.tenantId;
  const lo = istDayStart(from);
  const hi = istDayStart(istShiftDay(to, 1)); // exclusive upper bound
  const billRange = and(
    sql`${billsTable.createdAt} >= ${lo}`,
    sql`${billsTable.createdAt} < ${hi}`,
    tenantWhere(billsTable.tenantId, tenantId),
  );

  const lineCost = sql`COALESCE(${saleItemsTable.purchasePrice}, ${productsTable.purchasePrice})`;
  const lineCosts = lineCostsCte();

  const [skuRows, manualRows, billTotals, purchases, returnsAgg, returnsImpact] = await Promise.all([
    /* Catalogue items sold in the range, one row per SKU. */
    db.select({
        productId:    saleItemsTable.productId,
        productName:  productsTable.name,
        productSku:   productsTable.sku,
        category:     productsTable.category,
        totalQty:     sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
        totalRevenue: sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
        billCount:    sql<number>`COUNT(DISTINCT ${saleItemsTable.saleId})::int`.as("bill_count"),
        totalCost:    sql<string>`COALESCE(SUM(${lineCost} * ${saleItemsTable.quantity}), 0)`.as("total_cost"),
        costedQty:    sql<number>`COALESCE(SUM(${saleItemsTable.quantity}) FILTER (WHERE ${lineCost} IS NOT NULL), 0)::int`.as("costed_qty"),
      })
      .from(saleItemsTable)
      .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
      .innerJoin(billsTable,    sql`${saleItemsTable.saleId}    = ${billsTable.id}`)
      .where(billRange)
      .groupBy(saleItemsTable.productId, productsTable.name, productsTable.sku, productsTable.category)
      .orderBy(desc(sql`SUM(${saleItemsTable.subtotal})`)),

    /* Manual / non-inventory lines, grouped by the typed name. */
    db.select({
        customName:   sql<string>`COALESCE(${saleItemsTable.customName}, 'Manual item')`.as("custom_name"),
        totalQty:     sql<number>`SUM(${saleItemsTable.quantity})::int`.as("total_qty"),
        totalRevenue: sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
        billCount:    sql<number>`COUNT(DISTINCT ${saleItemsTable.saleId})::int`.as("bill_count"),
      })
      .from(saleItemsTable)
      .innerJoin(billsTable, sql`${saleItemsTable.saleId} = ${billsTable.id}`)
      .where(and(sql`${saleItemsTable.productId} IS NULL`, billRange))
      .groupBy(sql`COALESCE(${saleItemsTable.customName}, 'Manual item')`)
      .orderBy(desc(sql`SUM(${saleItemsTable.subtotal})`)),

    /* Range-wide bill headline numbers. */
    db.select({
        billCount:   sql<number>`COUNT(*)::int`.as("bill_count"),
        totalAmount: sql<string>`COALESCE(SUM(${billsTable.totalAmount}), 0)`.as("total_amount"),
      })
      .from(billsTable)
      .where(billRange)
      .then((rows) => rows[0] ?? { billCount: 0, totalAmount: "0" }),

    /* Stock purchased (IN) during the range, valued at current cost. */
    db.select({
        units:    sql<number>`COALESCE(SUM(${stockLogsTable.quantity}), 0)::int`.as("units"),
        txCount:  sql<number>`COUNT(*)::int`.as("tx_count"),
        estValue: sql<string>`COALESCE(SUM(${stockLogsTable.quantity} * COALESCE(${productsTable.purchasePrice}, 0)), 0)`.as("est_value"),
      })
      .from(stockLogsTable)
      .innerJoin(productsTable, sql`${stockLogsTable.productId} = ${productsTable.id}`)
      .where(and(
        sql`${stockLogsTable.type} = 'IN'`,
        sql`${stockLogsTable.createdAt} >= ${lo}`,
        sql`${stockLogsTable.createdAt} < ${hi}`,
        tenantWhere(stockLogsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { units: 0, txCount: 0, estValue: "0" }),

    /* ALL refunds processed in the range — netted against billed revenue. */
    db.select({
        refunds: sql<string>`COALESCE(SUM(${returnsTable.refundAmount}), 0)`.as("refunds"),
        count:   sql<number>`COUNT(*)::int`.as("count"),
      })
      .from(returnsTable)
      .where(and(
        sql`${returnsTable.createdAt} >= ${lo}`,
        sql`${returnsTable.createdAt} < ${hi}`,
        tenantWhere(returnsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { refunds: "0", count: 0 }),

    /* Cost-covered slice of those refunds + the cost of goods that came back
     * into stock (see lineCostsCte for the fan-out / unknown-cost rules). */
    db.with(lineCosts)
      .select({
        coveredRefunds: sql<string>`COALESCE(SUM(${returnsTable.refundAmount}) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)`.as("covered_refunds"),
        returnedCost:   sql<string>`COALESCE(SUM((${lineCosts.totalCost} / NULLIF(${lineCosts.soldQty}, 0)) * ${returnsTable.quantity}) FILTER (WHERE ${lineCosts.unknownLines} = 0), 0)`.as("returned_cost"),
      })
      .from(returnsTable)
      .innerJoin(lineCosts, and(
        eq(lineCosts.billId, returnsTable.billId),
        eq(lineCosts.productId, returnsTable.productId),
      ))
      .where(and(
        sql`${returnsTable.createdAt} >= ${lo}`,
        sql`${returnsTable.createdAt} < ${hi}`,
        tenantWhere(returnsTable.tenantId, tenantId),
      ))
      .then((rows) => rows[0] ?? { coveredRefunds: "0", returnedCost: "0" }),
  ]);

  const rows = [
    ...skuRows.map((p) => {
      const qty       = Number(p.totalQty);
      const revenue   = Number(p.totalRevenue);
      const costKnown = p.costedQty === qty;
      const cost      = costKnown ? Number(p.totalCost) : null;
      const profit    = cost != null ? revenue - cost : null;
      return {
        kind:      "sku" as const,
        name:      p.productName,
        sku:       p.productSku,
        category:  p.category,
        qty,
        revenue,
        cost,
        profit,
        margin:    profit != null && revenue > 0 ? (profit / revenue) * 100 : null,
        billCount: Number(p.billCount),
        costKnown,
      };
    }),
    ...manualRows.map((m) => {
      const revenue = Number(m.totalRevenue);
      return {
        kind:      "manual" as const,
        name:      m.customName,
        sku:       null,
        category:  null,
        qty:       Number(m.totalQty),
        revenue,
        cost:      0,
        profit:    revenue,
        margin:    revenue > 0 ? 100 : null,
        billCount: Number(m.billCount),
        costKnown: true,
      };
    }),
  ].sort((a, b) => b.revenue - a.revenue);

  /* Totals over rows with a KNOWN cost (same "covered" base as EOD). */
  let coveredRevenue = 0, totalCost = 0, uncostedRevenue = 0, totalQty = 0;
  for (const r of rows) {
    totalQty += r.qty;
    if (r.costKnown && r.cost != null) { coveredRevenue += r.revenue; totalCost += r.cost; }
    else uncostedRevenue += r.revenue;
  }
  const totalProfit = coveredRevenue - totalCost;

  /* Net-of-returns totals — same rules as the EOD report: every refund nets
   * against revenue; profit only adjusts for returns whose original line
   * cost is known (refund comes out, cost of restocked goods goes back). */
  const billedRevenue  = Number(billTotals.totalAmount);
  const refunds        = Number(returnsAgg.refunds);
  const coveredRefunds = Number(returnsImpact.coveredRefunds);
  const returnedCost   = Number(returnsImpact.returnedCost);
  const netProfit      = totalProfit - coveredRefunds + returnedCost;
  const netCoveredRev  = coveredRevenue - coveredRefunds;

  res.json({
    from,
    to,
    rows,
    totals: {
      revenue:         billedRevenue,
      itemRevenue:     coveredRevenue + uncostedRevenue,
      investment:      totalCost,
      profit:          totalProfit,
      margin:          coveredRevenue > 0 ? (totalProfit / coveredRevenue) * 100 : 0,
      qty:             totalQty,
      billCount:       Number(billTotals.billCount),
      uncostedRevenue,
      refunds,
      returnsCount:    Number(returnsAgg.count),
      netRevenue:      billedRevenue - refunds,
      netProfit,
      netMargin:       netCoveredRev > 0 ? (netProfit / netCoveredRev) * 100 : 0,
    },
    purchases: {
      units:    Number(purchases.units),
      txCount:  Number(purchases.txCount),
      estValue: Number(purchases.estValue),
    },
  });
});

export default router;
