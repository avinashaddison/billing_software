import { Router, type IRouter } from "express";
import { eq, ilike, or, and, lte, gte, inArray, sql, desc, isNull } from "drizzle-orm";
import {
  db,
  productsTable,
  stockLogsTable,
  salesTable,
  saleItemsTable,
  suppliersTable,
} from "@workspace/db";
import { broadcast } from "../lib/sse";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { liveProduct } from "../lib/product-scope";
import { recordAudit, tenantActor } from "../lib/audit";
import { requireWrite, requireAnyWrite } from "../middlewares/auth";
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
import { tenantLimitBlock } from "../lib/limits";

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
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, category, lowStock } = parsed.data;

  let query = db.select().from(productsTable).$dynamic();

  const conditions = [tenantWhere(productsTable.tenantId, req.tenantId), liveProduct()];

  if (search) {
    conditions.push(
      or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.sku, `%${search}%`)
      )!
    );
  }

  if (category) {
    conditions.push(eq(productsTable.category, category));
  }

  if (lowStock) {
    conditions.push(lte(productsTable.stock, productsTable.lowStockThreshold));
  }

  query = query.where(and(...conditions));

  const products = await query.orderBy(productsTable.name);

  res.json(products.map(mapProduct));
});

/* Creating a product is granted by EITHER `products: write` (full catalog
   management) OR `productEntry: write` — the owner-granted "Product Entry"
   permission that lets a data-entry staff member add new items without
   being handed edit/delete rights over the whole catalog. Editing and
   deleting below stay `products: write` only. */
