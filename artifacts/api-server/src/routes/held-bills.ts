import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, heldBillsTable } from "@workspace/db";
import { tenantWhereWrite } from "../lib/tenant";
import { broadcast } from "../lib/sse";
import { requireWrite } from "../middlewares/auth";
import * as sharedCart from "../lib/shared-cart";
import { summarizeHeldBillItems } from "../lib/held-bills";

const router: IRouter = Router();

const createSchema = z.object({
  customerName: z.string().trim().max(80).optional(),
  note: z.string().trim().max(200).optional(),
  expectedRevision: z.number().int().min(0),
}).strict();

const resumeSchema = z.object({
  expectedRevision: z.number().int().min(0),
}).strict();

function serializeHeldBill(row: typeof heldBillsTable.$inferSelect) {
  return {
    ...row,
    ...summarizeHeldBillItems(row.items),
  };
}

router.get("/held-bills", async (req, res) => {
  const rows = await db
    .select()
    .from(heldBillsTable)
    .where(tenantWhereWrite(heldBillsTable.tenantId, req.tenantId))
    .orderBy(desc(heldBillsTable.createdAt))
    .limit(100);

  res.json({ heldBills: rows.map(serializeHeldBill) });
});

router.post("/held-bills", requireWrite("scan"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid held bill", details: parsed.error.flatten() });
    return;
  }

  const result = await sharedCart.holdActiveCart(
    req.tenantId,
    parsed.data.expectedRevision,
    {
      customerName: parsed.data.customerName,
      note: parsed.data.note,
    },
  );

  if (result.kind === "conflict") {
    res.status(409).json({
      error: "Cart changed on another device. The latest cart has been loaded; try again.",
      cart: result.cart,
    });
    return;
  }
  if (result.kind === "empty") {
    res.status(400).json({ error: "The active cart is empty" });
    return;
  }

  broadcast("cart_updated", result.summary, req.tenantId, true);
  broadcast("held_bills_updated", { action: "created" }, req.tenantId, true);
  res.status(201).json({
    heldBill: serializeHeldBill(result.row),
    revision: result.summary.revision,
  });
});

router.post("/held-bills/:id/resume", requireWrite("scan"), async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const body = resumeSchema.safeParse(req.body);
  if (!id.success || !body.success) {
    res.status(400).json({ error: "Invalid resume request" });
    return;
  }

  const result = await sharedCart.resumeHeldBill(
    req.tenantId,
    id.data,
    body.data.expectedRevision,
  );

  if (result.kind === "conflict") {
    res.status(409).json({
      error: "Cart changed on another device. The latest cart has been loaded; try again.",
      cart: result.cart,
    });
    return;
  }
  if (result.kind === "missing") {
    res.status(404).json({ error: "Held bill not found" });
    return;
  }

  broadcast("cart_updated", result.summary, req.tenantId, true);
  broadcast("held_bills_updated", { action: "resumed" }, req.tenantId, true);
  res.json({
    heldBill: serializeHeldBill(result.selected),
    items: result.selected.items,
    revision: result.summary.revision,
  });
});

router.delete("/held-bills/:id", requireWrite("scan"), async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Invalid held bill id" });
    return;
  }

  const [deleted] = await db
    .delete(heldBillsTable)
    .where(and(
      eq(heldBillsTable.id, id.data),
      tenantWhereWrite(heldBillsTable.tenantId, req.tenantId),
    ))
    .returning({ id: heldBillsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Held bill not found" });
    return;
  }

  broadcast("held_bills_updated", { action: "discarded" }, req.tenantId, true);
  res.status(204).end();
});

export default router;