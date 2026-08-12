import { Router, type IRouter } from "express";
import { eq, desc, and, sql, inArray, gte } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable, returnsTable, billPaymentsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { requireWrite } from "../middlewares/auth";
import { sendSaleAlert, sendLowStockAlert, type LowStockAlertItem } from "../lib/telegram";
import { logger } from "../lib/logger";
import { round2, checkLinePrice, isAbsurdPrice, exceedsDiscountCeiling, checkBillDiscount, maxDiscountPct, priceGuardMode, isSaneNumber } from "../lib/price-integrity";

const router: IRouter = Router();

/* ───────────────────────────────────────────────────────────────────
 * Receivable math, in one place so server and clients agree:
 *   outstanding = max(0, totalAmount − amountPaid − totalReturns)
 *   status      = paid    if outstanding === 0
 *                 partial if amountPaid > 0 OR totalReturns > 0
 *                 unpaid  otherwise
 * Returns refund cash on a paid bill so it never opens up a receivable;
 * the math just clamps to zero. On a credit bill it shrinks what's due.
 * ─────────────────────────────────────────────────────────────────── */
export function computeBillStatus(
  totalAmount: number,
  amountPaid:  number,
  refunded:    number,
): "paid" | "partial" | "unpaid" {
  const outstanding = Math.max(0, totalAmount - amountPaid - refunded);
  if (outstanding === 0) return "paid";
  if (amountPaid > 0 || refunded > 0) return "partial";
  return "unpaid";
}

/** Fetch refundedAmount totals for a set of bill ids in one query. */
export async function refundsByBill(billIds: string[]): Promise<Map<string, number>> {
  if (billIds.length === 0) return new Map();
  const rows = await db
    .select({
      billId:   returnsTable.billId,
      refunded: sql<string>`coalesce(sum(${returnsTable.refundAmount}), 0)`.as("refunded"),
    })
    .from(returnsTable)
    .where(inArray(returnsTable.billId, billIds))
    .groupBy(returnsTable.billId);
  return new Map(rows.map((r) => [r.billId, Number(r.refunded)]));
}

type PaymentMode = "cash" | "upi" | "credit";

/** Catalogue (real product) line item shape. */
type CatalogLineItem = {
  productId:        string;
  quantity:         number;
  price:            number;
  mrp?:             number;
  preDiscountPrice?: number;
  discountType?:    "percent" | "amount";
  discountValue?:   number;
};

/** Manual / non-inventory line item shape (e.g. customer's own gift,
 *  one-off service charge). No stock movement, no SKU, no MRP. */
type ManualLineItem = {
  /** Display name printed on the receipt. */
  name:     string;
  quantity: number;
  price:    number;
};

type CheckoutLineItem = CatalogLineItem | ManualLineItem;

function isManualLine(it: CheckoutLineItem): it is ManualLineItem {
  return typeof (it as ManualLineItem).name === "string"
      && typeof (it as CatalogLineItem).productId !== "string";
}