router.post("/products", requireAnyWrite("products", "productEntry"), async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, sku, barcode, category, price, salePrice, salePriceUntil, purchasePrice, stock, lowStockThreshold, imageUrl, supplierId } = parsed.data;

  const capped = await tenantLimitBlock(req.tenantId, "products");
  if (capped) { res.status(403).json({ error: capped }); return; }

  /* Reject negative money/stock — the generated validators don't bound these,
     so without the guard a negative price or opening stock would persist and
     poison stock-value and profit reports. */
  const MAX_MONEY = 100_000_000;
  if (price < 0 || price > MAX_MONEY) {
    res.status(400).json({ error: "price must be a non-negative, realistic amount" });
    return;
  }
  if (salePrice != null && salePrice < 0) {
    res.status(400).json({ error: "salePrice must be non-negative" });
    return;
  }
  if (purchasePrice != null && (purchasePrice < 0 || purchasePrice > MAX_MONEY)) {
    res.status(400).json({ error: "purchasePrice must be a non-negative, realistic amount" });
    return;
  }
  if (stock != null && (!Number.isInteger(stock) || stock < 0)) {
    res.status(400).json({ error: "stock must be a non-negative whole number" });
    return;
  }
  if (lowStockThreshold != null && (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)) {
    res.status(400).json({ error: "lowStockThreshold must be a non-negative whole number" });
    return;
  }

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
      tenantId: req.tenantId,
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

  broadcast("product_created", { productId: product.id, name: product.name, sku: product.sku }, req.tenantId);

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

  /* Deliberately counts ARCHIVED products too (no liveProduct()): a deleted
     item's SKU is still printed on old bills, so auto-numbering must keep
     moving past it rather than hand the same code to a new product. */
  const products = await db
    .select({ sku: productsTable.sku })
    .from(productsTable)
    .where(and(
      tenantWhere(productsTable.tenantId, req.tenantId),
      ilike(productsTable.sku, likePattern),
    ));

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
    .where(and(
      eq(productsTable.sku, params.data.sku),
      tenantWhere(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ));

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
    .where(and(
      eq(productsTable.sku, code),
      tenantWhere(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ));

  // Fall back to barcode match (case-insensitive)
  if (!product) {
    [product] = await db
      .select()
      .from(productsTable)
      .where(and(
        eq(productsTable.barcode, req.params.code.trim()),
        tenantWhere(productsTable.tenantId, req.tenantId),
        liveProduct(),
      ));
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
    .where(and(
      eq(productsTable.id, params.data.id),
      tenantWhere(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(mapProduct(product));
});

router.patch("/products/:id", requireWrite("products"), async (req, res): Promise<void> => {
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

  /* Reject negative money/stock on update (generated validator doesn't bound
     these). Mirrors the create-route guard so a PATCH can't sneak in a value
     that a POST would reject. */
  const MAX_MONEY = 100_000_000;
  if (d.price != null && (d.price < 0 || d.price > MAX_MONEY)) {
    res.status(400).json({ error: "price must be a non-negative, realistic amount" });
    return;
  }
  if (d.purchasePrice != null && (Number(d.purchasePrice) < 0 || Number(d.purchasePrice) > MAX_MONEY)) {
    res.status(400).json({ error: "purchasePrice must be a non-negative, realistic amount" });
    return;
  }
  if (d.stock != null && (!Number.isInteger(d.stock) || d.stock < 0)) {
    res.status(400).json({ error: "stock must be a non-negative whole number" });
    return;
  }
  if (d.lowStockThreshold != null && (!Number.isInteger(d.lowStockThreshold) || d.lowStockThreshold < 0)) {
    res.status(400).json({ error: "lowStockThreshold must be a non-negative whole number" });
    return;
  }

  /* Fetch existing product upfront — needed for salePrice validation and 404 detection */
  const [existing] = await db
    .select()
    .from(productsTable)
    .where(and(
      eq(productsTable.id, params.data.id),
      tenantWhereWrite(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ));

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
     of the OpenAPI schema right now, so accept directly off req.body too.
     When flipped to FALSE we also wipe salePrice + salePriceUntil so the
     product's offer state fully resets — taking a product off Today's
     Deals shouldn't leave a phantom MRP strikethrough on the card. */
  const rawIsTodayDeal = (req.body as Record<string, unknown>)?.["isTodayDeal"];
  if (rawIsTodayDeal !== undefined) {
    const next = Boolean(rawIsTodayDeal);
    updates.isTodayDeal = next;
    if (!next) {
      updates.salePrice      = null;
      updates.salePriceUntil = null;
    }
  }

  const [product] = await db
    .update(productsTable)
    .set(updates)
    .where(and(
      eq(productsTable.id, params.data.id),
      tenantWhereWrite(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  broadcast("product_updated", { productId: product.id, name: product.name, sku: product.sku }, req.tenantId);

  res.json(mapProduct(product));
});

/* Deleting a product ARCHIVES it (stamps `deleted_at`); nothing is ever
   hard-deleted. A product that was ever billed is referenced by sale_items,
   sales (quick-OUT), returns and stock_logs: removing the row would either
   fail on those foreign keys or erase financial history, and nulling the
   bill lines' product_id trips sale_items' "product OR custom name" CHECK —
   which is exactly why every billed product used to answer DELETE with a
   500. Archiving keeps every bill, refund, report and movement intact while
   the product disappears from the catalogue (see lib/product-scope). Its SKU
   and barcode become free for reuse — uniqueness covers live rows only. */
router.delete("/products/:id", requireWrite("products"), async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { id } = params.data;

  /* Single guarded UPDATE: the tenant predicate and liveProduct() sit on the
     write itself, so a product of another shop, or one already deleted, is a
     404 rather than a second stamp. */
  const [archived] = await db
    .update(productsTable)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(productsTable.id, id),
      tenantWhereWrite(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ))
    .returning({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku, stock: productsTable.stock, tenantId: productsTable.tenantId });

  if (!archived) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  /* Reuses the `product_updated` event on purpose: every client (including
     already-deployed ones) refetches its product lists and dashboard on it,
     which is all a deletion needs. */
  broadcast("product_updated", { productId: archived.id, name: archived.name, sku: archived.sku, deleted: true }, req.tenantId);

  /* The stock that was on hand at deletion is the one figure no report will
     show afterwards, so it goes in the audit row. Never blocks the response. */
  void (async () => {
    await recordAudit({
      action: "tenant.product.delete",
      ...(await tenantActor(req)),
      targetTenant: req.tenantId ?? archived.tenantId ?? null,
      metadata: { productId: archived.id, name: archived.name, sku: archived.sku, stockAtDeletion: archived.stock },
      ip: req.ip,
    });
  })();

  res.sendStatus(204);
});

/* Stock IN / OUT / ADJUSTMENT on an existing product. Gated by the dedicated
   "Stock Entry" permission (`stockEntry`), NOT by `scan`: `scan` is what every
   cashier needs to bill, and moving inventory is a separate trust level. A
   data-entry staff member holding only "Product Entry" (`productEntry`) can
   add new items via POST /products but can never change stock here. The SPA
   mirrors this gate (Entry Data page, Scan page's Stock IN mode, product
   Quick Adjust) — keep them in step or buttons will disagree with the 403. */
router.post("/products/:id/stock", requireWrite("stockEntry"), async (req, res): Promise<void> => {
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

  const {
    type,
    quantity,
    userId,
    purchasePrice,
    supplierId,
    invoiceNumber,
    note,
  } = parsed.data;

  /* Harden the quantity: the generated zod validator is only `z.number()`
     (no int / sign / range bound), so without this a crafted request could
     send a negative OUT (which would INCREASE stock and write negative-
     revenue sale rows), a fractional value (500 at the integer column), or an
     absurd magnitude. IN/OUT need a positive count; ADJUSTMENT sets an
     absolute level so 0 is allowed but negatives never are. */
  const MAX_QTY = 10_000_000;
  if (!Number.isInteger(quantity)) {
    res.status(400).json({ error: "quantity must be a whole number" });
    return;
  }
  if (quantity < 0 || quantity > MAX_QTY) {
    res.status(400).json({ error: `quantity must be between 0 and ${MAX_QTY}` });
    return;
  }
  if ((type === "IN" || type === "OUT") && quantity < 1) {
    res.status(400).json({ error: "quantity must be at least 1 for IN/OUT" });
    return;
  }

  const hasRestockMetadata =
    purchasePrice !== undefined ||
    supplierId !== undefined ||
    invoiceNumber !== undefined ||
    note !== undefined;
  if (type !== "IN" && hasRestockMetadata) {
    res.status(400).json({ error: "Purchase, supplier, invoice, and note details are only valid for stock IN" });
    return;
  }

  /* All reads + writes run inside one transaction so the stock change, the
     stock-log row and any sale row commit (or roll back) together. OUT uses
     an atomic GUARDED decrement so two concurrent OUTs can't oversell. */
  const outcome = await db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, params.data.id),
        tenantWhereWrite(productsTable.tenantId, req.tenantId),
        liveProduct(),
      ));

    if (!product) return { status: "not_found" as const };

    let restockMetadata: {
      purchasePrice: string | null;
      supplierId: string | null;
      supplierName: string | null;
      invoiceNumber: string | null;
      note: string | null;
    } = {
      purchasePrice: null,
      supplierId: null,
      supplierName: null,
      invoiceNumber: null,
      note: null,
    };

    if (type === "IN") {
      const resolvedPurchasePrice =
        purchasePrice !== undefined
          ? purchasePrice
          : product.purchasePrice != null
            ? Number(product.purchasePrice)
            : null;
      const resolvedSupplierId =
        supplierId !== undefined ? supplierId : product.supplierId;

      let supplierName: string | null = null;
      if (resolvedSupplierId) {
        const [supplier] = await tx
          .select({ id: suppliersTable.id, name: suppliersTable.name })
          .from(suppliersTable)
          .where(and(
            eq(suppliersTable.id, resolvedSupplierId),
            tenantWhere(suppliersTable.tenantId, req.tenantId),
          ));
        if (!supplier) return { status: "supplier_not_found" as const };
        supplierName = supplier.name;
      }

      restockMetadata = {
        purchasePrice:
          resolvedPurchasePrice != null ? String(resolvedPurchasePrice) : null,
        supplierId: resolvedSupplierId ?? null,
        supplierName,
        invoiceNumber: invoiceNumber?.trim() || null,
        note: note?.trim() || null,
      };
    }

    /* Each stock write repeats the tenant AND live predicates rather than
       relying solely on the ownership SELECT above — same reasoning as the
       delete route: the guarantee should live on the statement that actually
       changes data. The SELECT is unlocked, so a delete committing between it
       and this UPDATE must make the write miss, not mutate an archived row. */
    const writeGuard = and(
      eq(productsTable.id, params.data.id),
      tenantWhereWrite(productsTable.tenantId, req.tenantId),
      liveProduct(),
    );
    let updatedProduct: typeof productsTable.$inferSelect | undefined;
    if (type === "IN") {
      [updatedProduct] = await tx
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${quantity}` })
        .where(writeGuard)
        .returning();
    } else if (type === "OUT") {
      /* Guarded decrement: the row only updates if enough stock is still on
         hand at write time, so concurrent OUTs can never drive stock negative. */
      [updatedProduct] = await tx
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${quantity}` })
        .where(and(writeGuard, gte(productsTable.stock, quantity)))
        .returning();
      if (!updatedProduct) {
        /* Distinguish "sold out" from "deleted a moment ago". */
        const [still] = await tx
          .select({ deletedAt: productsTable.deletedAt })
          .from(productsTable)
          .where(eq(productsTable.id, params.data.id));
        if (!still || still.deletedAt != null) return { status: "not_found" as const };
        return { status: "insufficient" as const };
      }
    } else {
      // ADJUSTMENT — set absolute value
      [updatedProduct] = await tx
        .update(productsTable)
        .set({ stock: quantity })
        .where(writeGuard)
        .returning();
    }
    if (!updatedProduct) return { status: "not_found" as const };

    const [log] = await tx
      .insert(stockLogsTable)
      .values({
        tenantId: product.tenantId, // inherit the product's tenant so legacy NULL rows stay NULL
        productId: params.data.id,
        type,
        quantity,
        ...restockMetadata,
        /* Attribute the movement to the signed-in staff member, as checkout
           and returns do; the client-declared id is only a fallback for
           sessions that carry no staff id, so the history can name who
           actually did it rather than whoever the request claimed. */
        userId: req.staffId ?? userId ?? null,
      })
      .returning();

    let sale: Record<string, unknown> | null = null;
    if (type === "OUT") {
      const salePrice = effectiveSalePrice(product);
      const price = salePrice ?? Number(product.price);
      const [saleRecord] = await tx
        .insert(salesTable)
        .values({
          tenantId: product.tenantId,
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

    return { status: "ok" as const, product, updatedProduct: updatedProduct!, log, sale };
  });

  if (outcome.status === "not_found") {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (outcome.status === "insufficient") {
    res.status(400).json({ error: "Insufficient stock" });
    return;
  }
  if (outcome.status === "supplier_not_found") {
    res.status(400).json({ error: "Supplier not found for this shop" });
    return;
  }

  const { product, updatedProduct, log, sale } = outcome;
  const newStock = updatedProduct.stock;

  // Broadcast stock change to SSE clients
  broadcast("stock_updated", {
    productId:   params.data.id,
    productName: product.name,
    productSku:  product.sku,
    type,
    quantity,
    newStock,
  }, product.tenantId);

  // Low-stock alert when stock falls to or below threshold
  if (newStock <= updatedProduct.lowStockThreshold) {
    broadcast("low_stock_alert", {
      productId:   params.data.id,
      productName: product.name,
      stock:       newStock,
      threshold:   updatedProduct.lowStockThreshold,
    }, product.tenantId);
  }

  res.json({
    product: mapProduct(updatedProduct),
    log: {
      ...log,
      purchasePrice: log.purchasePrice != null ? Number(log.purchasePrice) : null,
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
    .where(and(
      eq(productsTable.id, params.data.id),
      tenantWhere(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ));

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
router.post("/products/bulk-assign-supplier", requireWrite("products"), async (req, res): Promise<void> => {
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
    .where(and(
      inArray(productsTable.id, productIds),
      tenantWhereWrite(productsTable.tenantId, req.tenantId),
      liveProduct(),
    ))
    .returning({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku });

  broadcast("product_updated", { bulk: true, count: updated.length }, req.tenantId);
  res.json({ updated: updated.length, products: updated });
});

/**
 * POST /api/products/bulk-import
 * Body: { items: Array<{ sku, stock?, price?, salePrice?, name?, category?, lowStockThreshold? }> }
 * Matches by SKU (within the caller's tenant) — updates existing products.
 * If SKU is unknown but name + category + price are provided → creates a new product.
 */
router.post("/products/bulk-import", requireWrite("products"), async (req, res): Promise<void> => {
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
      .where(and(
        eq(productsTable.sku, sku),
        tenantWhereWrite(productsTable.tenantId, req.tenantId),
        liveProduct(),
      ));

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
        tenantId: req.tenantId,
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

    await db
      .update(productsTable)
      .set(updates)
      .where(and(
        eq(productsTable.sku, sku),
        tenantWhereWrite(productsTable.tenantId, req.tenantId),
        liveProduct(),
      ));
    results.updated++;
  }

  broadcast("product_updated", { bulk: true, updated: results.updated, created: results.created }, req.tenantId);
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

async function buildSalePriceRecoveryCandidates(tenantId: string | null | undefined) {
  // Pull every product missing a salePrice that this tenant can see.
  const products = await db
    .select()
    .from(productsTable)
    .where(and(isNull(productsTable.salePrice), tenantWhere(productsTable.tenantId, tenantId), liveProduct()));

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
  const candidates = await buildSalePriceRecoveryCandidates(req.tenantId);
  res.json({ count: candidates.length, candidates });
});

router.post("/products/sale-price-recovery/apply", requireWrite("products"), async (req, res): Promise<void> => {
  const candidates = await buildSalePriceRecoveryCandidates(req.tenantId);

  let restored = 0;
  for (const c of candidates) {
    const [updated] = await db
      .update(productsTable)
      .set({
        salePrice: String(c.recoveredSalePrice),
        salePriceUntil: null,
      })
      .where(and(
        eq(productsTable.id, c.id),
        tenantWhereWrite(productsTable.tenantId, req.tenantId),
        liveProduct(),
      ))
      .returning({ id: productsTable.id });
    if (updated) restored++;
  }

  if (restored > 0) {
    broadcast("product_updated", { bulk: true, restored }, req.tenantId);
  }

  res.json({ restored, candidates });
});

export default router;
