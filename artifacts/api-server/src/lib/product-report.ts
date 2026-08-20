import type { ResourceReadView } from "../middlewares/auth";

export interface ProductReportAggregateRow {
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  purchasePrice: string | null;
  totalQty: number | null;
  totalRevenue: string | null;
  billCount: number | null;
  totalCost: string | null;
  costedQty: number | null;
  coveredRevenue: string | null;
}

interface ManagerProductRow {
  rank: number;
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  totalQty: number;
  totalRevenue: number;
  billCount: number;
}

interface OwnerProductRow extends ManagerProductRow {
  purchaseCost: number | null;
  stockValue: number | null;
  costOfGoods: number | null;
  profit: number | null;
  margin: number | null;
  costedQty: number;
}

interface ManagerTotals {
  productCount: number;
  unitsSold: number;
  revenue: number;
  currentStock: number;
  lowStockCount: number;
}

interface OwnerTotals extends ManagerTotals {
  stockValue: number;
  stockValueCoverageProducts: number;
  grossProfit: number;
  margin: number | null;
  costedUnitsSold: number;
  costCoveragePercent: number;
}

export type ProductReportResponse =
  | {
      view: "manager";
      days: number;
      fromDay: string;
      toDay: string;
      totals: ManagerTotals;
      products: ManagerProductRow[];
    }
  | {
      view: "owner";
      days: number;
      fromDay: string;
      toDay: string;
      totals: OwnerTotals;
      products: OwnerProductRow[];
    };

/**
 * Converts database aggregates into one of two deliberately separate response
 * shapes. Manager responses are built from an allow-list so purchase price,
 * stock value and profitability cannot leak through an undefined/null field.
 */
export function buildProductReport(
  rows: ProductReportAggregateRow[],
  view: ResourceReadView,
  days: number,
  fromDay: string,
  toDay: string,
): ProductReportResponse {
  const managerProducts: ManagerProductRow[] = rows.map((row, index) => {
    const totalQty = Number(row.totalQty ?? 0);
    return {
      rank: index + 1,
      productId: row.productId,
      productName: row.productName,
      productSku: row.productSku,
      category: row.category,
      currentStock: Number(row.currentStock),
      lowStockThreshold: Number(row.lowStockThreshold),
      isLowStock: Number(row.currentStock) <= Number(row.lowStockThreshold),
      totalQty,
      totalRevenue: Number(row.totalRevenue ?? 0),
      billCount: Number(row.billCount ?? 0),
    };
  });

  const managerTotals: ManagerTotals = {
    productCount: managerProducts.length,
    unitsSold: managerProducts.reduce((sum, row) => sum + row.totalQty, 0),
    revenue: managerProducts.reduce((sum, row) => sum + row.totalRevenue, 0),
    currentStock: managerProducts.reduce((sum, row) => sum + row.currentStock, 0),
    lowStockCount: managerProducts.filter((row) => row.isLowStock).length,
  };

  if (view === "manager") {
    return {
      view,
      days,
      fromDay,
      toDay,
      totals: managerTotals,
      products: managerProducts,
    };
  }

  const ownerProducts: OwnerProductRow[] = managerProducts.map((row, index) => {
    const source = rows[index]!;
    const purchaseCost = source.purchasePrice == null ? null : Number(source.purchasePrice);
    const costedQty = Number(source.costedQty ?? 0);
    const totalCost = costedQty === row.totalQty ? Number(source.totalCost ?? 0) : null;
    const profit = totalCost == null ? null : row.totalRevenue - totalCost;
    const margin = profit != null && row.totalRevenue > 0
      ? (profit / row.totalRevenue) * 100
      : null;
    return {
      ...row,
      purchaseCost,
      stockValue: purchaseCost == null ? null : purchaseCost * row.currentStock,
      costOfGoods: totalCost,
      profit,
      margin,
      costedQty,
    };
  });

  const stockValuedProducts = ownerProducts.filter((row) => row.stockValue != null);
  const costedUnitsSold = rows.reduce((sum, row) => sum + Number(row.costedQty ?? 0), 0);
  const coveredRevenue = rows.reduce((sum, row) => sum + Number(row.coveredRevenue ?? 0), 0);
  const coveredCost = rows.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0);
  const grossProfit = coveredRevenue - coveredCost;

  return {
    view,
    days,
    fromDay,
    toDay,
    totals: {
      ...managerTotals,
      stockValue: stockValuedProducts.reduce((sum, row) => sum + (row.stockValue ?? 0), 0),
      stockValueCoverageProducts: stockValuedProducts.length,
      grossProfit,
      margin: coveredRevenue > 0 ? (grossProfit / coveredRevenue) * 100 : null,
      costedUnitsSold,
      costCoveragePercent: managerTotals.unitsSold > 0
        ? (costedUnitsSold / managerTotals.unitsSold) * 100
        : 0,
    },
    products: ownerProducts,
  };
}