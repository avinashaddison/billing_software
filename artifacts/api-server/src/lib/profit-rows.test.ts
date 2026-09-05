import { describe, expect, it } from "vitest";
import { buildProfitRows, summarizeCoveredTotals } from "./profit-rows";

const sku = (over: Partial<Parameters<typeof buildProfitRows>[0][number]> = {}) => ({
  productName: "Teddy",
  productSku: "TED-1",
  category: "Soft toys",
  totalQty: 2,
  totalRevenue: "500.00",
  billCount: 2,
  totalCost: "300.00",
  costedQty: 2,
  ...over,
});

describe("profit report rows", () => {
  it("nets a manual line's typed cost against its selling price", () => {
    const rows = buildProfitRows([], [{
      customName: "Customer's gift wrap",
      totalQty: 4,
      totalRevenue: "400.00",
      billCount: 3,
      totalCost: "240.00",
      costedQty: 4,
    }]);

    expect(rows[0]).toMatchObject({
      kind: "manual",
      qty: 4,
      revenue: 400,
      cost: 240,
      profit: 160,
      margin: 40,
      costKnown: true,
    });
  });

  it("never treats a manual line without a recorded cost as pure profit", () => {
    const rows = buildProfitRows([], [{
      customName: "Legacy manual sale",
      totalQty: 1,
      totalRevenue: "999.00",
      billCount: 1,
      totalCost: "0",
      costedQty: 0,
    }]);

    expect(rows[0]).toMatchObject({ kind: "manual", cost: null, profit: null, margin: null, costKnown: false });
    expect(summarizeCoveredTotals(rows)).toEqual({
      coveredRevenue: 0,
      totalCost: 0,
      uncostedRevenue: 999,
      totalQty: 1,
      totalProfit: 0,
    });
  });

  it("requires every unit of a manual name to be costed before showing profit", () => {
    // Two bills for "Balloon set": one typed a cost, the other did not.
    const rows = buildProfitRows([], [{
      customName: "Balloon set",
      totalQty: 3,
      totalRevenue: "300.00",
      billCount: 2,
      totalCost: "60.00",
      costedQty: 2,
    }]);

    expect(rows[0]).toMatchObject({ costKnown: false, cost: null, profit: null });
  });

  it("treats an explicit zero cost as fully costed (service charge)", () => {
    const rows = buildProfitRows([], [{
      customName: "Gift wrapping service",
      totalQty: 2,
      totalRevenue: "100.00",
      billCount: 2,
      totalCost: "0.00",
      costedQty: 2,
    }]);

    expect(rows[0]).toMatchObject({ costKnown: true, cost: 0, profit: 100, margin: 100 });
  });

  it("keeps catalogue SKU behaviour and orders rows by revenue", () => {
    const rows = buildProfitRows(
      [sku(), sku({ productName: "Car", productSku: "CAR-1", totalRevenue: "1200.00", totalCost: "0", costedQty: 0 })],
      [{ customName: "Wrap", totalQty: 1, totalRevenue: "800.00", billCount: 1, totalCost: "500.00", costedQty: 1 }],
    );

    expect(rows.map((r) => r.name)).toEqual(["Car", "Wrap", "Teddy"]);
    expect(rows[0]).toMatchObject({ costKnown: false, profit: null });
    expect(rows[2]).toMatchObject({ costKnown: true, cost: 300, profit: 200, margin: 40 });

    expect(summarizeCoveredTotals(rows)).toEqual({
      coveredRevenue: 1300,   // Wrap 800 + Teddy 500
      totalCost: 800,         // 500 + 300
      uncostedRevenue: 1200,  // Car
      totalQty: 5,
      totalProfit: 500,
    });
  });
});
