import { describe, it, expect } from "vitest";
import {
  round2,
  catalogueEffectivePrice,
  applyLineDiscount,
  checkLinePrice,
  isAbsurdPrice,
  isSaneNumber,
} from "./price-integrity";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const future = new Date("2026-09-01T00:00:00.000Z");
const past = new Date("2026-08-01T00:00:00.000Z");

describe("round2", () => {
  it("fixes the float drift that Postgres numeric(15,2) would silently truncate", () => {
    expect(0.1 + 0.2).not.toBe(0.3);          // the bug this exists to prevent
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);         // and rounds half up, not down
  });

  it("keeps a summed bill equal to the sum of its lines", () => {
    const lines = [10.1, 20.2, 30.3];
    expect(lines.reduce((a, b) => a + b, 0)).not.toBe(60.6);
    expect(round2(lines.reduce((a, b) => a + b, 0))).toBe(60.6);
  });

  it("leaves already-clean values alone", () => {
    expect(round2(100)).toBe(100);
    expect(round2(0)).toBe(0);
  });
});

describe("catalogueEffectivePrice", () => {
  it("uses the normal price when no sale is running", () => {
    expect(catalogueEffectivePrice({ price: "250.00", salePrice: null, salePriceUntil: null }, NOW)).toBe(250);
  });

  it("prefers an active sale price", () => {
    expect(catalogueEffectivePrice({ price: "250.00", salePrice: "199.00", salePriceUntil: future }, NOW)).toBe(199);
  });

  it("ignores an expired sale price", () => {
    expect(catalogueEffectivePrice({ price: "250.00", salePrice: "199.00", salePriceUntil: past }, NOW)).toBe(250);
  });

  it("treats a sale price with no end date as still running, exactly like routes/products.ts", () => {
    /* The catalogue clears a sale by nulling salePrice, not by dating it. If
       this disagreed with effectiveSalePrice() in products.ts, every sale of an
       open-ended discounted product would raise a warning and bury the real
       signal — which is precisely the bug this assertion exists to catch. */
    expect(catalogueEffectivePrice({ price: "250.00", salePrice: "199.00", salePriceUntil: null }, NOW)).toBe(199);
  });
});

describe("applyLineDiscount", () => {
  it("applies a percentage", () => {
    expect(applyLineDiscount(100, "percent", 10)).toBe(90);
  });

  it("applies a flat amount", () => {
    expect(applyLineDiscount(100, "amount", 15)).toBe(85);
  });

  it("never returns a negative price", () => {
    expect(applyLineDiscount(100, "amount", 250)).toBe(0);
    expect(applyLineDiscount(100, "percent", 150)).toBe(0);
  });

  it("treats a zero or missing discount as no discount", () => {
    expect(applyLineDiscount(100, null, null)).toBe(100);
    expect(applyLineDiscount(100, "percent", 0)).toBe(100);
  });
});

describe("checkLinePrice", () => {
  const product = { price: "250.00", salePrice: null, salePriceUntil: null };

  it("accepts a plain scan-and-sell at the catalogue price", () => {
    const check = checkLinePrice({ product, submittedPrice: 250, now: NOW });
    expect(check.matches).toBe(true);
    expect(check.deviation).toBe(0);
  });

  it("accepts a line the cashier discounted, when the discount is declared", () => {
    const check = checkLinePrice({
      product, submittedPrice: 225, discountType: "percent", discountValue: 10, now: NOW,
    });
    expect(check.matches).toBe(true);
    expect(check.expected).toBe(225);
  });

  it("flags a price the declared discount does not explain", () => {
    const check = checkLinePrice({ product, submittedPrice: 1, now: NOW });
    expect(check.matches).toBe(false);
    expect(check.expected).toBe(250);
    expect(check.deviation).toBeLessThan(0);   // negative == the shop lost money
  });

  it("measures the catalogue price against an active sale, so sale items do not warn", () => {
    const onSale = { price: "250.00", salePrice: "199.00", salePriceUntil: future };
    const check = checkLinePrice({ product: onSale, submittedPrice: 199, now: NOW });
    expect(check.matches).toBe(true);
  });

  it("tolerates sub-paisa float noise rather than crying wolf", () => {
    const check = checkLinePrice({ product, submittedPrice: 250.004, now: NOW });
    expect(check.matches).toBe(true);
  });

  it("accepts either basis when a sale has just expired, instead of warning on a real sale", () => {
    /* Sale ended between the scan and the tap on Charge. Both the sale price
       and the normal price are defensible, so neither may raise an alarm. */
    const justEnded = { price: "250.00", salePrice: "199.00", salePriceUntil: past };
    expect(checkLinePrice({ product: justEnded, submittedPrice: 199, now: NOW }).matches).toBe(true);
    expect(checkLinePrice({ product: justEnded, submittedPrice: 250, now: NOW }).matches).toBe(true);
  });

  it("still catches tampering on a discounted product", () => {
    const onSale = { price: "250.00", salePrice: "199.00", salePriceUntil: future };
    expect(checkLinePrice({ product: onSale, submittedPrice: 1, now: NOW }).matches).toBe(false);
  });

  it("applies the declared discount to the sale price, not just the normal price", () => {
    const onSale = { price: "250.00", salePrice: "200.00", salePriceUntil: future };
    const check = checkLinePrice({
      product: onSale, submittedPrice: 180, discountType: "percent", discountValue: 10, now: NOW,
    });
    expect(check.matches).toBe(true);
  });
});

describe("isSaneNumber", () => {
  it("rejects the values that typeof calls a number and Postgres will not", () => {
    expect(isSaneNumber(Number.NaN)).toBe(false);
    expect(isSaneNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isSaneNumber(-Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("accepts ordinary money and quantity values", () => {
    expect(isSaneNumber(0)).toBe(true);
    expect(isSaneNumber(349.99)).toBe(true);
    expect(isSaneNumber(-5)).toBe(true); // sanity only; range is the caller's job
  });

  it("rejects non-numbers, including numeric strings from a JSON body", () => {
    expect(isSaneNumber("250")).toBe(false);
    expect(isSaneNumber(null)).toBe(false);
    expect(isSaneNumber(undefined)).toBe(false);
  });
});

describe("isAbsurdPrice", () => {
  const product = { price: "250.00", salePrice: null, salePriceUntil: null };

  it("does not fire on ordinary underselling, which is most real sales", () => {
    expect(isAbsurdPrice(checkLinePrice({ product, submittedPrice: 1, now: NOW }))).toBe(false);
  });

  it("catches a misplaced decimal point", () => {
    expect(isAbsurdPrice(checkLinePrice({ product, submittedPrice: 250_000, now: NOW }))).toBe(true);
  });

  it("rejects negative and non-finite prices outright", () => {
    expect(isAbsurdPrice(checkLinePrice({ product, submittedPrice: -5, now: NOW }))).toBe(true);
    expect(isAbsurdPrice(checkLinePrice({ product, submittedPrice: Number.NaN, now: NOW }))).toBe(true);
  });

  it("stays quiet for a zero-priced catalogue item, where there is no basis to judge", () => {
    const freebie = { price: "0", salePrice: null, salePriceUntil: null };
    expect(isAbsurdPrice(checkLinePrice({ product: freebie, submittedPrice: 500, now: NOW }))).toBe(false);
  });
});
