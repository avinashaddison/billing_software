import { describe, expect, it } from "vitest";
import {
  heldBillItemsSchema,
  summarizeHeldBillItems,
} from "./held-bills";
import { MAX_MANUAL_COST } from "./price-integrity";

describe("held bill snapshots", () => {
  it("preserves manual lines and both line-discount modes", () => {
    const items = heldBillItemsSchema.parse([
      {
        productId: "11111111-1111-4111-8111-111111111111",
        sku: "WATCH-1",
        name: "Watch",
        quantity: 2,
        price: 500,
        discountType: "percent",
        discountPercent: 10,
      },
      {
        productId: "22222222-2222-4222-8222-222222222222",
        sku: "TOY-1",
        name: "Toy",
        quantity: 1,
        price: 250,
        discountType: "amount",
        discountAmount: 50,
      },
      {
        productId: "manual-33333333-3333-4333-8333-333333333333",
        sku: "—",
        name: "Gift wrap",
        quantity: 1,
        price: 25,
        isManual: true,
        purchasePrice: 10.5,
      },
    ]);

    expect(summarizeHeldBillItems(items)).toEqual({
      itemCount: 4,
      total: 1125,
    });
    // The typed cost must survive the hold/resume and shared-cart round trip,
    // otherwise checkout would bill the line with no cost and it would fall
    // out of the profit reports.
    expect(items[2]).toMatchObject({ name: "Gift wrap", isManual: true, purchasePrice: 10.5 });
  });

  it("refuses a negative or non-finite manual cost", () => {
    const base = {
      productId: "manual-1",
      sku: "—",
      name: "Gift wrap",
      quantity: 1,
      price: 25,
      isManual: true,
    };
    expect(heldBillItemsSchema.safeParse([{ ...base, purchasePrice: -1 }]).success).toBe(false);
    expect(heldBillItemsSchema.safeParse([{ ...base, purchasePrice: Number.NaN }]).success).toBe(false);
    expect(heldBillItemsSchema.safeParse([{ ...base, purchasePrice: 0 }]).success).toBe(true);
  });

  it("caps a manual cost at the same ceiling as checkout", () => {
    const base = { productId: "manual-1", sku: "—", name: "Gift wrap", quantity: 1, price: 25, isManual: true };
    expect(heldBillItemsSchema.safeParse([{ ...base, purchasePrice: MAX_MANUAL_COST }]).success).toBe(true);
    expect(heldBillItemsSchema.safeParse([{ ...base, purchasePrice: MAX_MANUAL_COST + 0.01 }]).success).toBe(false);
  });

  it("refuses empty carts and malformed quantities", () => {
    expect(heldBillItemsSchema.safeParse([]).success).toBe(false);
    expect(heldBillItemsSchema.safeParse([{
      productId: "product",
      sku: "SKU",
      name: "Product",
      quantity: 0,
      price: 10,
    }]).success).toBe(false);
  });

  it("never lets a discount make a held total negative", () => {
    const items = heldBillItemsSchema.parse([{
      productId: "product",
      sku: "SKU",
      name: "Product",
      quantity: 2,
      price: 10,
      discountType: "amount",
      discountAmount: 50,
    }]);

    expect(summarizeHeldBillItems(items).total).toBe(0);
  });
});