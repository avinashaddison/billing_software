import { z } from "zod";
import type { HeldBillItem } from "@workspace/db";

export const heldBillItemSchema = z.object({
  productId:       z.string().trim().min(1).max(150),
  sku:             z.string().max(150),
  name:            z.string().trim().min(1).max(200),
  quantity:        z.number().int().min(1).max(1_000_000),
  price:           z.number().finite().min(0).max(1_000_000_000),
  mrp:             z.number().finite().min(0).max(1_000_000_000).optional(),
  discountPercent: z.number().finite().min(0).max(100).optional(),
  discountAmount:  z.number().finite().min(0).max(1_000_000_000).optional(),
  discountType:    z.enum(["percent", "amount"]).optional(),
  isManual:        z.boolean().optional(),
}).strict();

export const heldBillItemsSchema = z.array(heldBillItemSchema).min(1).max(250);
export const optionalHeldBillItemsSchema = z.array(heldBillItemSchema).max(250).default([]);

export function effectiveHeldBillItemPrice(item: HeldBillItem): number {
  if (item.discountType === "amount") {
    return Math.max(0, item.price - (item.discountAmount ?? 0));
  }
  return Math.max(0, item.price * (1 - (item.discountPercent ?? 0) / 100));
}

export function summarizeHeldBillItems(items: HeldBillItem[]) {
  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce(
      (sum, item) => sum + effectiveHeldBillItemPrice(item) * item.quantity,
      0,
    ),
  };
}
