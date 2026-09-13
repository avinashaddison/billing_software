---
name: Product deletion is archival (soft delete)
description: Why products are archived instead of deleted, the catalog-vs-history read-scope rule, live-only unique indexes, and how reports treat archived rows.
---
# Product deletion = archive

**Rule:** `DELETE /products/:id` only stamps `deleted_at`. Never hard-delete a product row.

**Why:** `sale_items` has CHECK (`product_id IS NOT NULL OR custom_name IS NOT NULL`), and `sales`, `returns`, `stock_logs` all reference products with NOT NULL FKs. The old route nulled `sale_items.product_id` → CHECK violation → 500 for every product that was ever billed (757 of 1414 live rows); the alternative 409 "has history" blocks the owner just the same. Cascading would destroy bills. Archiving is the only option that keeps history correct.

**How to apply — read scope:**
- Catalog-facing = anything that answers "what does the shop sell / hold now" → add `liveProduct()` (product-scope.ts). This includes the write statements themselves: checkout's guarded stock decrement and the stock-entry IN/OUT/ADJUSTMENT updates carry the live predicate, because the preceding SELECT is unlocked and a delete can commit in between (review finding). Distinguish "deleted a moment ago" from "insufficient stock" after a missed guarded UPDATE by re-reading `deleted_at`.
- History-facing = bill detail, returns, stock-history, movements, sales/EOD reports, customers → do NOT filter, or past bills lose product names and refunds of an archived product stop working.
- Reports that mix catalogue and money (product report, supplier report): keep an archived row only when it has activity in range; expose `deleted: true`; report its stock as 0 and exclude it from catalogue/stock/coverage totals; keep its units/revenue/profit/purchase value. UI: "Deleted" tag, no link to the product page (the SKU may now belong to a new product).

**Uniqueness:** SKU/barcode uniqueness is per tenant on live rows only (partial unique indexes `WHERE deleted_at IS NULL`). Archived SKU/barcode is reusable; the next-SKU generator still counts archived SKUs so numbers never repeat. A unique-violation → 409 mapping exists only in `/v1`; the in-app create route still lacks it.

**Gotcha:** `liveProduct()` must be inside JOIN conditions for LEFT JOINs (categories join), not in WHERE, or the join collapses to inner. The categories join also had no tenant predicate before (cross-tenant counts) — fixed alongside; don't revert.
