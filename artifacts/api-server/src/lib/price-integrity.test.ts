import { describe, it, expect, afterEach } from "vitest";
import {
  round2,
  catalogueEffectivePrice,
  applyLineDiscount,
  checkLinePrice,
  isAbsurdPrice,
  isSaneNumber,
  exceedsDiscountCeiling,
  checkBillDiscount,
  maxDiscountPct,
  DEFAULT_MAX_DISCOUNT_PCT,
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

describe("maxDiscountPct", () => {
  const KEY = "PRICE_GUARD_MAX_DISCOUNT_PCT";
  const original = process.env[KEY];
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it("defaults when unset", () => {
    delete process.env[KEY];
    expect(maxDiscountPct()).toBe(DEFAULT_MAX_DISCOUNT_PCT);
  });

  it("honours a shop running a genuine deep clearance", () => {
    process.env[KEY] = "90";
    expect(maxDiscountPct()).toBe(90);
  });

  it("ignores values that would refuse every discounted sale in the shop", () => {
    for (const bad of ["0", "-10", "abc", "", "1000"]) {
      process.env[KEY] = bad;
      expect(maxDiscountPct()).toBe(DEFAULT_MAX_DISCOUNT_PCT);
    }
  });
});

describe("exceedsDiscountCeiling", () => {
  const product = { price: "500.00", salePrice: null, salePriceUntil: null };

  it("refuses the attack this exists for: a ₹500 toy billed at ₹1", () => {
    expect(exceedsDiscountCeiling(checkLinePrice({ product, submittedPrice: 1, now: NOW }))).toBe(true);
  });

  it("cannot be talked around by ALSO declaring the discount", () => {
    /* The crux. A crafted payload can claim any discount it likes, so a guard
       that trusts the declared discount would wave this straight through. */
    const check = checkLinePrice({
      product, submittedPrice: 1, discountType: "percent", discountValue: 99.8, now: NOW,
    });
    expect(check.matches).toBe(true);            // the declared discount "explains" it
    expect(exceedsDiscountCeiling(check)).toBe(true);  // and it is refused anyway
  });

  it("lets through the deepest discount seen in 60 days of real sales (50.5%)", () => {
    const keyring = { price: "150.00", salePrice: "99.00", salePriceUntil: null };
    const check = checkLinePrice({ product: keyring, submittedPrice: 49, now: NOW });
    expect(Math.round(check.impliedDiscountPct * 10) / 10).toBe(50.5);
    expect(exceedsDiscountCeiling(check)).toBe(false);
  });

  it("leaves ordinary trading alone", () => {
    for (const price of [500, 475, 425, 250, 151]) {
      expect(exceedsDiscountCeiling(checkLinePrice({ product, submittedPrice: price, now: NOW }))).toBe(false);
    }
  });

  it("judges a product on sale against its sale price, not the list price it no longer sells at", () => {
    const onSale = { price: "1000.00", salePrice: "200.00", salePriceUntil: future };
    /* ₹100 is 90% off the list price but only 50% off the price actually being
       charged — the shop is not being robbed, so it must go through. */
    expect(exceedsDiscountCeiling(checkLinePrice({ product: onSale, submittedPrice: 100, now: NOW }))).toBe(false);
    expect(exceedsDiscountCeiling(checkLinePrice({ product: onSale, submittedPrice: 20, now: NOW }))).toBe(true);
  });

  it("respects a raised ceiling", () => {
    const check = checkLinePrice({ product, submittedPrice: 75, now: NOW });  // 85% off
    expect(exceedsDiscountCeiling(check, 70)).toBe(true);
    expect(exceedsDiscountCeiling(check, 90)).toBe(false);
  });

  it("sits exactly on the boundary without firing", () => {
    const check = checkLinePrice({ product, submittedPrice: 150, now: NOW });  // exactly 70% off
    expect(check.impliedDiscountPct).toBeCloseTo(70, 9);
    expect(exceedsDiscountCeiling(check, 70)).toBe(false);
  });

  it("exempts a product with no catalogue price, where there is nothing to measure against", () => {
    const freebie = { price: "0", salePrice: null, salePriceUntil: null };
    expect(exceedsDiscountCeiling(checkLinePrice({ product: freebie, submittedPrice: 0, now: NOW }))).toBe(false);
  });

  it("never lets a non-finite price through", () => {
    expect(exceedsDiscountCeiling(checkLinePrice({ product, submittedPrice: Number.NaN, now: NOW }))).toBe(true);
  });

  it("does not fire on a line sold ABOVE catalogue, which costs the shop nothing", () => {
    expect(exceedsDiscountCeiling(checkLinePrice({ product, submittedPrice: 600, now: NOW }))).toBe(false);
  });

  it("keeps the ceiling clear of a stale-cart price drop", () => {
    /* Yesterday's price still in an 8-hour-old cart, today's catalogue lower:
       a mismatch worth warning about, never worth refusing the sale over. */
    const cheaperNow = { price: "300.00", salePrice: null, salePriceUntil: null };
    const check = checkLinePrice({ product: cheaperNow, submittedPrice: 280, now: NOW });
    expect(check.matches).toBe(false);
    expect(exceedsDiscountCeiling(check)).toBe(false);
  });
});

describe("checkBillDiscount", () => {
  /* A ₹1000 bill of catalogue-priced goods, sold at catalogue price. */
  const honest = { catalogueBasisTotal: 1000, guardedSubtotal: 1000, subtotal: 1000 };

  it("closes the way around the line ceiling: honest lines, 100% off the bill", () => {
    /* Every line passes its own check, then the whole bill is discounted to
       zero. This is the bypass the per-line guard cannot see. */
    const check = checkBillDiscount({ ...honest, discountAmount: 1000 });
    expect(check.blocked).toBe(true);
    expect(Math.round(check.offPct)).toBe(100);
    expect(check.guardedTotal).toBe(0);
  });

  it("leaves an ordinary bill discount alone", () => {
    for (const discountAmount of [0, 50, 100, 250]) {
      expect(checkBillDiscount({ ...honest, discountAmount }).blocked).toBe(false);
    }
  });

  it("catches a line discount and a bill discount that only breach the ceiling together", () => {
    /* Lines already 50% off (each fine on its own), then 50% off the bill:
       75% in total, past the ceiling. Neither guard alone would notice. */
    const check = checkBillDiscount({
      catalogueBasisTotal: 1000, guardedSubtotal: 500, subtotal: 500, discountAmount: 250,
    });
    expect(Math.round(check.offPct)).toBe(75);
    expect(check.blocked).toBe(true);
  });

  it("sits exactly on the ceiling without refusing the sale", () => {
    const check = checkBillDiscount({ ...honest, discountAmount: 700, maxPct: 70 });
    expect(check.offPct).toBeCloseTo(70, 9);
    expect(check.blocked).toBe(false);
  });

  it("ignores a bill with nothing priceable, instead of calling it 100% off", () => {
    /* All manual lines — no catalogue price exists to judge them against. */
    const check = checkBillDiscount({
      catalogueBasisTotal: 0, guardedSubtotal: 0, subtotal: 400, discountAmount: 400,
    });
    expect(check.blocked).toBe(false);
  });

  it("does not treat a manual line as a free giveaway on the catalogue lines", () => {
    /* ₹1000 of catalogue goods + a ₹1000 manual line, ₹200 off the bill. The
       discount is shared, so the catalogue half is only 10% down — fine. */
    const check = checkBillDiscount({
      catalogueBasisTotal: 1000, guardedSubtotal: 1000, subtotal: 2000, discountAmount: 200,
    });
    expect(check.guardedTotal).toBe(900);
    expect(check.blocked).toBe(false);
  });

  it("still catches a deep discount hidden behind a large manual line", () => {
    const check = checkBillDiscount({
      catalogueBasisTotal: 1000, guardedSubtotal: 1000, subtotal: 2000, discountAmount: 1900,
    });
    expect(check.blocked).toBe(true);
  });

  it("respects a raised ceiling", () => {
    const args = { ...honest, discountAmount: 850 };   // 85% off
    expect(checkBillDiscount({ ...args, maxPct: 70 }).blocked).toBe(true);
    expect(checkBillDiscount({ ...args, maxPct: 90 }).blocked).toBe(false);
  });

  it("refuses rather than trusts a non-finite figure", () => {
    expect(checkBillDiscount({ ...honest, discountAmount: Number.NaN }).blocked).toBe(true);
    expect(checkBillDiscount({ ...honest, subtotal: Number.POSITIVE_INFINITY, discountAmount: 0 }).blocked).toBe(true);
  });
});
