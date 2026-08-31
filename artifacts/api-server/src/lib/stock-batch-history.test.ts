import { describe, expect, it } from "vitest";
import { buildStockBatchHistory, type StockMovement } from "./stock-batch-history";

const movement = (
  id: string,
  type: StockMovement["type"],
  quantity: number,
  createdAt = `2026-08-${id.padStart(2, "0")}T06:00:00.000Z`,
  userId: string | null = null,
): StockMovement => ({ id, type, quantity, createdAt, userId });

describe("buildStockBatchHistory", () => {
  it("shows added, sold and remaining for one restock", () => {
    const result = buildStockBatchHistory("p1", 18, [
      movement("1", "IN", 20),
      movement("2", "OUT", 2),
    ]);

    expect(result.batches[0]).toMatchObject({
      addedQuantity: 20,
      soldQuantity: 2,
      adjustedQuantity: 0,
      remainingQuantity: 18,
    });
    expect(result.summary).toMatchObject({
      stockedQuantity: 20,
      soldQuantity: 2,
      unattributedRemaining: 0,
    });
  });

  it("allocates sales to the oldest restock first", () => {
    const result = buildStockBatchHistory("p1", 18, [
      movement("1", "IN", 10),
      movement("2", "IN", 20),
      movement("3", "OUT", 12),
    ]);

    expect(result.batches).toEqual([
      expect.objectContaining({ id: "2", soldQuantity: 2, remainingQuantity: 18 }),
      expect.objectContaining({ id: "1", soldQuantity: 10, remainingQuantity: 0 }),
    ]);
  });

  it("consumes unattributed opening stock before dated restocks", () => {
    const result = buildStockBatchHistory("p1", 3, [
      movement("1", "IN", 5),
      movement("2", "OUT", 12),
    ]);

    expect(result.batches[0]).toMatchObject({
      addedQuantity: 5,
      soldQuantity: 2,
      remainingQuantity: 3,
    });
    expect(result.summary.soldQuantity).toBe(12);
  });

  it("keeps returned stock separate from supplier restock batches", () => {
    const result = buildStockBatchHistory("p1", 1, [
      movement("1", "IN", 5),
      movement("2", "OUT", 5),
      movement("3", "RETURN", 2),
      movement("4", "OUT", 1),
    ]);

    expect(result.batches[0]).toMatchObject({ soldQuantity: 5, remainingQuantity: 0 });
    expect(result.summary).toMatchObject({
      soldQuantity: 6,
      returnedQuantity: 2,
      unattributedRemaining: 1,
    });
  });

  it("records downward adjustments separately from sold quantity", () => {
    const result = buildStockBatchHistory("p1", 15, [
      movement("1", "IN", 20),
      movement("2", "ADJUSTMENT", 15),
    ]);

    expect(result.batches[0]).toMatchObject({
      soldQuantity: 0,
      adjustedQuantity: 20,
      remainingQuantity: 0,
    });
    expect(result.summary.unattributedRemaining).toBe(15);
  });

  it("keeps an ambiguous pre-adjustment gap unattributed", () => {
    const result = buildStockBatchHistory("p1", 13, [
      movement("1", "IN", 10),
      movement("2", "ADJUSTMENT", 15),
      movement("3", "OUT", 2),
    ]);

    expect(result.batches[0]).toMatchObject({
      soldQuantity: 0,
      adjustedQuantity: 10,
      remainingQuantity: 0,
    });
    expect(result.summary.unattributedRemaining).toBe(13);
  });

  it("does not falsely sell a dated batch when opening stock can cover the sale", () => {
    const result = buildStockBatchHistory("p1", 25, [
      movement("1", "IN", 20),
      movement("2", "OUT", 5),
      movement("3", "ADJUSTMENT", 25),
    ]);

    expect(result.batches[0]).toMatchObject({
      addedQuantity: 20,
      soldQuantity: 0,
      adjustedQuantity: 20,
      remainingQuantity: 0,
    });
    expect(result.summary).toMatchObject({
      soldQuantity: 5,
      unattributedRemaining: 25,
    });
  });

  it("does not attribute sales after a downward absolute correction", () => {
    const result = buildStockBatchHistory("p1", 5, [
      movement("1", "IN", 20),
      movement("2", "ADJUSTMENT", 15),
      movement("3", "OUT", 10),
    ]);

    expect(result.batches[0]).toMatchObject({
      addedQuantity: 20,
      soldQuantity: 0,
      adjustedQuantity: 20,
      remainingQuantity: 0,
    });
    expect(result.summary).toMatchObject({
      soldQuantity: 10,
      unattributedRemaining: 5,
    });
  });

  it("reports legacy stock with no ledger as unattributed", () => {
    const result = buildStockBatchHistory("p1", 7, []);

    expect(result.batches).toEqual([]);
    expect(result.summary).toMatchObject({
      batchCount: 0,
      stockedQuantity: 0,
      soldQuantity: 0,
      unattributedRemaining: 7,
    });
  });

  it("uses id as a stable tie-breaker for movements at the same time", () => {
    const at = "2026-08-31T18:30:00.000Z";
    const result = buildStockBatchHistory("p1", 3, [
      movement("b", "OUT", 2, at),
      movement("a", "IN", 5, at),
    ]);

    expect(result.batches[0]).toMatchObject({ soldQuantity: 2, remainingQuantity: 3 });
  });

  it("replays a positive signed adjustment from the legacy v1 API as a delta", () => {
    const result = buildStockBatchHistory("p1", 5, [
      movement("1", "IN", 10),
      movement("2", "ADJUSTMENT", 5, undefined, "apikey:inventory-sync"),
      movement("3", "OUT", 10),
    ]);

    expect(result.batches[0]).toMatchObject({
      addedQuantity: 10,
      soldQuantity: 10,
      adjustedQuantity: 0,
      remainingQuantity: 0,
    });
    expect(result.summary.unattributedRemaining).toBe(5);
  });

  it("replays a negative signed adjustment from the legacy v1 API as a delta", () => {
    const result = buildStockBatchHistory("p1", 2, [
      movement("1", "IN", 10),
      movement("2", "ADJUSTMENT", -3, undefined, "apikey:inventory-sync"),
      movement("3", "OUT", 5),
    ]);

    expect(result.batches[0]).toMatchObject({
      addedQuantity: 10,
      soldQuantity: 5,
      adjustedQuantity: 3,
      remainingQuantity: 2,
    });
  });

  it("treats new v1 API adjustment rows as absolute levels", () => {
    const result = buildStockBatchHistory("p1", 5, [
      movement("1", "IN", 10),
      movement("2", "ADJUSTMENT", 15, undefined, "apikey-absolute:inventory-sync"),
      movement("3", "OUT", 10),
    ]);

    expect(result.batches[0]).toMatchObject({
      soldQuantity: 0,
      adjustedQuantity: 10,
      remainingQuantity: 0,
    });
    expect(result.summary.unattributedRemaining).toBe(5);
  });
});