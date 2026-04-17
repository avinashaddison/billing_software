import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, stockLogsTable, productsTable } from "@workspace/db";
import { ListStockLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stock-logs", async (req, res): Promise<void> => {
  const parsed = ListStockLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, type, limit = 50, offset = 0 } = parsed.data;

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
    .where(
      productId && type
        ? eq(stockLogsTable.productId, productId) && eq(stockLogsTable.type, type)
        : productId
          ? eq(stockLogsTable.productId, productId)
          : type
            ? eq(stockLogsTable.type, type)
            : undefined
    )
    .orderBy(desc(stockLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

export default router;
