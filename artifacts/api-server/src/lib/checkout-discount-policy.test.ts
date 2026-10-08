import { describe, expect, it } from "vitest";
import {
  hasCheckoutDiscountGrant,
  requestsExtraDiscount,
  lowersCataloguePrice,
} from "./checkout-discount-policy";
import { checkLinePrice } from "./price-integrity";

describe("checkout discount policy", () => {
  it("requires an explicit write grant for staff", () => {
    expect(hasCheckoutDiscountGrant("staff")).toBe(false);
    expect(hasCheckoutDiscountGrant("staff", "none")).toBe(false);
    expect(hasCheckoutDiscountGrant("staff", "read")).toBe(false);
    expect(hasCheckoutDiscountGrant("staff", "write")).toBe(true);
  });
  it("retains owner and email admin access", () => {
    expect(hasCheckoutDiscountGrant("owner")).toBe(true);
    expect(hasCheckoutDiscountGrant("admin")).toBe(true);
  });
  it("catches both percentage and amount bill discounts", () => {
    expect(requestsExtraDiscount({ discount: 10, items: [] })).toBe(true);
  });
  it("catches item discounts without a bill discount", () => {
    expect(requestsExtraDiscount({ items: [{ discountValue: 5 }] })).toBe(true);
  });
  it("does not require a discount grant for ordinary billing", () => {
    expect(
      requestsExtraDiscount({ discount: 0, items: [{ discountValue: 0 }, {}] }),
    ).toBe(false);
  });
  it("detects lower submitted prices even with no client discount metadata", () => {
    expect(lowersCataloguePrice(90, 100)).toBe(true);
    expect(lowersCataloguePrice(99.99, 100)).toBe(true);
  });
  it("preserves catalogue sale prices and paise rounding", () => {
    expect(lowersCataloguePrice(79.99, 79.99)).toBe(false);
    expect(lowersCataloguePrice(80, 79.99)).toBe(false);
    expect(lowersCataloguePrice(79.991, 79.99)).toBe(false);
    const actual = checkLinePrice({
      product: { price: "100", salePrice: "80", salePriceUntil: null },
      submittedPrice: 80,
      discountType: null,
      discountValue: null,
    });
    expect(lowersCataloguePrice(actual.submitted, actual.cataloguePrice)).toBe(
      false,
    );
  });
});
