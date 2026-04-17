import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, salesTable, productsTable } from "@workspace/db";
import { ListSalesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sales", async (req, res): Promise<void> => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, limit = 50, offset = 0 } = parsed.data;

  const rows = await db
    .select({
      id: salesTable.id,
      productId: salesTable.productId,
      productName: productsTable.name,
      productSku: productsTable.sku,
      quantity: salesTable.quantity,
      totalPrice: salesTable.totalPrice,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .innerJoin(productsTable, eq(salesTable.productId, productsTable.id))
    .where(productId ? eq(salesTable.productId, productId) : undefined)
    .orderBy(desc(salesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(
    rows.map((r) => ({
      ...r,
      totalPrice: Number(r.totalPrice),
    }))
  );
});

export default router;
