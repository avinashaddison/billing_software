/**
 * Price integrity for checkout.
 *
 * ── The problem ────────────────────────────────────────────────────────────
 * `/bills/checkout` used to record whatever per-unit price the browser sent,
 * and derive the bill total from it, without ever consulting the product's
 * real price. Anyone able to call the API — a cashier with dev tools open, or
 * someone holding a stolen session cookie — could bill a ₹500 item at ₹1. Every
 * revenue and profit report is built from those saved rows, so the shop's
 * numbers could be wrong with nothing to reveal it.
 *
 * ── Two different questions ────────────────────────────────────────────────
 * "Does this price match the catalogue?" and "could any honest discount
 * explain this price?" are not the same question, and they need different
 * answers.
 *
 * The first has to stay a warning. Measured over 60 days of real sales, 961 of
 * 969 catalogue lines match the catalogue once BOTH the sale price and the
 * declared discount are taken into account — but the remainder are ordinary
 * trading: a cashier knocking ₹25 off, a price edited after the sale, an
 * 8-hour-old cart. Rejecting those would refuse genuine sales at the counter.
 *
 * The second can be enforced, and is. No honest sale gives away almost the
 * whole value of an item, so any line discounted past a ceiling is refused.
 * Over those same 969 lines the deepest real discount was 50.5%, and nothing
 * came within 20 points of the 70% default — so this blocks tampering without
 * touching a single real sale. Tune with PRICE_GUARD_MAX_DISCOUNT_PCT.
 *
 * ── Why the ceiling ignores the declared discount ──────────────────────────
 * This is the crux. A guard that trusts the client's declared discount is not
 * a guard at all: whoever can send `price: 1` can just as easily send
 * `discountValue: 99.8` alongside it, and the line "matches" perfectly. So the
 * ceiling is measured against the catalogue price alone, treating the total
 * gap as the discount whether it was declared or not. It is the one part of
 * this that a crafted payload cannot argue its way around.
 *
 * ── What this guarantees, stated plainly ───────────────────────────────────
 * A ₹500 toy can no longer be billed at ₹1, by anyone, in any mode except
 * "off". Smaller unexplained discounts are still recorded as submitted and
 * raise a warning naming the staff member, product and amount — detection, not
 * prevention, because at that size refusing the sale is the worse outcome.
 */

export type PriceGuardMode = "off" | "warn" | "strict";

export function priceGuardMode(): PriceGuardMode {
  const raw = process.env["PRICE_GUARD_MODE"]?.trim().toLowerCase();
  if (raw === "off" || raw === "strict") return raw;
  return "warn";
}

/** Default ceiling, in percent off the catalogue price. */
export const DEFAULT_MAX_DISCOUNT_PCT = 70;

/**
 * How deep a discount a single line may carry before checkout refuses it.
 *
 * Read per call rather than cached so a shop running a genuine clearance can
 * raise it and have the counter working again immediately, without a redeploy.
 * Values outside 1–100 are ignored in favour of the default: a stray `0` in the
 * environment would otherwise refuse every discounted sale in the shop.
 */
export function maxDiscountPct(): number {
  const raw = Number(process.env["PRICE_GUARD_MAX_DISCOUNT_PCT"]);
  if (!Number.isFinite(raw) || raw <= 0 || raw > 100) return DEFAULT_MAX_DISCOUNT_PCT;
  return raw;
}

/**
 * Round to 2 decimal places (paise).
 *
 * Money is stored as numeric(15,2) in Postgres, but it travels through JS as a
 * double: `349.99 * 7` is 2449.9300000000003 and `10.1 + 20.2 + 30.3` is
 * 60.599999999999994. Postgres silently truncates the excess on write, so an
 * unrounded total can end up disagreeing with the sum of its own lines.
 * Rounding at every money boundary keeps JS and the database in agreement.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** A product, as far as pricing is concerned. */
export interface PricedProduct {
  price: string | number;
  salePrice: string | number | null;
  salePriceUntil: Date | null;
}

/**
 * The price the catalogue says this product sells for right now.
 *
 * Deliberately mirrors `effectiveSalePrice()` in routes/products.ts, which
 * treats ANY non-null sale price as live: a sale price with no end date is a
 * sale that has not been switched off, not an expired one. Getting this wrong
 * in either direction produces a warning on every sale of a discounted product,
 * which would bury the real signal.
 *
 * The one place this is stricter: a sale price whose end date has already
 * passed is treated as over.
 */
