import { Router, type IRouter } from "express";
import { lte, sql, eq, gte, and } from "drizzle-orm";
import { db, productsTable, stockLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [summary] = await db
    .select({
      totalProducts: sql<number>`count(*)::int`,
      totalStock: sql<number>`sum(${productsTable.stock})::int`,
      totalStockValue: sql<number>`sum(${productsTable.stock}::numeric * ${productsTable.price})`,
      lowStockCount: sql<number>`count(case when ${productsTable.stock} <= ${productsTable.lowStockThreshold} then 1 end)::int`,
    })
    .from(productsTable);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayActivity] = await db
    .select({
      todayInCount: sql<number>`count(case when ${stockLogsTable.type} = 'IN' then 1 end)::int`,
      todayOutCount: sql<number>`count(case when ${stockLogsTable.type} = 'OUT' then 1 end)::int`,
    })
    .from(stockLogsTable)
    .where(gte(stockLogsTable.createdAt, todayStart));

  res.json({
    totalProducts: summary?.totalProducts ?? 0,
    totalStock: summary?.totalStock ?? 0,
    totalStockValue: Number(summary?.totalStockValue ?? 0),
    lowStockCount: summary?.lowStockCount ?? 0,
    todayInCount: todayActivity?.todayInCount ?? 0,
    todayOutCount: todayActivity?.todayOutCount ?? 0,
  });
});

router.get("/dashboard/low-stock", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .where(lte(productsTable.stock, productsTable.lowStockThreshold))
    .orderBy(productsTable.stock);

  res.json(products.map((p) => ({ ...p, price: Number(p.price) })));
});

router.get("/dashboard/today-activity", async (_req, res): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [activity] = await db
    .select({
      inCount: sql<number>`count(case when ${stockLogsTable.type} = 'IN' then 1 end)::int`,
      outCount: sql<number>`count(case when ${stockLogsTable.type} = 'OUT' then 1 end)::int`,
      inQuantity: sql<number>`coalesce(sum(case when ${stockLogsTable.type} = 'IN' then ${stockLogsTable.quantity} else 0 end), 0)::int`,
      outQuantity: sql<number>`coalesce(sum(case when ${stockLogsTable.type} = 'OUT' then ${stockLogsTable.quantity} else 0 end), 0)::int`,
    })
    .from(stockLogsTable)
    .where(gte(stockLogsTable.createdAt, todayStart));

  res.json({
    inCount: activity?.inCount ?? 0,
    outCount: activity?.outCount ?? 0,
    inQuantity: activity?.inQuantity ?? 0,
    outQuantity: activity?.outQuantity ?? 0,
  });
});

router.get("/dashboard/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({
      category: productsTable.category,
      productCount: sql<number>`count(*)::int`,
      totalStock: sql<number>`sum(${productsTable.stock})::int`,
      stockValue: sql<number>`sum(${productsTable.stock}::numeric * ${productsTable.price})`,
    })
    .from(productsTable)
    .groupBy(productsTable.category)
    .orderBy(productsTable.category);

  res.json(
    categories.map((c) => ({
      ...c,
      stockValue: Number(c.stockValue ?? 0),
    }))
  );
});

export default router;
