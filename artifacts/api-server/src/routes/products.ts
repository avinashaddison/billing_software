import { Router, type IRouter } from "express";
import { eq, ilike, or, and, lte } from "drizzle-orm";
import { db, productsTable, stockLogsTable, salesTable, saleItemsTable } from "@workspace/db";
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

function mapProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price:         Number(p.price),
    salePrice:     p.salePrice     != null ? Number(p.salePrice)     : null,
    purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
  };
}

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

  res.json(products.map(mapProduct));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, sku, barcode, category, price, salePrice, purchasePrice, stock, lowStockThreshold, imageUrl, supplierId } = parsed.data;

  if (salePrice != null && salePrice >= price) {
    res.status(400).json({ error: "salePrice must be less than the regular price" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      name,
      sku,
      barcode: barcode?.trim() || null,
      category,
      price: String(price),
      salePrice: salePrice != null ? String(salePrice) : null,
      purchasePrice: purchasePrice != null ? String(purchasePrice) : null,
      stock: stock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 5,
      imageUrl: imageUrl ?? null,
      supplierId: supplierId ?? null,
    })
    .returning();

  broadcast("product_created", { productId: product.id, name: product.name, sku: product.sku });

  res.status(201).json(mapProduct(product));
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

  res.json(mapProduct(product));
});