export function catalogueEffectivePrice(product: PricedProduct, now: Date = new Date()): number {
  const base = round2(Number.isFinite(Number(product.price)) ? Number(product.price) : 0);
  const sale = product.salePrice != null ? Number(product.salePrice) : null;
  const until = product.salePriceUntil;
  const expired = until instanceof Date && until.getTime() <= now.getTime();
  if (sale != null && Number.isFinite(sale) && sale >= 0 && !expired) return round2(sale);
  return base;
}

/**
 * Every price the catalogue could plausibly be quoting for this product.
 *
 * A line is only worth warning about if it matches NONE of these. Including
 * both the normal and the sale price means the guard stays quiet across the
 * genuinely ambiguous cases — a sale that ended between scan and checkout, a
 * client that priced from the base while the server sees a sale — instead of
 * crying wolf on ordinary trading. Tampering (₹1 for a ₹500 toy) still matches
 * nothing and is reported.
 */
function catalogueBases(product: PricedProduct, now: Date): number[] {
  const bases = [catalogueEffectivePrice(product, now)];
  const plain = round2(Number.isFinite(Number(product.price)) ? Number(product.price) : 0);
  if (!bases.includes(plain)) bases.push(plain);
  const sale = product.salePrice != null ? Number(product.salePrice) : null;
  if (sale != null && Number.isFinite(sale) && sale >= 0 && !bases.includes(round2(sale))) {
    bases.push(round2(sale));
  }
  return bases;
}

/**
 * Apply a declared per-line discount to a base price.
 *
 * Deliberately mirrors `effectivePrice()` in the client cart context. If the
 * two ever drift apart, every sale would raise a spurious warning — which is
 * the intended alarm, not a bug.
 */
export function applyLineDiscount(
  base: number,
  discountType: "percent" | "amount" | null | undefined,
  discountValue: number | null | undefined,
): number {
  const value = discountValue ?? 0;
  if (!(value > 0)) return round2(base);
  if (discountType === "amount") return round2(Math.max(0, base - value));
  if (value >= 100) return 0;
  return round2(Math.max(0, base * (1 - value / 100)));
}

export interface LinePriceCheck {
  /** What the server believes this line should cost per unit. */
  expected: number;
  /** What the client asked to charge. */
  submitted: number;
  /** True when submitted matches expected within a paisa. */
  matches: boolean;
  /**
   * Signed deviation as a fraction of the catalogue price. Negative means the
   * item was sold cheaper than the catalogue says — the direction that costs
   * the shop money, and the one worth alerting on.
   */
  deviation: number;
  /** Catalogue price used as the basis, before any declared line discount. */
  cataloguePrice: number;
  /**
   * Cheapest price the catalogue could plausibly be quoting, before discounts.
   * The ceiling is measured against this so a product on sale is judged against
   * its sale price, not the higher list price it is no longer sold at.
   */
  bestBasis: number;
  /**
   * Total discount on this line as a percentage of `bestBasis`, counting the
   * declared discount and any further unexplained drop as one number. Negative
   * when the line sold above catalogue.
   */
  impliedDiscountPct: number;
}

/** Compare a submitted line price against what the catalogue + declared discount imply. */
export function checkLinePrice(args: {
  product: PricedProduct;
  submittedPrice: number;
  discountType?: "percent" | "amount" | null;
  discountValue?: number | null;
  now?: Date;
}): LinePriceCheck {
  const now = args.now ?? new Date();
  const cataloguePrice = catalogueEffectivePrice(args.product, now);
  const expected = applyLineDiscount(cataloguePrice, args.discountType, args.discountValue);
  const submitted = round2(args.submittedPrice);
  /* Match against every plausible catalogue basis, not just the primary one,
     so ordinary sale-price ambiguity never raises a false alarm. */
  const matches = Number.isFinite(submitted) && catalogueBases(args.product, now).some(
    (base) => Math.abs(submitted - applyLineDiscount(base, args.discountType, args.discountValue)) < 0.011,
  );
  const deviation = cataloguePrice > 0 ? (submitted - cataloguePrice) / cataloguePrice : 0;
  const positiveBases = catalogueBases(args.product, now).filter((b) => b > 0);
  const bestBasis = positiveBases.length > 0 ? Math.min(...positiveBases) : 0;
  const impliedDiscountPct =
    bestBasis > 0 && Number.isFinite(submitted) ? (1 - submitted / bestBasis) * 100 : 0;
  return { expected, submitted, matches, deviation, cataloguePrice, bestBasis, impliedDiscountPct };
}

