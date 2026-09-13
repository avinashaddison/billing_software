-- 0024_product_soft_delete.sql
-- Products are ARCHIVED, never hard-deleted.
--
-- Why: a product that was ever billed is referenced by sale_items (bill
-- lines), sales (quick-OUT), returns (refunds) and stock_logs. Hard-deleting
-- it either fails on those foreign keys, or destroys financial history, or
-- (the bug this replaces) trips sale_items' "product OR custom name" CHECK
-- when the line's product_id is nulled — every billed product answered
-- DELETE with a 500. Setting deleted_at instead keeps every bill, refund,
-- report and stock movement intact while the product vanishes from the
-- catalogue: lists, search, scan, stock check, dashboards, imports, billing.
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Per-tenant SKU / barcode uniqueness now applies to LIVE products only, so
-- an archived product's SKU or barcode can be given to a new one (otherwise
-- an owner who deletes an item by mistake could never re-create it — the
-- clash would point at a product they can no longer see). Old bills keep
-- pointing at the archived row by id, so history is unaffected by the reuse.
-- The live-only indexes are created BEFORE the old ones are dropped so
-- uniqueness is never unenforced, even if the statement batch is retried.
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_live_uq
  ON products (COALESCE(tenant_id, '__legacy_null__'), sku)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_barcode_live_uq
  ON products (COALESCE(tenant_id, '__legacy_null__'), barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS products_tenant_sku_uq;
DROP INDEX IF EXISTS products_tenant_barcode_uq;
