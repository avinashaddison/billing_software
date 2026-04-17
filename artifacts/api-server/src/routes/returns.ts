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

/** POST /api/returns  — create return + restock */
router.post("/returns", async (req, res): Promise<void> => {
  const { billId, productId, quantity, reason, notes } = req.body;

  if (!billId || !productId || !quantity || quantity < 1) {
    res.status(400).json({ error: "billId, productId and quantity are required" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  const refundAmount = Number(product.price) * quantity;

  const result = await db.transaction(async (tx) => {
    const [ret] = await tx
      .insert(returnsTable)
      .values({
        billId,
        productId,
        quantity,
        refundAmount: String(refundAmount),
        reason:       reason || "customer_return",
        notes:        notes || null,
      })
      .returning();

    // Restock the product
    const [updated] = await tx
      .update(productsTable)
      .set({ stock: product.stock + quantity })
      .where(eq(productsTable.id, productId))
      .returning();

    return { return: ret, newStock: updated.stock };
  });

  broadcast("stock_updated", {
    productId,
    productName: product.name,
    productSku:  product.sku,
    type:        "IN",
    quantity,
    newStock:    result.newStock,
  });

  res.status(201).json({ ...result.return, refundAmount: Number(result.return.refundAmount) });
});

export default router;
