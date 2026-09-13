import { Router, type IRouter } from "express";
import { eq, desc, asc, and, or, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, stockLogsTable, productsTable, billsTable, saleItemsTable, returnsTable,
  staffProfilesTable, suppliersTable,
} from "@workspace/db";
import {
  GetProductStockHistoryParams,
  GetProductTimelineParams,
  ListStockLogsQueryParams,
  ListStockEntrySummaryQueryParams,
} from "@workspace/api-zod";
import { tenantWhere } from "../lib/tenant";
import { liveProduct } from "../lib/product-scope";
import { istToday } from "../lib/ist";
import { buildStockBatchHistory } from "../lib/stock-batch-history";
import { deriveStockTotals } from "../lib/stock-totals";
import { shapeTimelineEvent, type ProductTimeline, type TimelineRow, type TimelineView } from "../lib/product-timeline";
import { requireRead } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * Movement rows that belong to the caller's tenant — plus the handful written
 * before tenancy existed, which carry a NULL tenant_id (two OUT rows on the
 * live shop). Those rows are only ever read through a product that has already
 * been tenant-checked, so admitting NULL cannot leak another shop's data,
 * whereas the strict `tenantWhere` silently drops them and mis-states a
 * product's sold figure (and, by difference, its opening stock). Rows tagged
 * with a *different* tenant stay excluded even if they point at our product.
 */
const ownOrLegacyLog = (tenantId: string | null | undefined): SQL =>
  tenantId == null
    ? isNull(stockLogsTable.tenantId)
    : (or(eq(stockLogsTable.tenantId, tenantId), isNull(stockLogsTable.tenantId)) as SQL);

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

router.get("/products/:id/stock-history", async (req, res): Promise<void> => {
  const parsed = GetProductStockHistoryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const snapshot = await db.transaction(async (tx) => {
    const [product] = await tx
      .select({
        id: productsTable.id,
        stock: productsTable.stock,
      })
      .from(productsTable)
      .where(and(
        eq(productsTable.id, parsed.data.id),
        tenantWhere(productsTable.tenantId, req.tenantId),
      ));

    if (!product) return null;

    const movements = await tx
      .select({
        id: stockLogsTable.id,
        type: stockLogsTable.type,
        quantity: stockLogsTable.quantity,
        userId: stockLogsTable.userId,
        purchasePrice: stockLogsTable.purchasePrice,
        supplierId: stockLogsTable.supplierId,
        supplierName: stockLogsTable.supplierName,
        invoiceNumber: stockLogsTable.invoiceNumber,
        note: stockLogsTable.note,
        createdAt: stockLogsTable.createdAt,
      })
      .from(stockLogsTable)
      .where(and(
        eq(stockLogsTable.productId, product.id),
        ownOrLegacyLog(req.tenantId),
      ))
      .orderBy(asc(stockLogsTable.createdAt), asc(stockLogsTable.id));

    return { product, movements };
  }, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });

  if (!snapshot) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(buildStockBatchHistory(
    snapshot.product.id,
    snapshot.product.stock,
    snapshot.movements,
  ));
});

/**
 * Dated movement history of one product with the people behind each line:
 * who recorded it, and for sales/returns which bill and customer. See
 * lib/product-timeline.ts for why bills are matched by `created_at`.
 *
 * History-facing: an archived product stays readable so a row on a report
 * can still be explained after the product is deleted.
 */
