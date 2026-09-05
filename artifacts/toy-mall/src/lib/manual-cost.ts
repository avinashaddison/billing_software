/**
 * Purchase cost of a MANUAL (non-catalogue) checkout line.
 *
 * The cashier is the only one who knows what a one-off item cost, so the
 * Manual Item dialog is where it is captured. Blank means "not recorded":
 * the line is then left OUT of profit reports (never counted as pure
 * profit). An explicit 0 is a real answer — a service charge costs nothing.
 */

/**
 * Largest cost the server will store (`sale_items.purchase_price` is
 * numeric(10,2)). Mirrors MAX_MANUAL_COST in the API server's price-integrity
 * module — keep the two in step so the dialog refuses exactly what checkout
 * would refuse, instead of failing the sale at the till.
 */
export const MAX_MANUAL_COST = 99_999_999.99;

/** True for a real, non-negative, storable cost (0 included; -0 included). */
export function isValidManualCost(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_MANUAL_COST;
}
