import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { tenantWhere } from "../lib/tenant";
import { sendSaleAlert, sendLowStockAlert, type LowStockAlertItem } from "../lib/telegram";

const router: IRouter = Router();

type PaymentMode = "cash" | "upi";

function isValidCheckoutBody(body: unknown): body is {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    mrp?: number;
    preDiscountPrice?: number;
    discountType?: "percent" | "amount";
    discountValue?: number;
  }>;
  paymentMode: PaymentMode;
  customerPhone?: string;
  discount?: number;
  discountType?: "percent" | "amount";
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  if (b.paymentMode !== "cash" && b.paymentMode !== "upi") return false;
  if (b.customerPhone !== undefined && b.customerPhone !== "") {
    if (typeof b.customerPhone !== "string") return false;
    if (!/^\d{10}$/.test(b.customerPhone)) return false;
  }
  if (b.discount !== undefined) {
    if (typeof b.discount !== "number" || (b.discount as number) < 0) return false;
  }
  if (b.discountType !== undefined) {
    if (b.discountType !== "percent" && b.discountType !== "amount") return false;
  }
  return b.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const it = item as Record<string, unknown>;
    if (typeof it.productId !== "string") return false;
    if (typeof it.quantity !== "number" || (it.quantity as number) <= 0) return false;
    if (typeof it.price !== "number" || (it.price as number) < 0) return false;
    if (it.mrp !== undefined && it.mrp !== null) {
      if (typeof it.mrp !== "number" || (it.mrp as number) <= 0) return false;
    }
    if (it.preDiscountPrice !== undefined && it.preDiscountPrice !== null) {
      if (typeof it.preDiscountPrice !== "number" || (it.preDiscountPrice as number) < 0) return false;
    }
    if (it.discountType !== undefined && it.discountType !== null) {
      if (it.discountType !== "percent" && it.discountType !== "amount") return false;
    }
    if (it.discountValue !== undefined && it.discountValue !== null) {
      if (typeof it.discountValue !== "number" || (it.discountValue as number) < 0) return false;
    }
    return true;
  });
}

