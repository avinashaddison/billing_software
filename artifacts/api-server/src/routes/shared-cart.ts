import { Router } from "express";
import { z } from "zod";
import { broadcast } from "../lib/sse";
import { heldBillItemSchema, optionalHeldBillItemsSchema } from "../lib/held-bills";
import { requireWrite } from "../middlewares/auth";
import * as sharedCart from "../lib/shared-cart";

const router = Router();
const expectedRevisionSchema = z.number().int().min(0);

function conflictResponse(cart: sharedCart.CartSummary) {
  return {
    error: "Cart changed on another device. The latest cart has been loaded; try again.",
    cart,
  };
}

router.get("/shared-cart", async (req, res) => {
  res.json(await sharedCart.getCartSummary(req.tenantId));
});

router.post("/shared-cart/add", requireWrite("scan"), async (req, res) => {
  const parsed = heldBillItemSchema.extend({
    quantity: z.number().int().min(1).max(1_000_000).optional(),
    expectedRevision: expectedRevisionSchema,
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid item data" });
    return;
  }

  const result = await sharedCart.withCartLock(req.tenantId, async (cart) => {
    const { expectedRevision, quantity = 1, ...item } = parsed.data;
    if (!cart.revisionMatches(expectedRevision)) {
      return { conflict: cart.getSummary() };
    }
    return { summary: await cart.addOrIncrement(item, quantity) };
  });
  if (result.conflict) {
    res.status(409).json(conflictResponse(result.conflict));
    return;
  }
  broadcast("cart_updated", result.summary, req.tenantId, true);
  res.json(result.summary);
});

router.patch("/shared-cart/:productId", requireWrite("scan"), async (req, res) => {
  const productId = typeof req.params.productId === "string" ? req.params.productId : null;
  const parsed = z.object({
    quantity: z.number().int().min(0).max(1_000_000).optional(),
    discountType: z.enum(["percent", "amount"]).optional(),
    discountPercent: z.number().finite().min(0).max(100).optional(),
    discountAmount: z.number().finite().min(0).max(1_000_000_000).optional(),
    expectedRevision: expectedRevisionSchema,
  }).strict().refine(
    (value) => value.quantity !== undefined || value.discountType !== undefined,
    "An item update is required",
  ).safeParse(req.body);
  if (!productId || !parsed.success) {
    res.status(400).json({ error: "Invalid item update" });
    return;
  }

  const result = await sharedCart.withCartLock(req.tenantId, async (cart) => {
    const { expectedRevision, ...patch } = parsed.data;
    if (!cart.revisionMatches(expectedRevision)) {
      return { conflict: cart.getSummary() };
    }
    return { summary: await cart.updateItem(productId, patch) };
  });
  if (result.conflict) {
    res.status(409).json(conflictResponse(result.conflict));
    return;
  }
  broadcast("cart_updated", result.summary, req.tenantId, true);
  res.json(result.summary);
});

router.delete("/shared-cart/:productId", requireWrite("scan"), async (req, res) => {
  const productId = typeof req.params.productId === "string" ? req.params.productId : null;
  const parsed = z.object({ expectedRevision: expectedRevisionSchema }).strict()
    .safeParse(req.body ?? {});
  if (!productId || !parsed.success) {
    res.status(400).json({ error: "A valid cart revision is required" });
    return;
  }

  const result = await sharedCart.withCartLock(req.tenantId, async (cart) => {
    if (!cart.revisionMatches(parsed.data.expectedRevision)) {
      return { conflict: cart.getSummary() };
    }
    return { summary: await cart.removeItem(productId) };
  });
  if (result.conflict) {
    res.status(409).json(conflictResponse(result.conflict));
    return;
  }
  broadcast("cart_updated", result.summary, req.tenantId, true);
  res.json(result.summary);
});

router.delete("/shared-cart", requireWrite("scan"), async (req, res) => {
  const parsed = z.object({ expectedRevision: expectedRevisionSchema }).strict()
    .safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "A valid cart revision is required" });
    return;
  }

  const result = await sharedCart.withCartLock(req.tenantId, async (cart) => {
    if (!cart.revisionMatches(parsed.data.expectedRevision)) {
      return { conflict: cart.getSummary() };
    }
    return { summary: await cart.clear() };
  });
  if (result.conflict) {
    res.status(409).json(conflictResponse(result.conflict));
    return;
  }
  broadcast("cart_updated", result.summary, req.tenantId, true);
  res.json(result.summary);
});

router.put("/shared-cart", requireWrite("scan"), async (req, res) => {
  const parsed = z.object({
    items: optionalHeldBillItemsSchema,
    expectedRevision: expectedRevisionSchema,
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cart snapshot or revision" });
    return;
  }

  const result = await sharedCart.withCartLock(req.tenantId, async (cart) => {
    if (!cart.revisionMatches(parsed.data.expectedRevision)) {
      return { conflict: cart.getSummary() };
    }
    return { summary: await cart.replace(parsed.data.items) };
  });
  if (result.conflict) {
    res.status(409).json(conflictResponse(result.conflict));
    return;
  }
  broadcast("cart_updated", result.summary, req.tenantId, true);
  res.json(result.summary);
});

export default router;