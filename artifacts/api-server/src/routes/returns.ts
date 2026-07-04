import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, returnsTable, productsTable, billsTable, saleItemsTable, stockLogsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { logger } from "../lib/logger";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { computeBillStatus } from "./bills";

const router: IRouter = Router();

/** Thrown inside the returns transaction to roll the whole return back and
 *  surface a 400 (instead of a generic 500) to the caller. */
class ReturnValidationError extends Error {}

/** GET /api/returns?billId=... */
router.get("/returns", async (req, res): Promise<void> => {
  const { billId } = req.query;

  const conditions = [tenantWhere(returnsTable.tenantId, req.tenantId)];
  if (billId && typeof billId === "string") {
    conditions.push(eq(returnsTable.billId, billId));
  }

  const rows = await db
    .select({
      id:           returnsTable.id,
      billId:       returnsTable.billId,
      productId:    returnsTable.productId,
      productName:  productsTable.name,
      productSku:   productsTable.sku,
      quantity:     returnsTable.quantity,
      refundAmount: returnsTable.refundAmount,
      reason:       returnsTable.reason,
      notes:        returnsTable.notes,
      createdAt:    returnsTable.createdAt,
    })
    .from(returnsTable)
    .innerJoin(productsTable, eq(returnsTable.productId, productsTable.id))
    .where(and(...conditions))
    .orderBy(desc(returnsTable.createdAt));

  res.json(rows.map((r) => ({ ...r, refundAmount: Number(r.refundAmount) })));
});

/**
 * POST /api/returns
 * Supports two formats:
 *   Single: { billId, productId, quantity, reason?, notes? }
 *   Batch:  { billId, items: [{productId, quantity}], reason?, notes? }
 *
 * Restocks each returned product and calculates total refund.
 */