function isValidCheckoutBody(body: unknown): body is {
  items:        CheckoutLineItem[];
  paymentMode:  PaymentMode;
  customerName?: string;
  customerPhone?: string;
  discount?:     number;
  discountType?: "percent" | "amount";
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  if (b.paymentMode !== "cash" && b.paymentMode !== "upi" && b.paymentMode !== "credit") return false;
  // Credit sales must identify the debtor — otherwise the shop can never
  // collect. Cash/UPI can still be anonymous walk-in customers.
  if (b.paymentMode === "credit" && (!b.customerPhone || typeof b.customerPhone !== "string" || !/^\d{10}$/.test(b.customerPhone))) {
    return false;
  }
  if (b.customerName !== undefined && b.customerName !== "") {
    if (typeof b.customerName !== "string") return false;
    /* Length cap matches the receipt column width — keeps the printed
       layout from wrapping awkwardly on the 80mm thermal roll. */
    if (b.customerName.trim().length > 80) return false;
  }
  if (b.customerPhone !== undefined && b.customerPhone !== "") {
    if (typeof b.customerPhone !== "string") return false;
    if (!/^\d{10}$/.test(b.customerPhone)) return false;
  }
  if (b.discount !== undefined) {
    if (!isSaneNumber(b.discount) || b.discount < 0) return false;
  }
  if (b.discountType !== undefined) {
    if (b.discountType !== "percent" && b.discountType !== "amount") return false;
  }
  return b.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const it = item as Record<string, unknown>;

    /* Common fields for both shapes.
       isSaneNumber, not `typeof === "number"`: NaN and Infinity are both
       numbers to typeof, and would sail through here into a numeric(15,2)
       column — aborting the transaction mid-sale or storing a corrupt line.
       Quantity must also be a whole number: `stock` is an integer column, so a
       fractional quantity fails inside the transaction rather than here, which
       the cashier sees as a checkout that mysteriously died. */
    if (!isSaneNumber(it.quantity) || it.quantity <= 0 || !Number.isInteger(it.quantity)) return false;
    if (!isSaneNumber(it.price)    || it.price    <  0) return false;

    // Manual line: requires `name`, forbids productId/MRP/discount fields
    if (typeof it.name === "string" && typeof it.productId !== "string") {
      const name = (it.name as string).trim();
      if (name.length === 0 || name.length > 80) return false;
      // Manual lines don't carry MRP, preDiscount, or per-line discounts —
      // the cashier types the final price directly.
      return true;
    }

    // Catalogue line
    if (typeof it.productId !== "string") return false;
    if (it.mrp !== undefined && it.mrp !== null) {
      if (!isSaneNumber(it.mrp) || it.mrp <= 0) return false;
    }
    if (it.preDiscountPrice !== undefined && it.preDiscountPrice !== null) {
      if (!isSaneNumber(it.preDiscountPrice) || it.preDiscountPrice < 0) return false;
    }
    if (it.discountType !== undefined && it.discountType !== null) {
      if (it.discountType !== "percent" && it.discountType !== "amount") return false;
    }
    if (it.discountValue !== undefined && it.discountValue !== null) {
      if (!isSaneNumber(it.discountValue) || it.discountValue < 0) return false;
    }
    return true;
  });
}

