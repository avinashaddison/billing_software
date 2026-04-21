import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, stockLogsTable } from "@workspace/db";
import { broadcast } from "../lib/sse";
import { sendSaleAlert } from "../lib/telegram";

const router: IRouter = Router();

type PaymentMode = "cash" | "upi";

function isValidCheckoutBody(body: unknown): body is {
  items: Array<{ productId: string; quantity: number; price: number }>;
  paymentMode: PaymentMode;
  customerPhone?: string;
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  if (b.paymentMode !== "cash" && b.paymentMode !== "upi") return false;
  if (b.customerPhone !== undefined && b.customerPhone !== "") {
    if (typeof b.customerPhone !== "string") return false;
    if (!/^\d{10}$/.test(b.customerPhone)) return false;
  }
  return b.items.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).productId === "string" &&
      typeof (item as Record<string, unknown>).quantity === "number" &&
      ((item as Record<string, unknown>).quantity as number) > 0 &&
      typeof (item as Record<string, unknown>).price === "number" &&
      ((item as Record<string, unknown>).price as number) > 0
  );
}

router.post("/bills/checkout", async (req, res): Promise<void> => {
  if (!isValidCheckoutBody(req.body)) {
    res.status(400).json({
      error: "Invalid checkout payload. Requires items[], paymentMode (cash|upi), and optional 10-digit customerPhone.",
    });
    return;
  }

  const { items, paymentMode, customerPhone } = req.body;

  try {
    const result = await db.transaction(async (tx) => {
      const processedItems: {
        productId:   string;
        productName: string;
        productSku:  string;
        quantity:    number;
        price:       number;
        subtotal:    number;
      }[] = [];

      for (const item of items) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, item.productId));

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
          productId: item.productId,
          type:      "OUT",
          quantity:  item.quantity,
          userId:    null,
        });

        processedItems.push({
          productId:   item.productId,
          productName: product.name,
          productSku:  product.sku,
          quantity:    item.quantity,
          price:       item.price,
          subtotal:    item.price * item.quantity,
        });
      }

      const totalAmount = processedItems.reduce((s, i) => s + i.subtotal, 0);
      const itemsCount  = processedItems.reduce((s, i) => s + i.quantity, 0);

      const [bill] = await tx
        .insert(billsTable)
        .values({
          totalAmount:   String(totalAmount),
          itemsCount,
          paymentMode,
          customerPhone: customerPhone || null,
        })
        .returning();

      const saleItemRows = await tx
        .insert(saleItemsTable)
        .values(
          processedItems.map((i) => ({
            saleId:    bill.id,
            productId: i.productId,
            quantity:  i.quantity,
            price:     String(i.price),
            subtotal:  String(i.subtotal),
          }))
        )
        .returning();

      return {
        bill: { ...bill, totalAmount: Number(bill.totalAmount) },
        items: processedItems,
        saleItems: saleItemRows,
      };
    });

    // Broadcast to all SSE clients (realtime)
    broadcast("bill_created", {
      billId:      result.bill.id,
      totalAmount: result.bill.totalAmount,
      itemsCount:  result.bill.itemsCount,
      paymentMode: result.bill.paymentMode,
      createdAt:   result.bill.createdAt,
    });

    // Fire-and-forget Telegram alert (never blocks the response)
    sendSaleAlert(result.bill, result.items);

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Checkout failed" });
  }
});

router.get("/bills", async (_req, res): Promise<void> => {
  const bills = await db
    .select()
    .from(billsTable)
    .orderBy(desc(billsTable.createdAt))
    .limit(50);

  res.json(bills.map((b) => ({ ...b, totalAmount: Number(b.totalAmount) })));
});

router.get("/bills/:id", async (req, res): Promise<void> => {
  const { id } = req.params;

  const [bill] = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.id, id));

  if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

  const items = await db
    .select({
      id:          saleItemsTable.id,
      productId:   saleItemsTable.productId,
      productName: productsTable.name,
      productSku:  productsTable.sku,
      quantity:    saleItemsTable.quantity,
      price:       saleItemsTable.price,
      subtotal:    saleItemsTable.subtotal,
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(eq(saleItemsTable.saleId, id));

  res.json({
    bill: { ...bill, totalAmount: Number(bill.totalAmount) },
    items: items.map((i) => ({
      ...i,
      price:    Number(i.price),
      subtotal: Number(i.subtotal),
    })),
  });
});

export default router;
