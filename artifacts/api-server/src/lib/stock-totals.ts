/**
 * All-time stock totals for one product: what the movement ledger says came in
 * and went out, reconciled against the product's authoritative current level.
 *
 * The ledger (`stock_logs`) only ever records stock ENTRIES (IN), sales (OUT)
 * and customer returns (RETURN). Plenty of stock never passes through it: the
 * quantity typed in when a product is created, "Edit product" stock changes,
 * bulk imports and absolute API corrections all write the level directly. A
 * sheet that summed the ledger alone would therefore tell a shop "0 in, 3 sold,
 * 1 left" for a product whose 4 opening units were simply created with it.
 *
 * So the gap between the current level and the ledger's net movement is
 * surfaced explicitly rather than ignored:
 *   - a positive gap is stock that arrived without an entry (`unloggedInQuantity`)
 *   - a negative gap is stock that left without a sale   (`unloggedOutQuantity`)
 * They are the two sign halves of one net figure, so at most one is non-zero,
 * and the identity below holds for every product:
 *
 *   currentStock = unloggedIn + in - out + returned - unloggedOut
 *
 * What the gap is made of (opening stock vs. a later correction) cannot be
 * told apart from here — see stock-batch-history for why absolute
 * corrections make that unknowable — which is exactly why it is reported as
 * "unlogged" and not as an extra dated stock entry.
 */

export interface LedgerTotals {
  /** Units received through stock entries (IN movements). */
  inQuantity: number;
  /** Number of stock entries (IN movements). */
  inCount: number;
  /** Units sold (OUT movements). */
  outQuantity: number;
  /** Units customers returned to stock (RETURN movements). */
  returnedQuantity: number;
}

export interface ProductStockTotals extends LedgerTotals {
  productId: string;
  currentStock: number;
  /** Stock that arrived without a stock entry: opening stock typed at creation, upward edits/corrections. */
  unloggedInQuantity: number;
  /** Stock that left without a sale or return: downward edits/corrections, write-offs. */
  unloggedOutQuantity: number;
}

const whole = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

export function deriveStockTotals(
  productId: string,
  currentStock: number,
  ledger: LedgerTotals,
): ProductStockTotals {
  const inQuantity = whole(ledger.inQuantity);
  const inCount = whole(ledger.inCount);
  const outQuantity = whole(ledger.outQuantity);
  const returnedQuantity = whole(ledger.returnedQuantity);
  const stock = whole(currentStock);

  const gap = stock - (inQuantity - outQuantity + returnedQuantity);

  return {
    productId,
    currentStock: stock,
    inQuantity,
    inCount,
    outQuantity,
    returnedQuantity,
    unloggedInQuantity: Math.max(0, gap),
    unloggedOutQuantity: Math.max(0, -gap),
  };
}
