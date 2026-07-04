import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, stockLogsTable, productsTable } from "@workspace/db";
import { ListStockLogsQueryParams } from "@workspace/api-zod";
import { tenantWhere } from "../lib/tenant";
import { istToday } from "../lib/ist";

const router: IRouter = Router();

router.get("/stock-logs", async (req, res): Promise<void> => {
  const parsed = ListStockLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, type, today, limit = 50, offset = 0 } = parsed.data;

  const conditions = [tenantWhere(stockLogsTable.tenantId, req.tenantId)];
  if (productId) conditions.push(eq(stockLogsTable.productId, productId));
  if (type) conditions.push(eq(stockLogsTable.type, type));
  if (today) {
    // IST business day, matching the dashboard counters and reports.
    conditions.push(sql`DATE(${stockLogsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${istToday()}`);
  }

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

export default router;
