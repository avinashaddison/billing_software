import { Router, type IRouter } from "express";
import { broadcast } from "../lib/sse";
import * as sharedCart from "../lib/shared-cart";

const router = Router();

/* GET /api/shared-cart — return current cart */
router.get("/shared-cart", (req, res) => {
  res.json(sharedCart.getCartSummary(req.tenantId));
});

/* POST /api/shared-cart/add — add / increment one item */
router.post("/shared-cart/add", (req, res) => {
  const { productId, name, sku, price, mrp } = req.body as Record<string, unknown>;
  if (
    typeof productId !== "string" ||
    typeof name !== "string" ||
    typeof sku !== "string" ||
    typeof price !== "number"
  ) {
    res.status(400).json({ error: "Invalid item data" });
    return;
  }
  const summary = sharedCart.addOrIncrement(
    { productId, name, sku, price, mrp: typeof mrp === "number" ? mrp : undefined },
    req.tenantId,
  );
  broadcast("cart_updated", summary, req.tenantId);
  res.json(summary);
});

/* PATCH /api/shared-cart/:productId — set quantity */
router.patch("/shared-cart/:productId", (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body as Record<string, unknown>;
  if (typeof quantity !== "number") {
    res.status(400).json({ error: "quantity must be a number" });
    return;
  }
  const summary = sharedCart.setQty(productId, quantity, req.tenantId);
  broadcast("cart_updated", summary, req.tenantId);
  res.json(summary);
});

/* DELETE /api/shared-cart/:productId — remove one item */
router.delete("/shared-cart/:productId", (req, res) => {
  const summary = sharedCart.removeItem(req.params.productId, req.tenantId);
  broadcast("cart_updated", summary, req.tenantId);
  res.json(summary);
});

/* DELETE /api/shared-cart — clear entire cart */
router.delete("/shared-cart", (req, res) => {
  const summary = sharedCart.clearCart(req.tenantId);
  broadcast("cart_updated", summary, req.tenantId);
  res.json(summary);
});

/* PUT /api/shared-cart — replace entire cart */
router.put("/shared-cart", (req, res) => {
  const { items } = req.body as { items?: sharedCart.SharedCartItem[] };
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "items must be an array" });
    return;
  }
  const summary = sharedCart.replaceCart(items, req.tenantId);
  broadcast("cart_updated", summary, req.tenantId);
  res.json(summary);
});

export default router;
