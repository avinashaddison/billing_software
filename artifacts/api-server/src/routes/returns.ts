import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, returnsTable, productsTable, billsTable, saleItemsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { logger } from "../lib/logger";
import { tenantWhere } from "../lib/tenant";

const router: IRouter = Router();

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

  /* Validate bill exists AND belongs to caller's tenant */
  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(
      eq(billsTable.id, billId),
      tenantWhere(billsTable.tenantId, req.tenantId),
    ));
  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  /* Process each line item in a single transaction */
  const result = await db.transaction(async (tx) => {
    let totalRefund = 0;
    const returnRows: Array<typeof returnsTable.$inferSelect> = [];

    for (const line of lineItems) {
      if (!line.productId || !line.quantity || line.quantity < 1) continue;

      const [product] = await tx
        .select()
        .from(productsTable)
        .where(and(
          eq(productsTable.id, line.productId),
          tenantWhere(productsTable.tenantId, req.tenantId),
        ));
      if (!product) continue;

      /* Refund at the HISTORICAL price the customer actually paid (from sale_items),
         not the current product.price. Falls back to product.price only if the
         sale_items row is missing (e.g. product was deleted-cascade-nulled). */
      const [saleItem] = await tx
        .select({ price: saleItemsTable.price })
        .from(saleItemsTable)
        .where(and(
          eq(saleItemsTable.saleId, billId),
          eq(saleItemsTable.productId, line.productId),
        ))
        .limit(1);

      const unitPrice = saleItem
        ? Number(saleItem.price)
        : Number(product.price);

      if (!saleItem) {
        logger.warn(
          { billId, productId: line.productId },
          "Return: no sale_items row found for this bill+product, falling back to current product.price for refund",
        );
      }

      const refundAmount = unitPrice * line.quantity;
      totalRefund += refundAmount;

      const [ret] = await tx
        .insert(returnsTable)
        .values({
          tenantId:     bill.tenantId, // mirror the bill's tenant (NULL stays NULL for legacy)
          billId,
          productId:    line.productId,
          quantity:     line.quantity,
          refundAmount: String(refundAmount),
          reason:       reason || "customer_return",
          notes:        notes || null,
        })
        .returning();

      await tx
        .update(productsTable)
        .set({ stock: product.stock + line.quantity })
        .where(eq(productsTable.id, line.productId));

      broadcast("stock_updated", {
        productId:   line.productId,
        productName: product.name,
        productSku:  product.sku,
        type:        "IN",
        quantity:    line.quantity,
        newStock:    product.stock + line.quantity,
      }, product.tenantId);

      returnRows.push(ret);
    }

    return { returns: returnRows, totalRefund };
  });

  res.status(201).json({
    returns:     result.returns.map((r) => ({ ...r, refundAmount: Number(r.refundAmount) })),
    totalRefund: result.totalRefund,
    count:       result.returns.length,
  });
});

export default router;