router.get("/products/:id/timeline", requireRead("suppliers", "logs"), async (req, res): Promise<void> => {
  const parsed = GetProductTimelineParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  /* products.id is a uuid column: a malformed id is "no such product", not a
     database error (Postgres would otherwise reject the comparison itself). */
  if (!z.uuid().safeParse(parsed.data.id).success) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const ownOrLegacyBill = (tenantId: string | null | undefined): SQL =>
    tenantId == null
      ? isNull(billsTable.tenantId)
      : (or(eq(billsTable.tenantId, tenantId), isNull(billsTable.tenantId)) as SQL);

  const snapshot = await db.transaction(async (tx) => {
    const [product] = await tx
      .select({
        id: productsTable.id,
        name: productsTable.name,
        sku: productsTable.sku,
        category: productsTable.category,
        stock: productsTable.stock,
        deletedAt: productsTable.deletedAt,
        createdAt: productsTable.createdAt,
        supplierName: suppliersTable.name,
      })
      .from(productsTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, productsTable.supplierId))
      .where(and(
        eq(productsTable.id, parsed.data.id),
        tenantWhere(productsTable.tenantId, req.tenantId),
      ));

    if (!product) return null;

    /* The bill a sale row belongs to: written in the same transaction as the
       ledger row, hence the identical timestamp. Grouped per bill so a product
       billed on two lines of one bill still yields a single match. */
    const saleBill = tx
      .select({
        billId: billsTable.id,
        billNumber: billsTable.billNumber,
        customerName: billsTable.customerName,
        customerPhone: billsTable.customerPhone,
        paymentMode: billsTable.paymentMode,
        lineCount: sql<number>`COUNT(*)::int`.as("line_count"),
        minPrice: sql<string>`MIN(${saleItemsTable.price})`.as("min_price"),
        maxPrice: sql<string>`MAX(${saleItemsTable.price})`.as("max_price"),
        linesTotal: sql<string>`SUM(${saleItemsTable.subtotal})`.as("lines_total"),
      })
      .from(billsTable)
      .innerJoin(saleItemsTable, and(
        eq(saleItemsTable.saleId, billsTable.id),
        eq(saleItemsTable.productId, stockLogsTable.productId),
      ))
      .where(and(
        eq(stockLogsTable.type, "OUT"),
        eq(billsTable.createdAt, stockLogsTable.createdAt),
        ownOrLegacyBill(req.tenantId),
      ))
      .groupBy(billsTable.id)
      .orderBy(billsTable.id)
      .limit(1)
      .as("sale_bill");

    /* Same idea for a customer return: the returns row and the RETURN ledger
       row share one transaction, and the returns row points at the bill. */
    const returnRow = tx
      .select({
        billId: returnsTable.billId,
        refundAmount: returnsTable.refundAmount,
        reason: returnsTable.reason,
      })
      .from(returnsTable)
      .where(and(
        eq(stockLogsTable.type, "RETURN"),
        eq(returnsTable.productId, stockLogsTable.productId),
        eq(returnsTable.createdAt, stockLogsTable.createdAt),
      ))
      .orderBy(returnsTable.id)
      .limit(1)
      .as("return_row");

    const returnBill = tx
      .select({
        billId: billsTable.id,
        billNumber: billsTable.billNumber,
        customerName: billsTable.customerName,
        customerPhone: billsTable.customerPhone,
        paymentMode: billsTable.paymentMode,
      })
      .from(billsTable)
      .where(and(eq(billsTable.id, returnRow.billId), ownOrLegacyBill(req.tenantId)))
      .limit(1)
      .as("return_bill");

    const rows = await tx
      .select({
        id: stockLogsTable.id,
        type: stockLogsTable.type,
        quantity: stockLogsTable.quantity,
        userId: stockLogsTable.userId,
        staffName: staffProfilesTable.name,
        purchasePrice: stockLogsTable.purchasePrice,
        supplierName: stockLogsTable.supplierName,
        invoiceNumber: stockLogsTable.invoiceNumber,
        note: stockLogsTable.note,
        createdAt: stockLogsTable.createdAt,
        billId: sql<string | null>`COALESCE(${saleBill.billId}, ${returnBill.billId})`,
        billNumber: sql<number | null>`COALESCE(${saleBill.billNumber}, ${returnBill.billNumber})`,
        customerName: sql<string | null>`COALESCE(${saleBill.customerName}, ${returnBill.customerName})`,
        customerPhone: sql<string | null>`COALESCE(${saleBill.customerPhone}, ${returnBill.customerPhone})`,
        paymentMode: sql<string | null>`COALESCE(${saleBill.paymentMode}, ${returnBill.paymentMode})`,
        lineCount: saleBill.lineCount,
        minPrice: saleBill.minPrice,
        maxPrice: saleBill.maxPrice,
        linesTotal: saleBill.linesTotal,
        refundAmount: returnRow.refundAmount,
        returnReason: returnRow.reason,
      })
      .from(stockLogsTable)
      /* user_id is free text (staff uuid, "apikey:…", or NULL): cast the
         staff id to text rather than the other way round, which would raise. */
      .leftJoin(staffProfilesTable, sql`${staffProfilesTable.id}::text = ${stockLogsTable.userId}`)
      .leftJoinLateral(saleBill, sql`true`)
      .leftJoinLateral(returnRow, sql`true`)
      .leftJoinLateral(returnBill, sql`true`)
      .where(and(
        eq(stockLogsTable.productId, product.id),
        ownOrLegacyLog(req.tenantId),
      ))
      .orderBy(desc(stockLogsTable.createdAt), desc(stockLogsTable.id));

    return { product, rows };
  }, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });

  if (!snapshot) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  /* Set by requireRead: owners see cost and customer phones, staff do not. */
  const view: TimelineView = res.locals.resourceReadView === "owner" ? "owner" : "manager";

  const { product, rows } = snapshot;
  const ledger = rows.reduce(
    (acc, row) => {
      if (row.type === "IN") { acc.inQuantity += row.quantity; acc.inCount += 1; }
      else if (row.type === "OUT") acc.outQuantity += row.quantity;
      else if (row.type === "RETURN") acc.returnedQuantity += row.quantity;
      return acc;
    },
    { inQuantity: 0, inCount: 0, outQuantity: 0, returnedQuantity: 0 },
  );

  const timeline: ProductTimeline = {
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      stock: product.stock,
      supplierName: product.supplierName ?? null,
      deleted: product.deletedAt != null,
      createdAt: product.createdAt.toISOString(),
    },
    totals: deriveStockTotals(product.id, product.stock, ledger),
    events: rows.map((row) => shapeTimelineEvent(row as TimelineRow, view)),
  };
  res.json(timeline);
});

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
      purchasePrice: stockLogsTable.purchasePrice,
      supplierId: stockLogsTable.supplierId,
      supplierName: stockLogsTable.supplierName,
      invoiceNumber: stockLogsTable.invoiceNumber,
      note: stockLogsTable.note,
      userId: stockLogsTable.userId,
      createdAt: stockLogsTable.createdAt,
    })
    .from(stockLogsTable)
    .innerJoin(productsTable, eq(stockLogsTable.productId, productsTable.id))
    .where(and(...conditions))
    .orderBy(desc(stockLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows.map((row) => ({
    ...row,
    purchasePrice: row.purchasePrice != null ? Number(row.purchasePrice) : null,
  })));
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

/**
 * All-time stock totals for EVERY product of the shop, one row each.
 *
 * Feeds the supplier-wise Stock Check sheet, which needs "how much of this
 * ever came in, how much went out, what's left" for the whole catalogue at
 * once — one grouped query rather than a stock-history call per product.
 * Products without a single movement are included too: their stock was set
 * when they were created, and that is precisely what `unloggedInQuantity`
 * reports (see lib/stock-totals).
 *
 * Products and their movements are read in the same statement, so the
 * current level and the ledger come from one snapshot and reconcile exactly.
 */
router.get("/stock-logs/product-totals", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      productId: productsTable.id,
      currentStock: productsTable.stock,
      inQuantity: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}) FILTER (WHERE ${stockLogsTable.type} = 'IN'), 0)::int`,
      inCount: sql<number>`COUNT(${stockLogsTable.id}) FILTER (WHERE ${stockLogsTable.type} = 'IN')::int`,
      outQuantity: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}) FILTER (WHERE ${stockLogsTable.type} = 'OUT'), 0)::int`,
      returnedQuantity: sql<number>`COALESCE(SUM(${stockLogsTable.quantity}) FILTER (WHERE ${stockLogsTable.type} = 'RETURN'), 0)::int`,
    })
    .from(productsTable)
    .leftJoin(stockLogsTable, and(
      eq(stockLogsTable.productId, productsTable.id),
      ownOrLegacyLog(req.tenantId),
    ))
    .where(and(tenantWhere(productsTable.tenantId, req.tenantId), liveProduct()))
    .groupBy(productsTable.id);

  res.json({
    products: rows.map((row) => deriveStockTotals(row.productId, row.currentStock, row)),
  });
});

export default router;
