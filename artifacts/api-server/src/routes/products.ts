import { Router, type IRouter } from "express";
import { eq, ilike, or, and, lte } from "drizzle-orm";
import { db, productsTable, stockLogsTable, salesTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductBySkuParams,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  UpdateStockParams,
  UpdateStockBody,
  GetProductQrParams,
} from "@workspace/api-zod";
import QRCode from "qrcode";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, category, lowStock } = parsed.data;

  let query = db.select().from(productsTable).$dynamic();

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.sku, `%${search}%`)
      )
    );
  }

  if (category) {
    conditions.push(eq(productsTable.category, category));
  }

  if (lowStock) {
    conditions.push(lte(productsTable.stock, productsTable.lowStockThreshold));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const products = await query.orderBy(productsTable.name);

  res.json(
    products.map((p) => ({
      ...p,
      price: Number(p.price),
      lowStockThreshold: p.lowStockThreshold,
    }))
  );
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, sku, category, price, stock, lowStockThreshold } = parsed.data;

  const [product] = await db
    .insert(productsTable)
    .values({
      name,
      sku,
      category,
      price: String(price),
      stock: stock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 5,
    })
    .returning();

  broadcast("product_created", { productId: product.id, name: product.name, sku: product.sku });

  res.status(201).json({ ...product, price: Number(product.price) });
});

router.get("/products/next-sku", async (req, res): Promise<void> => {
  const { categoryCode } = req.query;
  if (!categoryCode || typeof categoryCode !== "string") {
    res.status(400).json({ error: "categoryCode query param is required" });
    return;
  }

  const prefix = categoryCode.toUpperCase();
  const likePattern = `${prefix}-%`;

  const products = await db
    .select({ sku: productsTable.sku })
    .from(productsTable)
    .where(ilike(productsTable.sku, likePattern));

  let maxNum = 0;
  for (const p of products) {
    const numPart = p.sku.slice(prefix.length + 1); // strip "RC-"
    const num = parseInt(numPart, 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  const nextSku = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
  res.json({ sku: nextSku });
});

router.get("/products/sku/:sku", async (req, res): Promise<void> => {
  const params = GetProductBySkuParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.sku, params.data.sku));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ ...product, price: Number(product.price) });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ ...product, price: Number(product.price) });
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.sku != null) updates.sku = parsed.data.sku;
  if (parsed.data.category != null) updates.category = parsed.data.category;
  if (parsed.data.price != null) updates.price = String(parsed.data.price);
  if (parsed.data.stock != null) updates.stock = parsed.data.stock;
  if (parsed.data.lowStockThreshold != null)
    updates.lowStockThreshold = parsed.data.lowStockThreshold;
  if (req.body.imageUrl !== undefined) updates.imageUrl = req.body.imageUrl || null;
  if (req.body.supplierId !== undefined) updates.supplierId = req.body.supplierId || null;

  const [product] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  broadcast("product_updated", { productId: product.id, name: product.name, sku: product.sku });

  res.json({ ...product, price: Number(product.price) });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/products/:id/stock", async (req, res): Promise<void> => {
  const params = UpdateStockParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, quantity, userId } = parsed.data;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  let newStock = product.stock;

  if (type === "IN") {
    newStock = product.stock + quantity;
  } else if (type === "OUT") {
    if (product.stock < quantity) {
      res.status(400).json({ error: "Insufficient stock" });
      return;
    }
    newStock = product.stock - quantity;
  } else if (type === "ADJUSTMENT") {
    newStock = quantity;
  }

  const [updatedProduct] = await db
    .update(productsTable)
    .set({ stock: newStock })
    .where(eq(productsTable.id, params.data.id))
    .returning();

  const [log] = await db
    .insert(stockLogsTable)
    .values({
      productId: params.data.id,
      type,
      quantity,
      userId: userId ?? null,
    })
    .returning();

  let sale = null;
  if (type === "OUT") {
    const [saleRecord] = await db
      .insert(salesTable)
      .values({
        productId: params.data.id,
        quantity,
        totalPrice: String(Number(product.price) * quantity),
      })
      .returning();
    sale = {
      ...saleRecord,
      totalPrice: Number(saleRecord.totalPrice),
      productName: product.name,
      productSku: product.sku,
    };
  }

  // Broadcast stock change to SSE clients
  broadcast("stock_updated", {
    productId:   params.data.id,
    productName: product.name,
    productSku:  product.sku,
    type,
    quantity,
    newStock,
  });

  // Low-stock alert when stock falls to or below threshold
  if (newStock <= updatedProduct.lowStockThreshold) {
    broadcast("low_stock_alert", {
      productId:   params.data.id,
      productName: product.name,
      stock:       newStock,
      threshold:   updatedProduct.lowStockThreshold,
    });
  }

  res.json({
    product: { ...updatedProduct, price: Number(updatedProduct.price) },
    log: {
      ...log,
      productName: product.name,
      productSku:  product.sku,
    },
    ...(sale ? { sale } : {}),
  });
});

router.get("/products/:id/qr", async (req, res): Promise<void> => {
  const params = GetProductQrParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const url = `/product?sku=${encodeURIComponent(product.sku)}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });

  res.json({
    sku: product.sku,
    url,
    qrDataUrl,
  });
});

/**
 * POST /api/products/bulk-import
 * Body: { items: Array<{ sku, stock?, price?, name?, category?, lowStockThreshold? }> }
 * Matches by SKU — updates existing products. Skips unknown SKUs.
 */
router.post("/products/bulk-import", async (req, res): Promise<void> => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items array is required" });
    return;
  }

  const results = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const item of items) {
    if (!item.sku) { results.skipped++; continue; }
    const sku = String(item.sku).trim().toUpperCase();

    const [existing] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.sku, sku));

    if (!existing) { results.skipped++; continue; }

    const updates: Record<string, unknown> = {};
    if (item.stock != null && !isNaN(Number(item.stock))) updates.stock = Number(item.stock);
    if (item.price != null && !isNaN(Number(item.price))) updates.price = String(Number(item.price));
    if (item.name != null) updates.name = String(item.name).trim();
    if (item.category != null) updates.category = String(item.category).trim();
    if (item.lowStockThreshold != null && !isNaN(Number(item.lowStockThreshold)))
      updates.lowStockThreshold = Number(item.lowStockThreshold);

    if (Object.keys(updates).length === 0) { results.skipped++; continue; }

    await db.update(productsTable).set(updates).where(eq(productsTable.sku, sku));
    results.updated++;
  }

  broadcast("product_updated", { bulk: true, updated: results.updated });
  res.json(results);
});

export default router;