/* Scan lookup — tries SKU first, then barcode. Used by the scanner. */
router.get("/products/scan/:code", async (req, res): Promise<void> => {
  const code = (req.params.code ?? "").trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  // Try exact SKU match first
  let [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.sku, code));

  // Fall back to barcode match (case-insensitive)
  if (!product) {
    [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.barcode, req.params.code.trim()));
  }

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(mapProduct(product));
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

  res.json(mapProduct(product));
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

  const d = parsed.data;

  /* Fetch existing product upfront — needed for salePrice validation and 404 detection */
  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  /* Validate and enforce salePrice < price invariant across all update combos */
  const incomingPrice  = d.price    != null ? d.price    : null;
  const incomingSp     = d.salePrice != null ? Number(d.salePrice) : null;
  const persistedPrice = Number(existing.price);
  const persistedSp    = existing.salePrice != null ? Number(existing.salePrice) : null;

  if (incomingSp != null) {
    if (isNaN(incomingSp) || incomingSp <= 0) {
      res.status(400).json({ error: "salePrice must be a positive number" });
      return;
    }
    const effectivePrice = incomingPrice ?? persistedPrice;
    if (incomingSp >= effectivePrice) {
      res.status(400).json({ error: "salePrice must be less than the regular price" });
      return;
    }
  }

  /* When only price changes, clear salePrice if it would become >= new price */
  let clearSalePrice = false;
  if (d.salePrice === undefined && incomingPrice != null && persistedSp != null && persistedSp >= incomingPrice) {
    clearSalePrice = true;
  }

  const updates: Record<string, unknown> = {};
  if (d.name != null) updates.name = d.name;
  if (d.sku != null) updates.sku = d.sku;
  if (d.barcode !== undefined) updates.barcode = d.barcode?.trim() || null;
  if (d.category != null) updates.category = d.category;
  if (d.price != null) updates.price = String(d.price);
  if (clearSalePrice) updates.salePrice = null;
  else if (d.salePrice !== undefined)
    updates.salePrice = d.salePrice != null ? String(Number(d.salePrice)) : null;
  if (d.stock != null) updates.stock = d.stock;
  if (d.lowStockThreshold != null) updates.lowStockThreshold = d.lowStockThreshold;
  if (d.imageUrl !== undefined) updates.imageUrl = d.imageUrl || null;
  if (d.supplierId !== undefined) updates.supplierId = d.supplierId || null;
  if (d.purchasePrice !== undefined) updates.purchasePrice = d.purchasePrice != null ? String(d.purchasePrice) : null;

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

  res.json(mapProduct(product));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;

  const [product] = await db.transaction(async (tx) => {
    /* 1. Remove stock-movement logs (history has no value without the product) */
    await tx.delete(stockLogsTable).where(eq(stockLogsTable.productId, id));

    /* 2. Nullify the product reference in sale items so bill history is preserved */
    await tx
      .update(saleItemsTable)
      .set({ productId: null })
      .where(eq(saleItemsTable.productId, id));

    /* 3. Delete the product itself */
    return tx
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning();
  });

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
    const effectivePrice = product.salePrice != null ? Number(product.salePrice) : Number(product.price);
    const [saleRecord] = await db
      .insert(salesTable)
      .values({
        productId: params.data.id,
        quantity,
        totalPrice: String(effectivePrice * quantity),
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
    product: mapProduct(updatedProduct),
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
 * Body: { items: Array<{ sku, stock?, price?, salePrice?, name?, category?, lowStockThreshold? }> }
 * Matches by SKU — updates existing products.
 * If SKU is unknown but name + category + price are provided → creates a new product.
 */
router.post("/products/bulk-import", async (req, res): Promise<void> => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items array is required" });
    return;
  }

  const results = { updated: 0, created: 0, skipped: 0, errors: [] as string[] };

  for (const item of items) {
    if (!item.sku) { results.skipped++; continue; }
    const sku = String(item.sku).trim().toUpperCase();

    const [existing] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.sku, sku));

    if (!existing) {
      /* Try to create if name + category + price are present */
      const name     = item.name     ? String(item.name).trim()     : null;
      const category = item.category ? String(item.category).trim() : null;
      const price    = item.price != null && !isNaN(Number(item.price)) ? Number(item.price) : null;

      if (!name || !category || !price) {
        results.skipped++;
        continue;
      }

      const salePriceCreate = item.salePrice != null && !isNaN(Number(item.salePrice))
        ? Number(item.salePrice) : null;
      if (salePriceCreate != null && salePriceCreate >= price) {
        results.skipped++;
        results.errors.push(`${sku}: salePrice (${salePriceCreate}) must be less than price (${price})`);
        continue;
      }

      await db.insert(productsTable).values({
        name,
        sku,
        category,
        price:             String(price),
        salePrice:         salePriceCreate != null ? String(salePriceCreate) : null,
        stock:             item.stock != null && !isNaN(Number(item.stock)) ? Number(item.stock) : 0,
        lowStockThreshold: item.lowStockThreshold != null && !isNaN(Number(item.lowStockThreshold)) ? Number(item.lowStockThreshold) : 5,
        imageUrl:          item.imageUrl ? String(item.imageUrl).trim() : null,
        supplierId:        null,
      });
      results.created++;
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (item.stock != null && !isNaN(Number(item.stock))) updates.stock = Number(item.stock);
    const updatedPrice = item.price != null && !isNaN(Number(item.price)) ? Number(item.price) : null;
    if (updatedPrice != null) updates.price = String(updatedPrice);
    if (item.salePrice !== undefined) {
      const salePriceUpd = item.salePrice != null && !isNaN(Number(item.salePrice)) ? Number(item.salePrice) : null;
      const effectivePrice = updatedPrice ?? (existing ? Number(existing.price) : null);
      if (salePriceUpd != null && effectivePrice != null && salePriceUpd >= effectivePrice) {
        results.errors.push(`${sku}: salePrice (${salePriceUpd}) must be less than price (${effectivePrice})`);
      } else {
        updates.salePrice = salePriceUpd != null ? String(salePriceUpd) : null;
      }
    } else if (updatedPrice != null && existing) {
      /* price-only update: clear salePrice if it would become >= new price */
      const existingSp = existing.salePrice != null ? Number(existing.salePrice) : null;
      if (existingSp != null && existingSp >= updatedPrice) {
        updates.salePrice = null;
        results.errors.push(`${sku}: existing salePrice (${existingSp}) >= new price (${updatedPrice}); sale price cleared`);
      }
    }
    if (item.name != null) updates.name = String(item.name).trim();
    if (item.category != null) updates.category = String(item.category).trim();
    if (item.lowStockThreshold != null && !isNaN(Number(item.lowStockThreshold)))
      updates.lowStockThreshold = Number(item.lowStockThreshold);

    if (Object.keys(updates).length === 0) { results.skipped++; continue; }

    await db.update(productsTable).set(updates).where(eq(productsTable.sku, sku));
    results.updated++;
  }

  broadcast("product_updated", { bulk: true, updated: results.updated, created: results.created });
  res.json(results);
});

export default router;