/**
 * True when a line gives away more of the item's value than any honest sale
 * would — the tampering and fat-finger case.
 *
 * Deliberately does NOT exempt lines that "match" a declared discount; see the
 * note at the top of this file. A product with no usable catalogue price is
 * exempt, because there is nothing to measure the discount against.
 */
export function exceedsDiscountCeiling(check: LinePriceCheck, maxPct: number = maxDiscountPct()): boolean {
  if (check.bestBasis <= 0) return false;
  if (!Number.isFinite(check.submitted)) return true;
  return check.impliedDiscountPct > maxPct + 1e-9;
}

export interface BillDiscountCheck {
  /** What the shop actually receives for the catalogue-priced lines. */
  guardedTotal: number;
  /** What the catalogue says those same lines are worth. */
  catalogueBasisTotal: number;
  /** How far below catalogue the bill lands, in percent. */
  offPct: number;
  /** True when the bill as a whole is discounted past the ceiling. */
  blocked: boolean;
}

/**
 * Hold the WHOLE BILL to the same ceiling as its individual lines.
 *
 * The per-line ceiling has an obvious way around it: send every line at its
 * honest catalogue price, then discount the entire bill by 100%. The total is
 * zero, no single line ever looked wrong, and a line-only guard waves it
 * through. This closes that route.
 *
 * Manual lines (no catalogue product) are excluded from both sides rather than
 * counted as free, since there is no listed price to judge them against — the
 * bill discount is apportioned so only the catalogue-backed share is measured.
 */
export function checkBillDiscount(args: {
  /** Catalogue value of the priced lines, before any discount. */
  catalogueBasisTotal: number;
  /** Submitted value of those same lines, before the bill discount. */
  guardedSubtotal: number;
  /** Submitted value of the entire bill, including manual lines. */
  subtotal: number;
  /** Bill-level discount in rupees, already clamped to the subtotal. */
  discountAmount: number;
  maxPct?: number;
}): BillDiscountCheck {
  const maxPct = args.maxPct ?? maxDiscountPct();
  const { catalogueBasisTotal, guardedSubtotal, subtotal, discountAmount } = args;

  if (!isSaneNumber(catalogueBasisTotal) || catalogueBasisTotal <= 0) {
    return { guardedTotal: 0, catalogueBasisTotal: 0, offPct: 0, blocked: false };
  }
  if (!isSaneNumber(guardedSubtotal) || !isSaneNumber(subtotal) || !isSaneNumber(discountAmount)) {
    return { guardedTotal: 0, catalogueBasisTotal, offPct: 100, blocked: true };
  }

  const guardedShare = subtotal > 0 ? guardedSubtotal / subtotal : 0;
  const guardedTotal = guardedSubtotal - discountAmount * guardedShare;
  const offPct       = (1 - guardedTotal / catalogueBasisTotal) * 100;
  const floor        = catalogueBasisTotal * (1 - maxPct / 100);

  return {
    guardedTotal,
    catalogueBasisTotal,
    offPct,
    /* A paisa of slack so float noise on a bill that sits exactly on the
       ceiling cannot refuse a sale. */
    blocked: guardedTotal < floor - 0.011,
  };
}

/**
 * An absurd price that no discount or stale cart can explain — a fat-fingered
 * entry or a tampered payload. Blocked in every mode including "off", because
 * accepting it corrupts the shop's revenue figures outright.
 *
 * The ceiling is deliberately enormous (100x catalogue) so it can never fire on
 * a real sale; it exists to catch a misplaced decimal point, not to police
 * pricing.
 */
export function isAbsurdPrice(check: LinePriceCheck): boolean {
  if (!Number.isFinite(check.submitted) || check.submitted < 0) return true;
  if (check.cataloguePrice <= 0) return false;
  return check.submitted > check.cataloguePrice * 100;
}

/**
 * Guard for any number that is about to become money or a quantity in the
 * database. `typeof x === "number"` is true for NaN and Infinity, both of which
 * survive validation and reach a numeric(15,2) column as a corrupt row or a
 * transaction-aborting error mid-sale.
 */
export function isSaneNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
