/**
 * Public API v1 — the surface external tools reach with a tenant API key.
 *
 * Auth + rate limiting happen in middlewares/api-key.ts (mounted in app.ts);
 * by the time a request lands here, req.apiKey and req.tenantId are set and
 * any cookie session has been cleared.
 *
 * Contract notes (also documented on the /developers page):
 * - Money fields (price, totals…) are DECIMAL STRINGS like "120.00" to avoid
 *   floating-point drift. Send numbers or numeric strings; we normalise.
 * - Reads use the same tenant scoping as the in-app pages; writes are
 *   strictly scoped to the key's shop.
 * - Bills are read-only in v1: money is created at the till, not by robots.
 * - Every write lands in the audit trail as `apikey:<key name>`.
 */
import { Router, type IRouter, type Request } from "express";
import { and, eq, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  productsTable,
  suppliersTable,
  billsTable,
  saleItemsTable,
  stockLogsTable,
} from "@workspace/db";
import { tenantWhere, tenantWhereWrite } from "../lib/tenant";
import { requireWriteScope } from "../middlewares/api-key";
import { recordAudit } from "../lib/audit";

const router: IRouter = Router();

/* ── helpers ─────────────────────────────────────────────────────────── */

function apiActor(req: Request): { actorId: null; actorEmail: string } {
  return { actorId: null, actorEmail: `apikey:${req.apiKey?.name ?? "unknown"}` };
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

const isUuid = (v: string): boolean => z.uuid().safeParse(v).success;

/** Decimal string for numeric columns; keeps paise exact. */
const money = (n: number): string => n.toFixed(2);

const PageQuery = z.object({
  page:  z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/* IST calendar-day filters — the shop's business day, matching in-app reports. */
const istAtLeast = (col: SQL | typeof billsTable.createdAt, day: string): SQL =>
  sql`DATE(${col} AT TIME ZONE 'Asia/Kolkata') >= ${day}::date`;
const istAtMost = (col: SQL | typeof billsTable.createdAt, day: string): SQL =>
  sql`DATE(${col} AT TIME ZONE 'Asia/Kolkata') <= ${day}::date`;

/* Explicit response columns — never leak internals like tenant_id/key hashes. */
const productColumns = {
  id:                productsTable.id,
  name:              productsTable.name,
  sku:               productsTable.sku,
  barcode:           productsTable.barcode,
  category:          productsTable.category,
  price:             productsTable.price,
  salePrice:         productsTable.salePrice,
  salePriceUntil:    productsTable.salePriceUntil,
  stock:             productsTable.stock,
  lowStockThreshold: productsTable.lowStockThreshold,
  purchasePrice:     productsTable.purchasePrice,
  imageUrl:          productsTable.imageUrl,
  supplierId:        productsTable.supplierId,
  createdAt:         productsTable.createdAt,
};

const supplierColumns = {
  id:        suppliersTable.id,
  name:      suppliersTable.name,
  contact:   suppliersTable.contact,
  email:     suppliersTable.email,
  phone:     suppliersTable.phone,
  address:   suppliersTable.address,
  notes:     suppliersTable.notes,
  createdAt: suppliersTable.createdAt,
};

const billColumns = {
  id:             billsTable.id,
  billNumber:     billsTable.billNumber,
  totalAmount:    billsTable.totalAmount,
  itemsCount:     billsTable.itemsCount,
  customerName:   billsTable.customerName,
  customerPhone:  billsTable.customerPhone,
  paymentMode:    billsTable.paymentMode,
  paymentStatus:  billsTable.paymentStatus,
  amountPaid:     billsTable.amountPaid,
  discountAmount: billsTable.discountAmount,
  createdAt:      billsTable.createdAt,
};

const billItemColumns = {
  id:               saleItemsTable.id,
  productId:        saleItemsTable.productId,
  customName:       saleItemsTable.customName,
  quantity:         saleItemsTable.quantity,
  price:            saleItemsTable.price,
  mrp:              saleItemsTable.mrp,
  preDiscountPrice: saleItemsTable.preDiscountPrice,
  discountType:     saleItemsTable.discountType,
  discountValue:    saleItemsTable.discountValue,
  subtotal:         saleItemsTable.subtotal,
};

/* ── key introspection ───────────────────────────────────────────────── */

router.get("/me", (req, res): void => {
  res.json({
    keyName: req.apiKey?.name ?? null,
    scope:   req.apiKey?.scope ?? "read",
    shop: {
      id:   req.apiKey?.tenantId ?? null,
      name: req.apiKey?.tenantName ?? null,
    },
  });
});

/* ── products ────────────────────────────────────────────────────────── */

const ProductsQuery = PageQuery.extend({
  search:   z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
});

router.get("/products", async (req, res): Promise<void> => {
  const q = ProductsQuery.parse(req.query);
  const conditions: SQL[] = [tenantWhere(productsTable.tenantId, req.tenantId)];
  if (q.search) {
    const pattern = `%${q.search}%`;
    conditions.push(
      or(
        ilike(productsTable.name, pattern),
        ilike(productsTable.sku, pattern),
        ilike(productsTable.barcode, pattern),
      ) as SQL,
    );
  }
  if (q.category) conditions.push(eq(productsTable.category, q.category));

  const where = and(...conditions);
  const [rows, [{ total }]] = await Promise.all([
    db.select(productColumns).from(productsTable).where(where)
      .orderBy(productsTable.name)
      .limit(q.limit).offset((q.page - 1) * q.limit),
    db.select({ total: sql<number>`COUNT(*)::int` }).from(productsTable).where(where),
  ]);
  res.json({ data: rows, page: q.page, limit: q.limit, total });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!isUuid(id)) { res.status(404).json({ error: "Product not found" }); return; }
  const [row] = await db.select(productColumns).from(productsTable)
    .where(and(eq(productsTable.id, id), tenantWhere(productsTable.tenantId, req.tenantId)));
  if (!row) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(row);
});

const ProductCreateBody = z.object({
  name:              z.string().trim().min(1).max(200),
  sku:               z.string().trim().min(1).max(100),
  barcode:           z.string().trim().min(1).max(100).nullish(),
  category:          z.string().trim().min(1).max(100),
  price:             z.coerce.number().min(0).max(10_000_000),
  salePrice:         z.coerce.number().min(0).max(10_000_000).nullish(),
  stock:             z.coerce.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  purchasePrice:     z.coerce.number().min(0).max(10_000_000).nullish(),
  imageUrl:          z.url().max(500).nullish(),
  supplierId:        z.uuid().nullish(),
});

/** 400 when a linked supplier id doesn't belong to this shop. */
async function supplierExists(req: Request, supplierId: string): Promise<boolean> {
  const [s] = await db.select({ id: suppliersTable.id }).from(suppliersTable)
    .where(and(eq(suppliersTable.id, supplierId), tenantWhereWrite(suppliersTable.tenantId, req.tenantId)));
  return !!s;
}

router.post("/products", requireWriteScope, async (req, res): Promise<void> => {
  const body = ProductCreateBody.parse(req.body);
  if (body.supplierId && !(await supplierExists(req, body.supplierId))) {
    res.status(400).json({ error: "supplierId does not match any supplier in this shop" });
    return;
  }
  try {
    const [row] = await db.insert(productsTable).values({
      tenantId:          req.tenantId,
      name:              body.name,
      sku:               body.sku,
      barcode:           body.barcode ?? null,
      category:          body.category,
      price:             money(body.price),
      salePrice:         body.salePrice != null ? money(body.salePrice) : null,
      stock:             body.stock,
      lowStockThreshold: body.lowStockThreshold ?? 5,
      purchasePrice:     body.purchasePrice != null ? money(body.purchasePrice) : null,
      imageUrl:          body.imageUrl ?? null,
      supplierId:        body.supplierId ?? null,
    }).returning(productColumns);
    void recordAudit({
      action: "api.product.create",
      ...apiActor(req),
      targetTenant: req.tenantId ?? null,
      metadata: { productId: row.id, name: row.name, sku: row.sku, apiKeyId: req.apiKey?.id },
      ip: req.ip,
    });
    res.status(201).json(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A product with this SKU or barcode already exists in this shop" });
      return;
    }
    throw err;
  }
});

const ProductPatchBody = z.object({
  name:              z.string().trim().min(1).max(200).optional(),
  sku:               z.string().trim().min(1).max(100).optional(),
  barcode:           z.string().trim().min(1).max(100).nullish(),
  category:          z.string().trim().min(1).max(100).optional(),
  price:             z.coerce.number().min(0).max(10_000_000).optional(),
  salePrice:         z.coerce.number().min(0).max(10_000_000).nullish(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).optional(),
  purchasePrice:     z.coerce.number().min(0).max(10_000_000).nullish(),
  imageUrl:          z.url().max(500).nullish(),
  supplierId:        z.uuid().nullish(),
});

router.patch("/products/:id", requireWriteScope, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!isUuid(id)) { res.status(404).json({ error: "Product not found" }); return; }
  const body = ProductPatchBody.parse(req.body);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined)              updates["name"] = body.name;
  if (body.sku !== undefined)               updates["sku"] = body.sku;
  if ("barcode" in req.body)                updates["barcode"] = body.barcode ?? null;
  if (body.category !== undefined)          updates["category"] = body.category;
  if (body.price !== undefined)             updates["price"] = money(body.price);
  if ("salePrice" in req.body)              updates["salePrice"] = body.salePrice != null ? money(body.salePrice) : null;
  if (body.lowStockThreshold !== undefined) updates["lowStockThreshold"] = body.lowStockThreshold;
  if ("purchasePrice" in req.body)          updates["purchasePrice"] = body.purchasePrice != null ? money(body.purchasePrice) : null;
  if ("imageUrl" in req.body)               updates["imageUrl"] = body.imageUrl ?? null;
  if ("supplierId" in req.body)             updates["supplierId"] = body.supplierId ?? null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update. Note: stock changes go through POST /products/:id/stock" });
    return;
  }
  if (body.supplierId && !(await supplierExists(req, body.supplierId))) {
    res.status(400).json({ error: "supplierId does not match any supplier in this shop" });
    return;
  }

  try {
    /* Row-locked snapshot + update so the audit diff is exact under races. */
    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(productsTable)
        .where(and(eq(productsTable.id, id), tenantWhereWrite(productsTable.tenantId, req.tenantId)))
        .for("update");
      if (!before) return null;
      const [row] = await tx.update(productsTable).set(updates)
        .where(and(eq(productsTable.id, id), tenantWhereWrite(productsTable.tenantId, req.tenantId)))
        .returning(productColumns);
      if (!row) return null;
      return { before, row };
    });
    if (!result) { res.status(404).json({ error: "Product not found" }); return; }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(updates)) {
      const fromV = (result.before as Record<string, unknown>)[key];
      const toV   = (result.row as unknown as Record<string, unknown>)[key];
      if (fromV !== toV) changes[key] = { from: fromV, to: toV };
    }
    if (Object.keys(changes).length > 0) {
      void recordAudit({
        action: "api.product.update",
        ...apiActor(req),
        targetTenant: req.tenantId ?? null,
        metadata: { productId: id, name: result.before.name, changes, apiKeyId: req.apiKey?.id },
        ip: req.ip,
      });
    }
    res.json(result.row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A product with this SKU or barcode already exists in this shop" });
      return;
    }
    throw err;
  }
});

