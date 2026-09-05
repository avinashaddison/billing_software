/* ── Profit report rows ─────────────────────────────────────────────
   Pure shaping of the per-item rows and covered totals for
   GET /reports/profit. Kept out of the route so the cost rules below are
   unit-tested rather than re-derived by every reader of the SQL.

   Cost rule (same for catalogue SKUs and manual lines): profit is shown only
   when EVERY unit sold has a known cost. A manual line's cost is whatever the
   cashier typed when billing it (sale_items.purchase_price); a manual line
   billed without a cost is "cost not set" and is excluded from the profit
   totals exactly like an unpriced catalogue SKU — it is never assumed to be
   100% profit.
──────────────────────────────────────────────────────────────────── */

export interface SkuAggregateRow {
  productName: string;
  productSku: string;
  category: string;
  totalQty: number | string;
  totalRevenue: number | string;
  billCount: number | string;
  totalCost: number | string | null;
  costedQty: number | string | null;
}

export interface ManualAggregateRow {
  customName: string;
  totalQty: number | string;
  totalRevenue: number | string;
  billCount: number | string;
  totalCost: number | string | null;
  costedQty: number | string | null;
}

export interface ProfitRow {
  kind: "sku" | "manual";
  name: string;
  sku: string | null;
  category: string | null;
  qty: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  margin: number | null;
  billCount: number;
  costKnown: boolean;
}

export interface CoveredTotals {
  coveredRevenue: number;
  totalCost: number;
  uncostedRevenue: number;
  totalQty: number;
  totalProfit: number;
}

function costedFigures(
  qty: number,
  revenue: number,
  totalCost: number | string | null,
  costedQty: number | string | null,
) {
  const costKnown = qty > 0 && Number(costedQty ?? 0) === qty;
  const cost = costKnown ? Number(totalCost ?? 0) : null;
  const profit = cost != null ? revenue - cost : null;
  const margin = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;
  return { costKnown, cost, profit, margin };
}

export function buildProfitRows(
  skuRows: SkuAggregateRow[],
  manualRows: ManualAggregateRow[],
): ProfitRow[] {
  const rows: ProfitRow[] = [
    ...skuRows.map((p): ProfitRow => {
      const qty = Number(p.totalQty);
      const revenue = Number(p.totalRevenue);
      return {
        kind: "sku",
        name: p.productName,
        sku: p.productSku,
        category: p.category,
        qty,
        revenue,
        ...costedFigures(qty, revenue, p.totalCost, p.costedQty),
        billCount: Number(p.billCount),
      };
    }),
    ...manualRows.map((m): ProfitRow => {
      const qty = Number(m.totalQty);
      const revenue = Number(m.totalRevenue);
      return {
        kind: "manual",
        name: m.customName,
        sku: null,
        category: null,
        qty,
        revenue,
        ...costedFigures(qty, revenue, m.totalCost, m.costedQty),
        billCount: Number(m.billCount),
      };
    }),
  ];
  return rows.sort((a, b) => b.revenue - a.revenue);
}

/** Totals over rows with a KNOWN cost (same "covered" base as the EOD report). */
export function summarizeCoveredTotals(rows: ProfitRow[]): CoveredTotals {
  let coveredRevenue = 0, totalCost = 0, uncostedRevenue = 0, totalQty = 0;
  for (const r of rows) {
    totalQty += r.qty;
    if (r.costKnown && r.cost != null) { coveredRevenue += r.revenue; totalCost += r.cost; }
    else uncostedRevenue += r.revenue;
  }
  return { coveredRevenue, totalCost, uncostedRevenue, totalQty, totalProfit: coveredRevenue - totalCost };
}