router.post("/returns", async (req, res): Promise<void> => {
  const { billId, productId, quantity, reason, notes, items } = req.body;

  /* Normalise to a single array of {productId, quantity} */
  let lineItems: Array<{ productId: string; quantity: number }> = [];

  if (Array.isArray(items) && items.length > 0) {
    lineItems = items.map((i: { productId: string; quantity: number }) => ({
      productId: String(i.productId),
      quantity:  Number(i.quantity),
    }));
  } else if (productId && quantity) {
    lineItems = [{ productId: String(productId), quantity: Number(quantity) }];
  } else {
    res.status(400).json({ error: "Provide either items[] or (productId + quantity)" });
    return;
  }

  if (!billId) {
    res.status(400).json({ error: "billId is required" });
    return;
  }

  /* Aggregate duplicate productIds up-front so two lines for the same product
     are validated against the eligible quantity TOGETHER, not independently
     (otherwise 2 lines of qty 3 could each pass a "≤ 5 sold" check and over-
     return 6). */
  const requestedByProduct = new Map<string, number>();
  for (const line of lineItems) {
    if (!line.productId || !Number.isFinite(line.quantity) || line.quantity < 1) continue;
    requestedByProduct.set(
      line.productId,
      (requestedByProduct.get(line.productId) ?? 0) + line.quantity,
    );
  }
  if (requestedByProduct.size === 0) {
    res.status(400).json({ error: "No valid return line items" });
    return;
  }

  /* Validate bill exists AND belongs to caller's tenant. tenantWhereWrite
     means a real tenant can never return against another tenant's (or a
     legacy null-tenant) bill. */
  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(
      eq(billsTable.id, billId),
      tenantWhereWrite(billsTable.tenantId, req.tenantId),
    ));
  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  try {
    /* All line items processed in ONE transaction. Any validation failure
       throws ReturnValidationError → the whole transaction rolls back, so a
       return is all-or-nothing (never a partial restock + partial refund). */
    const result = await db.transaction(async (tx) => {
      let totalRefund = 0;
      const returnRows: Array<typeof returnsTable.$inferSelect> = [];
      const stockEvents: Array<{
        productId: string; productName: string; productSku: string;
        quantity: number; newStock: number; tenantId: string | null;
      }> = [];

      /* Serialize concurrent returns against the SAME bill by taking a row
         lock up front. Without this, two simultaneous returns could each read
         the same prior-returned total, both pass the eligibility check, and
         over-return / double-refund the same units. FOR UPDATE makes the
         second transaction wait until the first commits, so it then sees the
         updated prior-returned count. */
      await tx
        .select({ id: billsTable.id })
        .from(billsTable)
        .where(eq(billsTable.id, billId))
        .for("update");

      for (const [pid, qty] of requestedByProduct) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(and(
            eq(productsTable.id, pid),
            tenantWhereWrite(productsTable.tenantId, req.tenantId),
          ));
        if (!product) {
          throw new ReturnValidationError(
            "One or more products on this return don't belong to this shop.",
          );
        }

        /* How many of this product were sold on this bill, and the TOTAL
           line amount paid for them (sum of sale_items.subtotal — this already
           reflects per-line discounts). Summing across every matching line
           also means a product billed on two lines at different prices is
           handled correctly, instead of picking one arbitrary price. */
        const [soldRow] = await tx
          .select({
            sold:  sql<string>`coalesce(sum(${saleItemsTable.quantity}), 0)`,
            gross: sql<string>`coalesce(sum(${saleItemsTable.subtotal}), 0)`,
          })
          .from(saleItemsTable)
          .where(and(
            eq(saleItemsTable.saleId, billId),
            eq(saleItemsTable.productId, pid),
          ));
        const sold  = Number(soldRow?.sold ?? 0);
        const gross = Number(soldRow?.gross ?? 0);

        /* … and how many were already returned on PRIOR return transactions. */
        const [priorRow] = await tx
          .select({ returned: sql<string>`coalesce(sum(${returnsTable.quantity}), 0)` })
          .from(returnsTable)
          .where(and(
            eq(returnsTable.billId, billId),
            eq(returnsTable.productId, pid),
          ));
        const priorReturned = Number(priorRow?.returned ?? 0);
        const eligible = sold - priorReturned;

        if (sold === 0) {
          throw new ReturnValidationError(`"${product.name}" was not sold on this bill.`);
        }
        if (qty > eligible) {
          throw new ReturnValidationError(
            `Cannot return ${qty} × "${product.name}" — only ${Math.max(0, eligible)} eligible ` +
            `(sold ${sold}, already returned ${priorReturned}).`,
          );
        }

        /* Refund the NET amount the customer actually paid for these units.
           `gross` is the pre-bill-discount line total; scale it by the bill's
           net ratio so any ORDER-LEVEL discount (bills.discountAmount) is
           passed through to the refund. Without this, returning units from a
           discounted bill would refund MORE than the customer paid.

             billSubtotal = totalAmount + discountAmount   (checkout invariant)
             netRatio     = totalAmount / billSubtotal      (≤ 1)
             netPerUnit   = gross / sold * netRatio
             refund       = netPerUnit * qty                (rounded to paise)

           discountAmount was backfilled for all historical bills by migration
           0014, so old bills refund correctly too. No discount → ratio 1. */
        const billTotal    = Number(bill.totalAmount);
        const billDiscount = Number(bill.discountAmount ?? 0);
        const billSubtotal = billTotal + billDiscount;
        const netRatio     = billSubtotal > 0 ? billTotal / billSubtotal : 1;
        const netPerUnit   = sold > 0 ? (gross / sold) * netRatio : Number(product.price);
        const refundAmount = Math.round(netPerUnit * qty * 100) / 100;
        totalRefund += refundAmount;

        const [ret] = await tx
          .insert(returnsTable)
          .values({
            tenantId:     bill.tenantId, // mirror the bill's tenant (NULL stays NULL for legacy)
            billId,
            productId:    pid,
            quantity:     qty,
            refundAmount: String(refundAmount),
            reason:       reason || "customer_return",
            notes:        notes || null,
          })
          .returning();

        /* Atomic restock so concurrent returns can't lose an increment. */
        const [restocked] = await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${qty}` })
          .where(eq(productsTable.id, pid))
          .returning({ stock: productsTable.stock });

        /* Keep the stock-movement history complete: without this row the
           Logs page and stock reports can't explain the restock. RETURN (not
           IN) so supplier purchase reports don't count it as a purchase. */
        await tx.insert(stockLogsTable).values({
          tenantId:  product.tenantId,
          productId: pid,
          type:      "RETURN",
          quantity:  qty,
          userId:    req.staffId ?? null,
        });

        stockEvents.push({
          productId:   pid,
          productName: product.name,
          productSku:  product.sku,
          quantity:    qty,
          newStock:    restocked?.stock ?? product.stock + qty,
          tenantId:    product.tenantId,
        });

        returnRows.push(ret);
      }

      /* Recompute the bill's paymentStatus now that refunds may have shrunk
       * the outstanding amount. Without this, a credit bill stays "unpaid"
       * even after the customer returns enough goods to settle it. */
      const [refundTotalRow] = await tx
        .select({ refunded: sql<string>`coalesce(sum(${returnsTable.refundAmount}), 0)` })
        .from(returnsTable)
        .where(eq(returnsTable.billId, billId));
      const refunded   = Number(refundTotalRow?.refunded ?? 0);
      const totalAmt   = Number(bill.totalAmount);
      const paidAmt    = Number(bill.amountPaid);
      const newStatus  = computeBillStatus(totalAmt, paidAmt, refunded);
      if (newStatus !== bill.paymentStatus) {
        await tx
          .update(billsTable)
          .set({ paymentStatus: newStatus })
          .where(eq(billsTable.id, billId));
      }

      return { returns: returnRows, totalRefund, newStatus, refunded, stockEvents };
    });

    /* Emit stock + receivable events only AFTER the transaction commits, so a
       rolled-back return never broadcasts a phantom stock movement. */
    for (const ev of result.stockEvents) {
      broadcast("stock_updated", {
        productId:   ev.productId,
        productName: ev.productName,
        productSku:  ev.productSku,
        type:        "IN",
        quantity:    ev.quantity,
        newStock:    ev.newStock,
      }, ev.tenantId);
    }

    /* Tell live dashboards the receivable just shifted so the tile / debtor
     * list re-fetch instead of waiting for a manual refresh. */
    broadcast("bill_payment", {
      billId,
      amountPaid: Number(bill.amountPaid),
      status:     result.newStatus,
    }, bill.tenantId);

    res.status(201).json({
      returns:     result.returns.map((r) => ({ ...r, refundAmount: Number(r.refundAmount) })),
      totalRefund: result.totalRefund,
      count:       result.returns.length,
    });
  } catch (err) {
    if (err instanceof ReturnValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error({ err, billId }, "Return processing failed");
    res.status(500).json({ error: "Failed to process return" });
  }
});

export default router;