const StockBody = z.object({
  change: z.coerce.number().int().min(-1_000_000).max(1_000_000)
    .refine((v) => v !== 0, "change must not be 0"),
  note: z.string().trim().max(200).optional(),
});

router.post("/products/:id/stock", requireWriteScope, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!isUuid(id)) { res.status(404).json({ error: "Product not found" }); return; }
  const body = StockBody.parse(req.body);

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(productsTable)
      .where(and(eq(productsTable.id, id), tenantWhereWrite(productsTable.tenantId, req.tenantId)))
      .for("update");
    if (!before) return { kind: "notfound" as const };
    const newStock = before.stock + body.change;
    if (newStock < 0) return { kind: "negative" as const, current: before.stock };
    const [row] = await tx.update(productsTable).set({ stock: newStock })
      .where(eq(productsTable.id, before.id))
      .returning(productColumns);
    /* Signed ADJUSTMENT keeps API corrections distinct from in-app IN/OUT
       movements, so purchase/sales reports are never polluted by syncs. */
    await tx.insert(stockLogsTable).values({
      tenantId:  req.tenantId,
      productId: before.id,
      type:      "ADJUSTMENT",
      quantity:  body.change,
      userId:    `apikey:${req.apiKey?.name ?? "unknown"}`,
    });
    return { kind: "ok" as const, row, from: before.stock, to: newStock };
  });

  if (result.kind === "notfound") { res.status(404).json({ error: "Product not found" }); return; }
  if (result.kind === "negative") {
    res.status(400).json({ error: `Stock cannot go below 0 (current stock: ${result.current})` });
    return;
  }
  void recordAudit({
    action: "api.product.stock",
    ...apiActor(req),
    targetTenant: req.tenantId ?? null,
    metadata: { productId: id, change: body.change, from: result.from, to: result.to, note: body.note ?? null, apiKeyId: req.apiKey?.id },
    ip: req.ip,
  });
  res.json(result.row);
});

