import { isNull, type SQL } from "drizzle-orm";
import { productsTable } from "@workspace/db";

/**
 * "Still part of the catalogue" predicate for the products table.
 *
 * Deleting a product only stamps `deleted_at` (migration 0024) — its bills,
 * refunds, reports and stock movements keep referencing the row. So every
 * CATALOGUE-facing read must carry this predicate, or the archived product
 * quietly comes back: list/search, SKU/barcode/scan lookups, stock check and
 * product totals, dashboards, category/supplier counts, bulk import matching,
 * plan limits, the public API, and checkout validation (a deleted product
 * must not be billable from a stale cart).
 *
 * HISTORY-facing reads deliberately do NOT use it: bill detail/receipt lines,
 * customer purchase history, returns (creating a refund for a since-deleted
 * product must still work), stock-movement history, sales/profit reports and
 * the supplier purchase report. Those join the product only to name a row
 * that already exists, and dropping the join would either lose the name or
 * understate money.
 */
export function liveProduct(): SQL {
  return isNull(productsTable.deletedAt);
}
