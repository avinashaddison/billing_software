import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, returnsTable, productsTable, billsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";

const router: IRouter = Router();

/** GET /api/returns?billId=... */
router.get("/returns", async (req, res): Promise<void> => {
  const { billId } = req.query;
  let query = db
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
    .$dynamic();

  if (billId && typeof billId === "string") {
    query = query.where(eq(returnsTable.billId, billId));
  }

  const rows = await query.orderBy(desc(returnsTable.createdAt));
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

  /* Validate bill exists */
  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  /* Process each line item in a single transaction */
  const result = await db.transaction(async (tx) => {
    let totalRefund = 0;
    const returnRows: Array<typeof returnsTable.$inferSelect> = [];

    for (const line of lineItems) {
      if (!line.productId || !line.quantity || line.quantity < 1) continue;

      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, line.productId));
      if (!product) continue;

      const refundAmount = Number(product.price) * line.quantity;
      totalRefund += refundAmount;

      const [ret] = await tx
        .insert(returnsTable)
        .values({
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
      });

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