/* ── categories (in use) ─────────────────────────────────────────────── */

router.get("/categories", async (req, res): Promise<void> => {
  const rows = await db.selectDistinct({ category: productsTable.category })
    .from(productsTable)
    .where(tenantWhere(productsTable.tenantId, req.tenantId))
    .orderBy(productsTable.category);
  res.json(rows.map((r) => r.category));
});

/* ── suppliers ───────────────────────────────────────────────────────── */

router.get("/suppliers", async (req, res): Promise<void> => {
  const q = PageQuery.parse(req.query);
  const where = tenantWhere(suppliersTable.tenantId, req.tenantId);
  const [rows, [{ total }]] = await Promise.all([
    db.select(supplierColumns).from(suppliersTable).where(where)
      .orderBy(suppliersTable.name)
      .limit(q.limit).offset((q.page - 1) * q.limit),
    db.select({ total: sql<number>`COUNT(*)::int` }).from(suppliersTable).where(where),
  ]);
  res.json({ data: rows, page: q.page, limit: q.limit, total });
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!isUuid(id)) { res.status(404).json({ error: "Supplier not found" }); return; }
  const [row] = await db.select(supplierColumns).from(suppliersTable)
    .where(and(eq(suppliersTable.id, id), tenantWhere(suppliersTable.tenantId, req.tenantId)));
  if (!row) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(row);
});

