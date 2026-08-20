import { describe, expect, it } from "vitest";
import { buildProductReport, type ProductReportAggregateRow } from "./product-report";

const rows: ProductReportAggregateRow[] = [
  {
    productId: "product-1",
    productName: "Building Blocks",
    productSku: "BLK-1",
    category: "Construction",
    currentStock: 3,
    lowStockThreshold: 5,
    purchasePrice: "40.00",
    totalQty: 4,
    totalRevenue: "400.00",
    billCount: 2,
    totalCost: "160.00",
    costedQty: 4,
    coveredRevenue: "400.00",
  },
  {
    productId: "product-2",
    productName: "Kite",
    productSku: "KIT-1",
    category: "Outdoor",
    currentStock: 12,
    lowStockThreshold: 3,
    purchasePrice: null,
    totalQty: 2,
    totalRevenue: "100.00",
    billCount: 1,
    totalCost: "0",
    costedQty: 0,
    coveredRevenue: "0",
  },
];

describe("buildProductReport", () => {
  it("returns only operational fields in the manager view", () => {
    const report = buildProductReport(rows, "manager", 30, "2026-07-22", "2026-08-20");

    expect(report.view).toBe("manager");
    expect(report.totals).toEqual({
      productCount: 2,
      unitsSold: 6,
      revenue: 500,
      currentStock: 15,
      lowStockCount: 1,
    });
    expect(report.products[0]).toMatchObject({
      rank: 1,
      currentStock: 3,
      isLowStock: true,
      totalQty: 4,
      totalRevenue: 400,
    });
    expect(report.products[0]).not.toHaveProperty("purchaseCost");
    expect(report.products[0]).not.toHaveProperty("profit");
    expect(report.products[0]).not.toHaveProperty("margin");
    expect(report.totals).not.toHaveProperty("stockValue");
    expect(report.totals).not.toHaveProperty("grossProfit");
  });

  it("adds complete cost and profit fields for owners without inventing unknown costs", () => {
    const report = buildProductReport(rows, "owner", 30, "2026-07-22", "2026-08-20");

    expect(report.view).toBe("owner");
    expect(report.products[0]).toMatchObject({
      purchaseCost: 40,
      stockValue: 120,
      costOfGoods: 160,
      profit: 240,
      margin: 60,
      costedQty: 4,
    });
    expect(report.products[1]).toMatchObject({
      purchaseCost: null,
      stockValue: null,
      costOfGoods: null,
      profit: null,
      margin: null,
      costedQty: 0,
    });
    expect(report.totals).toMatchObject({
      stockValue: 120,
      stockValueCoverageProducts: 1,
      grossProfit: 240,
      margin: 60,
      costedUnitsSold: 4,
    });
    if (report.view !== "owner") throw new Error("Expected owner report");
    expect(report.totals.costCoveragePercent).toBeCloseTo(66.67, 1);
  });

  it("keeps unsold known-cost products at zero profit instead of null", () => {
    const report = buildProductReport([{
      ...rows[0],
      totalQty: null,
      totalRevenue: null,
      billCount: null,
      totalCost: null,
      costedQty: null,
      coveredRevenue: null,
    }], "owner", 7, "2026-08-14", "2026-08-20");

    expect(report.products[0]).toMatchObject({
      totalQty: 0,
      costOfGoods: 0,
      profit: 0,
      margin: null,
    });
  });
});