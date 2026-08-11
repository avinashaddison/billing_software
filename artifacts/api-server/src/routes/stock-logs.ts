import { Router, type IRouter } from "express";
import { eq, desc, and, or, ilike, sql, type SQL } from "drizzle-orm";
import { db, stockLogsTable, productsTable } from "@workspace/db";
import { ListStockLogsQueryParams, ListStockEntrySummaryQueryParams } from "@workspace/api-zod";
import { tenantWhere } from "../lib/tenant";
import { istToday } from "../lib/ist";

const router: IRouter = Router();

/**
 * The shop's business day is an Asia/Kolkata calendar day, so a date-range
 * filter has to compare IST calendar dates — not raw UTC timestamps. Using the
 * stored timestamp directly would put late-evening IST entries on the previous
 * day and make this disagree with the dashboard and reports.
 */
/* The zod pattern only proves the shape YYYY-MM-DD — not that the day exists.
   Handing '2026-02-30' to ::date makes Postgres raise, which would turn a bad
   client request into a 500 instead of the documented 400. */
const isRealDay = (day: string): boolean => {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Returns a client-safe message when the range is unusable, else null. */
const rangeError = (from?: string, to?: string): string | null => {
  if (from && !isRealDay(from)) return "`from` is not a real calendar date";
  if (to && !isRealDay(to)) return "`to` is not a real calendar date";
  if (from && to && from > to) return "`from` must not be after `to`";
  return null;
};

const istDayAtLeast = (day: string): SQL =>
  sql`DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') >= ${day}::date`;

const istDayAtMost = (day: string): SQL =>
  sql`DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') <= ${day}::date`;

router.get("/stock-logs", async (req, res): Promise<void> => {
  const parsed = ListStockLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, type, today, from, to, limit = 50, offset = 0 } = parsed.data;

  const badRange = rangeError(from, to);
  if (badRange) {
    res.status(400).json({ error: badRange });
    return;
  }

  const conditions = [tenantWhere(stockLogsTable.tenantId, req.tenantId)];
  if (productId) conditions.push(eq(stockLogsTable.productId, productId));
  if (type) conditions.push(eq(stockLogsTable.type, type));
  if (today) {
    // IST business day, matching the dashboard counters and reports.
    conditions.push(sql`DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${istToday()}`);
  }
  if (from) conditions.push(istDayAtLeast(from));
  if (to) conditions.push(istDayAtMost(to));

  const rows = await db
    .select({
      id: stockLogsTable.id,
      productId: stockLogsTable.productId,
      productName: productsTable.name,
      productSku: productsTable.sku,
      type: stockLogsTable.type,
      quantity: stockLogsTable.quantity,
      userId: stockLogsTable.userId,
      createdAt: stockLogsTable.createdAt,
    })
    .from(stockLogsTable)
    .innerJoin(productsTable, eq(stockLogsTable.productId, productsTable.id))
    .where(and(...conditions))
    .orderBy(desc(stockLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

/**
 * Per-product roll-up of stock movements over an IST date range.
 *
 * Answers the shop-floor questions "when did we last take this product in?"
 * and "how much of it came in over the last N months?" in one row per product,
 * instead of making the owner scroll a flat chronological log.
 */
router.get("/stock-logs/entry-summary", async (req, res): Promise<void> => {
  const parsed = ListStockEntrySummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { from, to, type = "IN", search, limit = 200 } = parsed.data;

  const badRange = rangeError(from, to);
  if (badRange) {
    res.status(400).json({ error: badRange });
    return;
  }

  const conditions = [
    tenantWhere(stockLogsTable.tenantId, req.tenantId),
    eq(stockLogsTable.type, type),
  ];
  if (from) conditions.push(istDayAtLeast(from));
  if (to) conditions.push(istDayAtMost(to));

  const term = search?.trim();
  if (term) {
    const like = `%${term}%`;
    const match = or(ilike(productsTable.name, like), ilike(productsTable.sku, like));
    if (match) conditions.push(match);
  }

  /* Totals are deliberately a SEPARATE query over the whole range rather than
     a sum of `rows`. `rows` is capped by `limit`, so summing it would silently
     under-report the period whenever a shop has more matching products than
     the cap — the numbers are labelled "period totals" in the UI, so they have
     to actually cover the period. */
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        productId: stockLogsTable.productId,
        productName: productsTable.name,
        productSku: productsTable.sku,
        totalQuantity: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}), 0)::int`,
        entryCount: sql<number>`COUNT(*)::int`,
        firstEntryAt: sql<string>`MIN(${stockLogsTable.createdAt})`,
        lastEntryAt: sql<string>`MAX(${stockLogsTable.createdAt})`,
      })
      .from(stockLogsTable)
      .innerJoin(productsTable, eq(stockLogsTable.productId, productsTable.id))
      .where(and(...conditions))
      .groupBy(stockLogsTable.productId, productsTable.name, productsTable.sku)
      .orderBy(desc(sql`MAX(${stockLogsTable.createdAt})`))
      .limit(limit),

    db
      .select({
        productCount: sql<number>`COUNT(DISTINCT ${stockLogsTable.productId})::int`,
        totalQuantity: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}), 0)::int`,
        entryCount: sql<number>`COUNT(*)::int`,
      })
      .from(stockLogsTable)
      .innerJoin(productsTable, eq(stockLogsTable.productId, productsTable.id))
      .where(and(...conditions)),
  ]);

  const resolved = totals ?? { productCount: 0, totalQuantity: 0, entryCount: 0 };

  res.json({
    totals: resolved,
    products: rows,
    truncated: resolved.productCount > rows.length,
  });
});

export default router;