const SupplierCreateBody = z.object({
  name:    z.string().trim().min(1).max(200),
  contact: z.string().trim().max(200).nullish(),
  email:   z.string().trim().max(200).nullish(),
  phone:   z.string().trim().max(30).nullish(),
  address: z.string().trim().max(500).nullish(),
  notes:   z.string().trim().max(1000).nullish(),
});

router.post("/suppliers", requireWriteScope, async (req, res): Promise<void> => {
  const body = SupplierCreateBody.parse(req.body);
  const [row] = await db.insert(suppliersTable).values({
    tenantId: req.tenantId,
    name:     body.name,
    contact:  body.contact ?? null,
    email:    body.email ?? null,
    phone:    body.phone ?? null,
    address:  body.address ?? null,
    notes:    body.notes ?? null,
  }).returning(supplierColumns);
  void recordAudit({
    action: "api.supplier.create",
    ...apiActor(req),
    targetTenant: req.tenantId ?? null,
    metadata: { supplierId: row.id, name: row.name, apiKeyId: req.apiKey?.id },
    ip: req.ip,
  });
  res.status(201).json(row);
});

const SupplierPatchBody = SupplierCreateBody.partial();

router.patch("/suppliers/:id", requireWriteScope, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!isUuid(id)) { res.status(404).json({ error: "Supplier not found" }); return; }
  const body = SupplierPatchBody.parse(req.body);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined)   updates["name"] = body.name;
  if ("contact" in req.body)     updates["contact"] = body.contact ?? null;
  if ("email" in req.body)       updates["email"] = body.email ?? null;
  if ("phone" in req.body)       updates["phone"] = body.phone ?? null;
  if ("address" in req.body)     updates["address"] = body.address ?? null;
  if ("notes" in req.body)       updates["notes"] = body.notes ?? null;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, id), tenantWhereWrite(suppliersTable.tenantId, req.tenantId)))
      .for("update");
    if (!before) return null;
    const [row] = await tx.update(suppliersTable).set(updates)
      .where(and(eq(suppliersTable.id, id), tenantWhereWrite(suppliersTable.tenantId, req.tenantId)))
      .returning(supplierColumns);
    if (!row) return null;
    return { before, row };
  });
  if (!result) { res.status(404).json({ error: "Supplier not found" }); return; }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(updates)) {
    const fromV = (result.before as Record<string, unknown>)[key];
    const toV   = (result.row as unknown as Record<string, unknown>)[key];
    if (fromV !== toV) changes[key] = { from: fromV, to: toV };
  }
  if (Object.keys(changes).length > 0) {
    void recordAudit({
      action: "api.supplier.update",
      ...apiActor(req),
      targetTenant: req.tenantId ?? null,
      metadata: { supplierId: id, supplierName: result.before.name, changes, apiKeyId: req.apiKey?.id },
      ip: req.ip,
    });
  }
  res.json(result.row);
});

