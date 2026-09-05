/**
 * Purchase cost of a MANUAL (non-catalogue) checkout line.
 *
 * The cashier is the only one who knows what a one-off item cost, so the
 * Manual Item dialog is where it is captured — and it is REQUIRED there:
 * without it the line's profit is unknowable and the sale is refused by the
 * server. An explicit 0 is a real answer (a service charge costs nothing).
 *
 * Lines that still carry no cost can only come from before the rule existed
 * (a resumed held bill, a shared cart filled from an older tab, an offline
 * bill queued earlier). Reports leave those OUT of profit rather than
 * counting them as pure profit; checkout blocks them until re-added.
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

/**
 * First manual cart line that has no purchase price recorded, or undefined
 * when every manual line is costed. Both checkout paths (Checkout page and
 * Scan page) call this before submitting, so the cashier gets one clear,
 * actionable message instead of a server rejection after the customer has
 * already paid.
 */
export function findUncostedManualLine<T extends { isManual?: boolean; purchasePrice?: number | null }>(
  items: readonly T[],
): T | undefined {
  return items.find((i) => !!i.isManual && !isValidManualCost(i.purchasePrice));
}

/** Cashier-facing explanation for a blocked checkout. */
export function uncostedManualLineMessage(name: string): string {
  return `Manual item "${name}" has no purchase price — remove it and add it again with the purchase price.`;
}