router.post("/bills/checkout", requireWrite("scan"), async (req, res): Promise<void> => {
  if (!isValidCheckoutBody(req.body)) {
    res.status(400).json({
      error: "Invalid checkout payload. Requires items[], paymentMode (cash|upi), and optional 10-digit customerPhone.",
    });
    return;
  }

  const { items, paymentMode, customerName, customerPhone, discount, discountType } = req.body;
  const tenantId = req.tenantId;

  try {
    const result = await db.transaction(async (tx) => {
      const processedItems: {
        /** NULL for manual / non-inventory lines. */
        productId:        string | null;
        /** Display name (product.name for catalogue, manual.name for manual). */
        productName:      string;
        /** Catalogue SKU, or "—" for manual lines (no inventory). */
        productSku:       string;
        /** Set only on manual lines so we can write `custom_name` on insert. */
        customName:       string | null;
        quantity:         number;
        price:            number;
        mrp?:             number;
        preDiscountPrice?: number;
        discountType?:    "percent" | "amount";
        discountValue?:   number;
        subtotal:         number;
        /** Cost snapshot at sale time — powers stable historical profit. */
        purchasePrice?:   number;
        /** Stock fields populated only for catalogue lines (used by low-stock
         *  Telegram alert). Manual lines set these to safe placeholders so the
         *  alert filter naturally excludes them. */
        newStock:         number;
        threshold:        number;
      }[] = [];

      /* Catalogue value of the lines that can actually be price-checked, so the
         bill-level discount can be held to the same ceiling as the lines. */
      let catalogueBasisTotal = 0;
      let guardedSubtotal     = 0;

      for (const item of items) {
        if (isManualLine(item)) {
          // ── Manual / non-inventory line ──
          // No product lookup, no stock decrement, no stock log. We just
          // record the cashier-typed name + price as a billable line.
          const name = item.name.trim();
          processedItems.push({
            productId:   null,
            productName: name,
            productSku:  "—",
            customName:  name,
            quantity:    item.quantity,
            price:       round2(item.price),
            subtotal:    round2(round2(item.price) * item.quantity),
            // Sentinels well above any realistic threshold so the low-stock
            // filter (newStock <= threshold) never picks up manual lines.
            newStock:    Number.MAX_SAFE_INTEGER,
            threshold:   0,
          });
          continue;
        }

        // ── Catalogue line ──
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(and(
            eq(productsTable.id, item.productId),
            tenantWhereWrite(productsTable.tenantId, tenantId),
          ));

        if (!product) throw new Error(`Product not found: ${item.productId}`);

        /* Atomic GUARDED decrement — only succeeds if enough stock is still on
           hand at write time, so two concurrent checkouts can't oversell the
           same unit. A non-matching row (insufficient stock) returns nothing,
           and throwing here rolls the whole bill transaction back. */
        const [decremented] = await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${item.quantity}` })
          .where(and(
            eq(productsTable.id, item.productId),
            tenantWhereWrite(productsTable.tenantId, tenantId),
            gte(productsTable.stock, item.quantity),
          ))
          .returning({ stock: productsTable.stock });

        if (!decremented) {
          throw new Error(
            `Insufficient stock for "${product.name}" (available: ${product.stock}, requested: ${item.quantity})`
          );
        }

        await tx.insert(stockLogsTable).values({
          tenantId:  product.tenantId, // mirror the product's tenant (NULL stays NULL for legacy rows)
          productId: item.productId,
          type:      "OUT",
          quantity:  item.quantity,
          userId:    req.staffId ?? null,
        });

        /* ── Price integrity ──────────────────────────────────────────────
           The catalogue is the server's own source of truth, so the browser no
           longer gets to decide what the shop earned without being checked.

           A line that merely fails to match only WARNS — ordinary discounting
           and stale carts land there, and refusing those would stop a working
           shop from selling. A line discounted past the ceiling is REFUSED: no
           honest sale gives away nearly the whole value of an item, and the
           deepest real discount in 60 days of sales was 50.5% against a 70%
           limit. See lib/price-integrity.ts. */
        const priceCheck = checkLinePrice({
          product,
          submittedPrice: item.price,
          discountType:   item.discountType ?? null,
          discountValue:  item.discountValue ?? null,
        });

        if (isAbsurdPrice(priceCheck)) {
          throw new Error(
            `Refusing "${product.name}": ₹${priceCheck.submitted} is not a possible price ` +
            `for an item listed at ₹${priceCheck.cataloguePrice}.`
          );
        }

        const guardMode = priceGuardMode();

        if (guardMode !== "off" && exceedsDiscountCeiling(priceCheck)) {
          logger.error({
            event:          "price_ceiling_blocked",
            tenantId,
            staffId:        req.staffId ?? null,
            userId:         req.userId ?? null,
            productId:      product.id,
            productSku:     product.sku,
            productName:    product.name,
            cataloguePrice: priceCheck.cataloguePrice,
            bestBasis:      priceCheck.bestBasis,
            submittedPrice: priceCheck.submitted,
            discountPct:    Math.round(priceCheck.impliedDiscountPct * 10) / 10,
            maxDiscountPct: maxDiscountPct(),
            quantity:       item.quantity,
          }, "checkout line refused — discount exceeds the allowed ceiling");

          throw new Error(
            `Refusing "${product.name}": ₹${priceCheck.submitted} is ${Math.round(priceCheck.impliedDiscountPct)}% off ` +
            `the listed price of ₹${priceCheck.bestBasis}, beyond the ${maxDiscountPct()}% limit. ` +
            `If this discount is intentional, ask the owner to raise the limit.`
          );
        }

        if (!priceCheck.matches && guardMode !== "off") {
          logger.warn({
            event:          "price_mismatch",
            tenantId,
            staffId:        req.staffId ?? null,
            userId:         req.userId ?? null,
            productId:      product.id,
            productSku:     product.sku,
            productName:    product.name,
            cataloguePrice: priceCheck.cataloguePrice,
            expectedPrice:  priceCheck.expected,
            submittedPrice: priceCheck.submitted,
            deviationPct:   Math.round(priceCheck.deviation * 1000) / 10,
            quantity:       item.quantity,
          }, "checkout line price does not match catalogue price + declared discount");

          if (guardMode === "strict") {
            throw new Error(
              `Price mismatch on "${product.name}": expected ₹${priceCheck.expected}, got ₹${priceCheck.submitted}.`
            );
          }
        }

        if (priceCheck.bestBasis > 0) {
          catalogueBasisTotal += priceCheck.bestBasis * item.quantity;
          guardedSubtotal     += round2(item.price) * item.quantity;
        }

        const linePrice = round2(item.price);

        processedItems.push({
          productId:        item.productId,
          productName:      product.name,
          productSku:       product.sku,
          customName:       null,
          quantity:         item.quantity,
          price:            linePrice,
          /* Rounded on the way in, like every other money field. These are
             stored verbatim on the sale item and later read back for receipts
             and reports, so an unrounded 349.99000000000004 would persist and
             resurface as a receipt that doesn't add up. */
          mrp:              item.mrp              != null ? round2(item.mrp)              : undefined,
          preDiscountPrice: item.preDiscountPrice != null ? round2(item.preDiscountPrice) : undefined,
          discountType:     item.discountType,
          discountValue:    item.discountValue    != null ? round2(item.discountValue)    : undefined,
          subtotal:         round2(linePrice * item.quantity),
          purchasePrice:    product.purchasePrice != null ? Number(product.purchasePrice) : undefined,
          newStock:         decremented.stock,
          threshold:        product.lowStockThreshold,
        });
      }

      /* Every money figure is rounded to paise at the boundary. Postgres stores
         numeric(15,2), so an unrounded JS double (349.99 * 7 is 2449.9300000000003)
         gets silently truncated on write, and the saved bill stops agreeing with
         the sum of its own lines. */
      const subtotal   = round2(processedItems.reduce((s, i) => s + i.subtotal, 0));
      const itemsCount = processedItems.reduce((s, i) => s + i.quantity, 0);

      let discountAmount = 0;
      if (discount && discount > 0 && discountType) {
        if (discountType === "percent") {
          discountAmount = Math.min(round2(subtotal * discount / 100), subtotal);
        } else {
          discountAmount = Math.min(round2(discount), subtotal);
        }
      }
      /* ── Bill-level discount ceiling ────────────────────────────────────
         The per-line ceiling is not enough on its own. A client can send every
         line at its honest catalogue price and then discount the whole bill by
         100%, reaching a zero total by a different route and sailing past a
         guard that only ever looks at lines. Hold the final figure to the same
         limit, measured against what the catalogue says the priced lines are
         worth. Manual lines have no catalogue price, so they are excluded from
         both sides rather than being treated as free. */
      if (priceGuardMode() !== "off") {
        const billCheck = checkBillDiscount({
          catalogueBasisTotal, guardedSubtotal, subtotal, discountAmount,
        });
        if (billCheck.blocked) {
          logger.error({
            event:               "bill_discount_blocked",
            tenantId,
            staffId:             req.staffId ?? null,
            userId:              req.userId ?? null,
            catalogueBasisTotal: round2(billCheck.catalogueBasisTotal),
            guardedTotal:        round2(billCheck.guardedTotal),
            discountAmount,
            discountType:        discountType ?? null,
            maxDiscountPct:      maxDiscountPct(),
          }, "checkout refused — bill discount exceeds the allowed ceiling");

          throw new Error(
            `Refusing this bill: ₹${round2(billCheck.guardedTotal)} is ${Math.round(billCheck.offPct)}% off ` +
            `the listed value of ₹${round2(billCheck.catalogueBasisTotal)}, beyond the ${maxDiscountPct()}% limit. ` +
            `If this discount is intentional, ask the owner to raise the limit.`
          );
        }
      }

      /* ── Whole-rupee settlement ──────────────────────────────────────────
         Nobody in the shop handles paise, so the bill settles at the nearest
         rupee: 780.90 is collected as 781, 780.40 as 780. Only the FINAL figure
         moves — line prices and subtotals stay exact, so per-item reporting and
         profit are untouched. The receipt prints the difference as "Round Off"
         so the printed lines still add up to what was actually paid.

         Deliberately applied after the discount ceiling above, which must judge
         the real discount rather than a rounded one. */
      const exactTotal  = round2(subtotal - discountAmount);
      const totalAmount = Math.round(exactTotal);

      const isCredit = paymentMode === "credit";
      const amountPaid    = isCredit ? 0 : totalAmount;
      const paymentStatus = isCredit ? "unpaid" : "paid";

      const [bill] = await tx
        .insert(billsTable)
        .values({
          tenantId,
          totalAmount:   String(totalAmount),
          itemsCount,
          paymentMode,
          amountPaid:    String(amountPaid),
          paymentStatus,
          customerName:  customerName?.trim() || null,
          customerPhone: customerPhone || null,
          discount:      discount && discount > 0 ? String(discount) : null,
          discountType:  discount && discount > 0 && discountType ? discountType : null,
          discountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
        })
        .returning();

      const saleItemRows = await tx
        .insert(saleItemsTable)
        .values(
          processedItems.map((i) => ({
            tenantId:         tenantId,
            saleId:           bill.id,
            productId:        i.productId,                    // NULL for manual lines
            customName:       i.customName,                   // set only for manual lines
            quantity:         i.quantity,
            price:            String(i.price),
            mrp:              i.mrp != null ? String(i.mrp) : null,
            preDiscountPrice: i.preDiscountPrice != null ? String(i.preDiscountPrice) : null,
            discountType:     i.discountType ?? null,
            discountValue:    i.discountValue != null ? String(i.discountValue) : null,
            subtotal:         String(i.subtotal),
            purchasePrice:    i.purchasePrice != null ? String(i.purchasePrice) : null,
          }))
        )
        .returning();

      // Money-movement ledger: a non-credit bill is fully paid at checkout.
      // Record it as a 'sale' payment. The EOD "dues collected" figure ignores
      // 'sale' rows (already in cash/UPI sales) and counts only later
      // 'collection' payments, so this never double-counts.
      if (!isCredit && totalAmount > 0) {
        await tx.insert(billPaymentsTable).values({
          tenantId,
          billId:      bill.id,
          amount:      String(totalAmount),
          paymentMode,
          kind:        "sale",
        });
      }

      return {
        bill: { ...bill, totalAmount: Number(bill.totalAmount) },
        items: processedItems,
        saleItems: saleItemRows,
      };
    });

    // Broadcast to all SSE clients (realtime) — scoped to this tenant
    broadcast("bill_created", {
      billId:      result.bill.id,
      totalAmount: result.bill.totalAmount,
      itemsCount:  result.bill.itemsCount,
      paymentMode: result.bill.paymentMode,
      createdAt:   result.bill.createdAt,
    }, tenantId);

    // Fire-and-forget Telegram sale alert (never blocks the response).
    // Tenant-scoped: goes to the shop's own bot if configured, else the
    // global env channel.
    sendSaleAlert(tenantId, result.bill, result.items);

    // Fire low-stock Telegram alerts for any product that hit or crossed its threshold
    const lowStockItems: LowStockAlertItem[] = result.items
      .filter((i) => i.newStock <= i.threshold)
      .map((i) => ({ productName: i.productName, stock: i.newStock, threshold: i.threshold }));
    sendLowStockAlert(tenantId, lowStockItems);

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Checkout failed" });
  }
});

router.get("/bills", async (req, res): Promise<void> => {
  const bills = await db
    .select()
    .from(billsTable)
    .where(tenantWhere(billsTable.tenantId, req.tenantId))
    .orderBy(desc(billsTable.createdAt))
    .limit(50);

  const refunds = await refundsByBill(bills.map((b) => b.id));

  res.json(bills.map((b) => ({
    ...b,
    totalAmount:    Number(b.totalAmount),
    amountPaid:     Number(b.amountPaid),
    refundedAmount: refunds.get(b.id) ?? 0,
    discount:       b.discount != null ? Number(b.discount) : null,
    discountType:   b.discountType ?? null,
    discountAmount: b.discountAmount != null ? Number(b.discountAmount) : null,
  })));
});

router.get("/bills/:id", async (req, res): Promise<void> => {
  const { id } = req.params;

  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(
      eq(billsTable.id, id),
      tenantWhere(billsTable.tenantId, req.tenantId),
    ));

  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  const refundsMap    = await refundsByBill([bill.id]);
  const refundedAmount = refundsMap.get(bill.id) ?? 0;

  const items = await db
    .select({
      id:               saleItemsTable.id,
      productId:        saleItemsTable.productId,
      productName:      productsTable.name,
      productSku:       productsTable.sku,
      customName:       saleItemsTable.customName,
      quantity:         saleItemsTable.quantity,
      price:            saleItemsTable.price,
      mrp:              saleItemsTable.mrp,
      preDiscountPrice: saleItemsTable.preDiscountPrice,
      discountType:     saleItemsTable.discountType,
      discountValue:    saleItemsTable.discountValue,
      subtotal:         saleItemsTable.subtotal,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, id));

  res.json({
    bill: {
      ...bill,
      totalAmount:    Number(bill.totalAmount),
      amountPaid:     Number(bill.amountPaid),
      refundedAmount,
      discount:       bill.discount != null ? Number(bill.discount) : null,
      discountType:   bill.discountType ?? null,
      /* The resolved rupee discount. The receipt needs this as a real figure:
         now that bills settle at the nearest rupee it can no longer infer the
         discount from (subtotal − total), because that gap also holds the
         round-off. */
      discountAmount: bill.discountAmount != null ? Number(bill.discountAmount) : null,
    },
    items: items.map((i) => ({
      ...i,
      // Fallback chain: catalogue name → manual line custom name → "Deleted Product".
      // `customName` is non-null exactly when productId is null (DB CHECK), so this
      // ordering keeps manual lines readable on the printed receipt and history.
      productName:      i.productName ?? i.customName ?? "Deleted Product",
      productSku:       i.productSku  ?? "—",
      /** True when this line is a manual / non-inventory entry (no product). */
      isManual:         i.productId === null,
      price:            Number(i.price),
      mrp:              i.mrp != null ? Number(i.mrp) : null,
      preDiscountPrice: i.preDiscountPrice != null ? Number(i.preDiscountPrice) : null,
      discountType:     i.discountType ?? null,
      discountValue:    i.discountValue != null ? Number(i.discountValue) : null,
      subtotal:         Number(i.subtotal),
    })),
  });
});

/**
 * POST /api/bills/:id/payment
 * Record a payment against an outstanding bill. Body: { amount, paymentMode? }.
 * Updates amountPaid (clamped to totalAmount) and recomputes paymentStatus.
 */
router.post("/bills/:id/payment", async (req, res): Promise<void> => {
  const { id } = req.params;
  const body = req.body as { amount?: unknown; paymentMode?: unknown };

  const amount = typeof body.amount === "number" ? body.amount : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }
  const newPaymentMode =
    body.paymentMode === "cash" || body.paymentMode === "upi"
      ? (body.paymentMode as "cash" | "upi")
      : undefined;

  try {
    const updated = await db.transaction(async (tx) => {
      // Lock the bill row for the duration of the tx so two concurrent
      // payments can't both read the same prevPaid and double-insert ledger
      // rows / over-collect.
      const [bill] = await tx
        .select()
        .from(billsTable)
        .where(and(
          eq(billsTable.id, id),
          tenantWhereWrite(billsTable.tenantId, req.tenantId),
        ))
        .for("update");
      if (!bill) throw new Error("Bill not found");

      const total       = Number(bill.totalAmount);
      const prevPaid    = Number(bill.amountPaid);
      // Pull refund totals inside the transaction so we don't race a return.
      const [refundRow] = await tx
        .select({ refunded: sql<string>`coalesce(sum(${returnsTable.refundAmount}), 0)` })
        .from(returnsTable)
        /* Scoped by billId alone, on purpose. The bill above was already
           ownership-checked, and billId identifies its returns uniquely — but a
           legacy return row with a NULL tenant_id would be EXCLUDED by a tenant
           predicate, under-counting refunds, inflating the cap and letting the
           bill over-collect. Correct money beats a redundant guard. */
        .where(eq(returnsTable.billId, id));
      const refunded    = Number(refundRow?.refunded ?? 0);
      const cap         = round2(Math.max(0, total - refunded));
      const newPaid     = round2(Math.min(cap, prevPaid + amount));
      const status      = computeBillStatus(total, newPaid, refunded);

      const [row] = await tx
        .update(billsTable)
        .set({
          amountPaid:    String(newPaid),
          paymentStatus: status,
          // If the bill was credit and is now settled, reflect the actual
          // mode the customer used to pay it off (cash/upi).
          ...(status === "paid" && newPaymentMode ? { paymentMode: newPaymentMode } : {}),
        })
        /* Scoped on the UPDATE itself, not just on the locked SELECT above, so
           the tenant guarantee cannot be lost in a later refactor. */
        .where(and(
          eq(billsTable.id, id),
          tenantWhereWrite(billsTable.tenantId, req.tenantId),
        ))
        .returning();

      // Money-movement ledger: record the ACTUAL amount applied (the delta,
      // which can be smaller than requested when the refund cap clamps it) as a
      // 'collection'. This is what the EOD "dues collected" figure sums.
      const applied = round2(newPaid - prevPaid);
      if (applied > 0) {
        await tx.insert(billPaymentsTable).values({
          tenantId:    bill.tenantId,
          billId:      id,
          amount:      String(applied),
          paymentMode: newPaymentMode ?? "cash",
          kind:        "collection",
        });
      }

      return row;
    });

    broadcast("bill_payment", {
      billId:     updated.id,
      amountPaid: Number(updated.amountPaid),
      status:     updated.paymentStatus,
    }, req.tenantId);

    res.json({
      ...updated,
      totalAmount: Number(updated.totalAmount),
      amountPaid:  Number(updated.amountPaid),
      discount:    updated.discount != null ? Number(updated.discount) : null,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to record payment";
    res.status(msg === "Bill not found" ? 404 : 400).json({ error: msg });
  }
});

export default router;
