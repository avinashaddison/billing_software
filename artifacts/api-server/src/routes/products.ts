import { Router, type IRouter } from "express";
import { eq, ilike, or, and, lte, inArray, sql, desc, isNull } from "drizzle-orm";
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

// Sale prices no longer auto-expire — only the merchant can clear them by
// editing the product. The `sale_price_until` column is kept in the schema
// for backwards-compat but is ignored on read.
function effectiveSalePrice(p: typeof productsTable.$inferSelect): number | null {
  if (p.salePrice == null) return null;
  return Number(p.salePrice);
}

function mapProduct(p: typeof productsTable.$inferSelect) {
  const sp  = p.salePrice != null ? Number(p.salePrice) : null;
  const spu = p.salePriceUntil ? p.salePriceUntil.toISOString() : null;
  return {
    ...p,
    price: Number(p.price),
    salePrice: sp,
    salePriceUntil: spu,
    // Legacy aliases kept so older clients keep working
    rawSalePrice: sp,
    rawSalePriceUntil: spu,
    purchasePrice: p.purchasePrice != null ? Number(p.purchasePrice) : null,
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const tenantId = req.tenantId ?? null;

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

  // Tenant filtering (non-destructive): show tenant rows + legacy NULL rows
  const tenantCondition = tenantId
    ? or(eq(productsTable.tenantId, tenantId), sql`(${productsTable.tenantId} IS NULL)`)
    : sql`(${productsTable.tenantId} IS NULL)`;



  if (conditions.length > 0) {
    query = query.where(and(...conditions, tenantCondition));
  } else {
    query = query.where(tenantCondition);
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

  const { name, sku, barcode, category, price, salePrice, salePriceUntil, purchasePrice, stock, lowStockThreshold, imageUrl, supplierId } = parsed.data;

  if (salePrice != null && salePrice >= price) {
    res.status(400).json({ error: "salePrice must be less than the regular price" });
    return;
  }

  const parsedSalePriceUntil = (() => {
    if (!salePriceUntil) return null;
    const d = new Date(salePriceUntil);
    if (isNaN(d.getTime())) return null;
    return d;
  })();

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
      salePriceUntil: parsedSalePriceUntil,
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
  if (d.salePriceUntil !== undefined) {
    if (d.salePriceUntil) {
      const parsed = new Date(d.salePriceUntil);
      updates.salePriceUntil = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      updates.salePriceUntil = null;
    }
  }
  /* isTodayDeal: when explicitly sent in the body, write it through. Outside
     of the OpenAPI schema right now, so accept directly off req.body too. */
  const rawIsTodayDeal = (req.body as Record<string, unknown>)?.["isTodayDeal"];
  if (rawIsTodayDeal !== undefined) {
    updates.isTodayDeal = Boolean(rawIsTodayDeal);
  }

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
    const salePrice = effectiveSalePrice(product);
    const price = salePrice ?? Number(product.price);
    const [saleRecord] = await db
      .insert(salesTable)
      .values({
        productId: params.data.id,
        quantity,
        totalPrice: String(price * quantity),
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
 * POST /api/products/bulk-assign-supplier
 * Body: { productIds: string[]; supplierId: string | null }
 * Sets supplier_id on every listed product (null clears it).
 */
router.post("/products/bulk-assign-supplier", async (req, res): Promise<void> => {
  const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds : null;
  const supplierId = req.body?.supplierId ?? null;

  if (!productIds || productIds.length === 0) {
    res.status(400).json({ error: "productIds must be a non-empty array" });
    return;
  }
  if (supplierId !== null && typeof supplierId !== "string") {
    res.status(400).json({ error: "supplierId must be a string or null" });
    return;
  }
  if (productIds.some((id: unknown) => typeof id !== "string")) {
    res.status(400).json({ error: "productIds must be strings" });
    return;
  }

  const updated = await db
    .update(productsTable)
    .set({ supplierId })
    .where(inArray(productsTable.id, productIds))
    .returning({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku });

  broadcast("product_updated", { bulk: true, count: updated.length });
  res.json({ updated: updated.length, products: updated });
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

/* ──────────────────────────────────────────────────────────────────────────
 * Sale price recovery
 *
 * Older versions of the app silently nulled `salePrice` / `salePriceUntil`
 * when a merchant edited an unrelated field on a product whose sale had
 * already expired. The actual sale price IS however preserved per-bill in
 * `sale_items.pre_discount_price` (the unit price recorded at billing time
 * before any cashier line discount).
 *
 * These two endpoints let the merchant restore lost sale prices from that
 * audit trail. They are tenant-scoped via the standard tenant filter.
 *
 * Recovery rule: for each product with `salePrice IS NULL`, find the most
 * recent `sale_items.pre_discount_price` where that price is strictly less
 * than the current regular price. That's a clear signal a sale was active.
 *
 * Caveats:
 *   - Sale-priced products that never got billed are unrecoverable.
 *   - The original end date isn't stored anywhere, so restored sales are
 *     open-ended (salePriceUntil = null).
 * ────────────────────────────────────────────────────────────────────────── */

async function buildSalePriceRecoveryCandidates(tenantId: string | null) {
  const tenantCondition = tenantId
    ? or(eq(productsTable.tenantId, tenantId), isNull(productsTable.tenantId))
    : isNull(productsTable.tenantId);

  // Pull every product missing a salePrice that this tenant can see.
  const products = await db
    .select()
    .from(productsTable)
    .where(and(isNull(productsTable.salePrice), tenantCondition));

  const candidates: {
    id: string;
    sku: string;
    name: string;
    price: number;
    recoveredSalePrice: number;
    lastSoldAt: string;
  }[] = [];

  for (const p of products) {
    const regular = Number(p.price);

    // The "sale price" we want to recover is the sticker price BEFORE any
    // cashier line discount. `pre_discount_price` captures that — but it
    // is only set when the cashier actually applied a line discount.
    // For the common case (cashier billed at the sale price with no extra
    // discount), the sale price is stored as plain `sale_items.price`.
    // So coalesce: prefer pre_discount_price, fall back to price.
    const effective = sql<string>`COALESCE(${saleItemsTable.preDiscountPrice}, ${saleItemsTable.price})`;

    const [row] = await db
      .select({
        effective,
        createdAt: saleItemsTable.createdAt,
      })
      .from(saleItemsTable)
      .where(
        and(
          eq(saleItemsTable.productId, p.id),
          sql`${effective} IS NOT NULL`,
          sql`${effective} < ${regular}`,
        ),
      )
      .orderBy(desc(saleItemsTable.createdAt))
      .limit(1);

    if (!row || row.effective == null) continue;

    const recovered = Number(row.effective);
    if (!Number.isFinite(recovered) || recovered <= 0 || recovered >= regular) continue;

    candidates.push({
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: regular,
      recoveredSalePrice: recovered,
      lastSoldAt: row.createdAt.toISOString(),
    });
  }

  return candidates;
}

router.get("/products/sale-price-recovery/preview", async (req, res): Promise<void> => {
  const tenantId = req.tenantId ?? null;
  const candidates = await buildSalePriceRecoveryCandidates(tenantId);
  res.json({ count: candidates.length, candidates });
});

router.post("/products/sale-price-recovery/apply", async (req, res): Promise<void> => {
  const tenantId = req.tenantId ?? null;
  const candidates = await buildSalePriceRecoveryCandidates(tenantId);

  let restored = 0;
  for (const c of candidates) {
    await db
      .update(productsTable)
      .set({
        salePrice: String(c.recoveredSalePrice),
        salePriceUntil: null,
      })
      .where(eq(productsTable.id, c.id));
    restored++;
  }

  if (restored > 0) {
    broadcast("product_updated", { bulk: true, restored });
  }

  res.json({ restored, candidates });
});

export default router;
