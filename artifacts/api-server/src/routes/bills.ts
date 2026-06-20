import { Router, type IRouter } from "express";
import { eq, desc, and, sql, inArray, gte } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable, returnsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { sendSaleAlert, sendLowStockAlert, type LowStockAlertItem } from "../lib/telegram";

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
    if (typeof b.discount !== "number" || (b.discount as number) < 0) return false;
  }
  if (b.discountType !== undefined) {
    if (b.discountType !== "percent" && b.discountType !== "amount") return false;
  }
  return b.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const it = item as Record<string, unknown>;

    // Common fields for both shapes
    if (typeof it.quantity !== "number" || (it.quantity as number) <= 0) return false;
    if (typeof it.price    !== "number" || (it.price    as number) <  0) return false;

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
      if (typeof it.mrp !== "number" || (it.mrp as number) <= 0) return false;
    }
    if (it.preDiscountPrice !== undefined && it.preDiscountPrice !== null) {
      if (typeof it.preDiscountPrice !== "number" || (it.preDiscountPrice as number) < 0) return false;
    }
    if (it.discountType !== undefined && it.discountType !== null) {
      if (it.discountType !== "percent" && it.discountType !== "amount") return false;
    }
    if (it.discountValue !== undefined && it.discountValue !== null) {
      if (typeof it.discountValue !== "number" || (it.discountValue as number) < 0) return false;
    }
    return true;
  });
}

router.post("/bills/checkout", async (req, res): Promise<void> => {
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
        /** Stock fields populated only for catalogue lines (used by low-stock
         *  Telegram alert). Manual lines set these to safe placeholders so the
         *  alert filter naturally excludes them. */
        newStock:         number;
        threshold:        number;
      }[] = [];

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
            price:       item.price,
            subtotal:    item.price * item.quantity,
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

        processedItems.push({
          productId:        item.productId,
          productName:      product.name,
          productSku:       product.sku,
          customName:       null,
          quantity:         item.quantity,
          price:            item.price,
          mrp:              item.mrp,
          preDiscountPrice: item.preDiscountPrice,
          discountType:     item.discountType,
          discountValue:    item.discountValue,
          subtotal:         item.price * item.quantity,
          newStock:         decremented.stock,
          threshold:        product.lowStockThreshold,
        });
      }

      const subtotal   = processedItems.reduce((s, i) => s + i.subtotal, 0);
      const itemsCount = processedItems.reduce((s, i) => s + i.quantity, 0);

      let discountAmount = 0;
      if (discount && discount > 0 && discountType) {
        if (discountType === "percent") {
          discountAmount = Math.min(subtotal * discount / 100, subtotal);
        } else {
          discountAmount = Math.min(discount, subtotal);
        }
      }
      const totalAmount = subtotal - discountAmount;

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
          }))
        )
        .returning();

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

    // Fire-and-forget Telegram sale alert (never blocks the response)
    sendSaleAlert(result.bill, result.items);

    // Fire low-stock Telegram alerts for any product that hit or crossed its threshold
    const lowStockItems: LowStockAlertItem[] = result.items
      .filter((i) => i.newStock <= i.threshold)
      .map((i) => ({ productName: i.productName, stock: i.newStock, threshold: i.threshold }));
    sendLowStockAlert(lowStockItems);

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
      const [bill] = await tx
        .select()
        .from(billsTable)
        .where(and(
          eq(billsTable.id, id),
          tenantWhereWrite(billsTable.tenantId, req.tenantId),
        ));
      if (!bill) throw new Error("Bill not found");

      const total       = Number(bill.totalAmount);
      const prevPaid    = Number(bill.amountPaid);
      // Pull refund totals inside the transaction so we don't race a return.
      const [refundRow] = await tx
        .select({ refunded: sql<string>`coalesce(sum(${returnsTable.refundAmount}), 0)` })
        .from(returnsTable)
        .where(eq(returnsTable.billId, id));
      const refunded    = Number(refundRow?.refunded ?? 0);
      const cap         = Math.max(0, total - refunded);
      const newPaid     = Math.min(cap, prevPaid + amount);
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
        .where(eq(billsTable.id, id))
        .returning();
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
