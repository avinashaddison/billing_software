import { describe, expect, it } from "vitest";
import { deriveStockTotals, type ProductStockTotals } from "./stock-totals";

const ledger = (
  inQuantity = 0,
  inCount = 0,
  outQuantity = 0,
  returnedQuantity = 0,
) => ({ inQuantity, inCount, outQuantity, returnedQuantity });

/** The one relationship every row must satisfy, whatever the ledger looked like. */
const reconciles = (t: ProductStockTotals) =>
  t.unloggedInQuantity + t.inQuantity - t.outQuantity + t.returnedQuantity - t.unloggedOutQuantity;

describe("deriveStockTotals", () => {
  it("treats stock that never went through an entry as unlogged-in (opening stock)", () => {
    // Created with 4 units, 3 sold since, nothing ever entered via Entry Data.
    const t = deriveStockTotals("p1", 1, ledger(0, 0, 3));
    expect(t).toMatchObject({
      inQuantity: 0, inCount: 0, outQuantity: 3, returnedQuantity: 0,
      unloggedInQuantity: 4, unloggedOutQuantity: 0, currentStock: 1,
    });
    expect(reconciles(t)).toBe(1);
  });

  it("reports nothing unlogged when the ledger fully explains the level", () => {
    const t = deriveStockTotals("p1", 8, ledger(10, 2, 3, 1));
    expect(t.unloggedInQuantity).toBe(0);
    expect(t.unloggedOutQuantity).toBe(0);
    expect(reconciles(t)).toBe(8);
  });

  it("combines opening stock with later entries instead of hiding either", () => {
    // 3 opening + one entry of 3, 4 sold → 2 left.
    const t = deriveStockTotals("p1", 2, ledger(3, 1, 4));
    expect(t.unloggedInQuantity).toBe(3);
    expect(t.inQuantity).toBe(3);
    expect(t.inCount).toBe(1);
    expect(reconciles(t)).toBe(2);
  });

  it("reports stock that vanished without a sale as unlogged-out, never as sold", () => {
    // Entered 10, sold 2, but the level was edited down to 5.
    const t = deriveStockTotals("p1", 5, ledger(10, 1, 2));
    expect(t.outQuantity).toBe(2);
    expect(t.unloggedOutQuantity).toBe(3);
    expect(t.unloggedInQuantity).toBe(0);
    expect(reconciles(t)).toBe(5);
  });

  it("never sets both unlogged halves at once", () => {
    for (const stock of [0, 1, 5, 9, 20]) {
      const t = deriveStockTotals("p1", stock, ledger(6, 2, 4, 1));
      expect(Math.min(t.unloggedInQuantity, t.unloggedOutQuantity)).toBe(0);
      expect(reconciles(t)).toBe(stock);
    }
  });

  it("clamps malformed inputs to whole non-negative numbers", () => {
    const t = deriveStockTotals("p1", -2, ledger(Number.NaN, 1.9, -4, 0.4));
    expect(t).toMatchObject({
      currentStock: 0, inQuantity: 0, inCount: 1, outQuantity: 0, returnedQuantity: 0,
      unloggedInQuantity: 0, unloggedOutQuantity: 0,
    });
  });

  it("keeps a product with no movements and no stock at all zeros", () => {
    const t = deriveStockTotals("p1", 0, ledger());
    expect(reconciles(t)).toBe(0);
    expect(t.unloggedInQuantity).toBe(0);
    expect(t.unloggedOutQuantity).toBe(0);
  });
});