/* ── bills (read-only) ───────────────────────────────────────────────── */

const BillsQuery = PageQuery.extend({
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  status: z.enum(["paid", "partial", "unpaid"]).optional(),
});

router.get("/bills", async (req, res): Promise<void> => {
  const q = BillsQuery.parse(req.query);
  const conditions: SQL[] = [tenantWhere(billsTable.tenantId, req.tenantId)];
  if (q.from)   conditions.push(istAtLeast(billsTable.createdAt, q.from));
  if (q.to)     conditions.push(istAtMost(billsTable.createdAt, q.to));
  if (q.status) conditions.push(eq(billsTable.paymentStatus, q.status));

  const where = and(...conditions);
  const [rows, [{ total }]] = await Promise.all([
    db.select(billColumns).from(billsTable).where(where)
      .orderBy(desc(billsTable.createdAt))
      .limit(q.limit).offset((q.page - 1) * q.limit),
    db.select({ total: sql<number>`COUNT(*)::int` }).from(billsTable).where(where),
  ]);
  res.json({ data: rows, page: q.page, limit: q.limit, total });
});

router.get("/bills/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!isUuid(id)) { res.status(404).json({ error: "Bill not found" }); return; }
  const [bill] = await db.select(billColumns).from(billsTable)
    .where(and(eq(billsTable.id, id), tenantWhere(billsTable.tenantId, req.tenantId)));
  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }
  /* Line items belong to the tenant-verified bill — keyed by saleId only, so
     legacy NULL-tenant lines under a real bill are never silently dropped. */
  const items = await db.select(billItemColumns).from(saleItemsTable)
    .where(eq(saleItemsTable.saleId, id))
    .orderBy(saleItemsTable.createdAt);
  res.json({ ...bill, items });
});

/* ── catch-all: unknown /api/v1 path ─────────────────────────────────── */

router.use((req, res): void => {
  res.status(404).json({ error: "Not found. See the API reference at /developers" });
});

export default router;