router.post("/bills/checkout", async (req, res): Promise<void> => {
  if (!isValidCheckoutBody(req.body)) {
    res.status(400).json({
      error: "Invalid checkout payload. Requires items[], paymentMode (cash|upi), and optional 10-digit customerPhone.",
    });
    return;
  }

  const { items, paymentMode, customerPhone, discount, discountType } = req.body;
  const tenantId = req.tenantId;

  try {
    const result = await db.transaction(async (tx) => {
      const processedItems: {
        productId:        string;
        productName:      string;
        productSku:       string;
        quantity:         number;
        price:            number;
        mrp?:             number;
        preDiscountPrice?: number;
        discountType?:    "percent" | "amount";
        discountValue?:   number;
        subtotal:         number;
        newStock:         number;
        threshold:        number;
      }[] = [];

      for (const item of items) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(and(
            eq(productsTable.id, item.productId),
            tenantWhere(productsTable.tenantId, tenantId),
          ));

        if (!product) throw new Error(`Product not found: ${item.productId}`);

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}" (available: ${product.stock}, requested: ${item.quantity})`
          );
        }

        await tx
          .update(productsTable)
          .set({ stock: product.stock - item.quantity })
          .where(eq(productsTable.id, item.productId));

        await tx.insert(stockLogsTable).values({
          tenantId:  product.tenantId, // mirror the product's tenant (NULL stays NULL for legacy rows)
          productId: item.productId,
          type:      "OUT",
          quantity:  item.quantity,
          userId:    req.staffId ?? null,
        });

        processedItems.push({
          productId:        item.productId,
          productName:      product.name,
          productSku:       product.sku,
          quantity:         item.quantity,
          price:            item.price,
          mrp:              item.mrp,
          preDiscountPrice: item.preDiscountPrice,
          discountType:     item.discountType,
          discountValue:    item.discountValue,
          subtotal:         item.price * item.quantity,
          newStock:         product.stock - item.quantity,
          threshold:        product.lowStockThreshold,
        });
      }

      const subtotal   = processedItems.reduce((s, i) => s + i.subtotal, 0);
      const itemsCount = processedItems.reduce((s, i) => s + i.quantity, 0);

      let discountAmount = 0;
      if (discount && discount > 0 && discountType) {
        if (discountType === "percent") {
          discountAmount = Math.min(subtotal * discount / 100, subtotal);
        } else {
          discountAmount = Math.min(discount, subtotal);
        }
      }
      const totalAmount = subtotal - discountAmount;

      const [bill] = await tx
        .insert(billsTable)
        .values({
          tenantId,
          totalAmount:   String(totalAmount),
          itemsCount,
          paymentMode,
          customerPhone: customerPhone || null,
          discount:      discount && discount > 0 ? String(discount) : null,
          discountType:  discount && discount > 0 && discountType ? discountType : null,
        })
        .returning();

      const saleItemRows = await tx
        .insert(saleItemsTable)
        .values(
          processedItems.map((i) => ({
            tenantId:         tenantId,
            saleId:           bill.id,
            productId:        i.productId,
            quantity:         i.quantity,
            price:            String(i.price),
            mrp:              i.mrp != null ? String(i.mrp) : null,
            preDiscountPrice: i.preDiscountPrice != null ? String(i.preDiscountPrice) : null,
            discountType:     i.discountType ?? null,
            discountValue:    i.discountValue != null ? String(i.discountValue) : null,
            subtotal:         String(i.subtotal),
          }))
        )
        .returning();

      return {
        bill: { ...bill, totalAmount: Number(bill.totalAmount) },
        items: processedItems,
        saleItems: saleItemRows,
      };
    });

    // Broadcast to all SSE clients (realtime) — scoped to this tenant
    broadcast("bill_created", {
      billId:      result.bill.id,
      totalAmount: result.bill.totalAmount,
      itemsCount:  result.bill.itemsCount,
      paymentMode: result.bill.paymentMode,
      createdAt:   result.bill.createdAt,
    }, tenantId);

    // Fire-and-forget Telegram sale alert (never blocks the response)
    sendSaleAlert(result.bill, result.items);

    // Fire low-stock Telegram alerts for any product that hit or crossed its threshold
    const lowStockItems: LowStockAlertItem[] = result.items
      .filter((i) => i.newStock <= i.threshold)
      .map((i) => ({ productName: i.productName, stock: i.newStock, threshold: i.threshold }));
    sendLowStockAlert(lowStockItems);

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Checkout failed" });
  }
});

router.get("/bills", async (req, res): Promise<void> => {
  const bills = await db
    .select()
    .from(billsTable)
    .where(tenantWhere(billsTable.tenantId, req.tenantId))
    .orderBy(desc(billsTable.createdAt))
    .limit(50);

  res.json(bills.map((b) => ({
    ...b,
    totalAmount:  Number(b.totalAmount),
    discount:     b.discount != null ? Number(b.discount) : null,
    discountType: b.discountType ?? null,
  })));
});

router.get("/bills/:id", async (req, res): Promise<void> => {
  const { id } = req.params;

  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(
      eq(billsTable.id, id),
      tenantWhere(billsTable.tenantId, req.tenantId),
    ));

  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  const items = await db
    .select({
      id:               saleItemsTable.id,
      productId:        saleItemsTable.productId,
      productName:      productsTable.name,
      productSku:       productsTable.sku,
      quantity:         saleItemsTable.quantity,
      price:            saleItemsTable.price,
      mrp:              saleItemsTable.mrp,
      preDiscountPrice: saleItemsTable.preDiscountPrice,
      discountType:     saleItemsTable.discountType,
      discountValue:    saleItemsTable.discountValue,
      subtotal:         saleItemsTable.subtotal,
    })
    .from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, id));

  res.json({
    bill: {
      ...bill,
      totalAmount:  Number(bill.totalAmount),
      discount:     bill.discount != null ? Number(bill.discount) : null,
      discountType: bill.discountType ?? null,
    },
    items: items.map((i) => ({
      ...i,
      productName:      i.productName ?? "Deleted Product",
      productSku:       i.productSku  ?? "—",
      price:            Number(i.price),
      mrp:              i.mrp != null ? Number(i.mrp) : null,
      preDiscountPrice: i.preDiscountPrice != null ? Number(i.preDiscountPrice) : null,
      discountType:     i.discountType ?? null,
      discountValue:    i.discountValue != null ? Number(i.discountValue) : null,
      subtotal:         Number(i.subtotal),
    })),
  });
});

export default router;
