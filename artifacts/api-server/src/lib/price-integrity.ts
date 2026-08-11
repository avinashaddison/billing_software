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
 * ── Why this does NOT hard-reject by default ───────────────────────────────
 * Measured against live data, 87% of recent sale lines sit BELOW the product's
 * current catalogue price. That is expected and legitimate:
 *   - cashiers apply per-line discounts as a normal part of selling,
 *   - catalogue prices change after a sale, so old lines no longer match,
 *   - the cart persists for 8 hours, so a price can legitimately move between
 *     scanning an item and completing the bill.
 * Rejecting mismatches would therefore refuse a large share of genuine sales
 * and stop a working shop from selling — strictly worse than the problem it
 * fixes.
 *
 * ── What this actually guarantees, stated honestly ─────────────────────────
 * In the default "warn" mode the submitted price is STILL what gets stored.
 * This is detection, not prevention: it makes tampering visible and auditable,
 * and it blocks only prices no discount could explain. A cashier or a stolen
 * session can still bill a ₹500 item at ₹1 and have it recorded — the shop
 * will simply have a loud warning naming the staff member, product and amount.
 *
 * Closing that properly needs the client to send a server-verifiable discount
 * (an authorised discount reason or a signed price snapshot) so the server can
 * derive the price itself and reject anything else. That is a product change,
 * not a patch, and it is the right next step once the warnings have been
 * reviewed. PRICE_GUARD_MODE=strict is available but will reject legitimate
 * sales until that work is done.
 */

export type PriceGuardMode = "off" | "warn" | "strict";

export function priceGuardMode(): PriceGuardMode {
  const raw = process.env["PRICE_GUARD_MODE"]?.trim().toLowerCase();
  if (raw === "off" || raw === "strict") return raw;
  return "warn";
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
  return { expected, submitted, matches, deviation, cataloguePrice };
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
