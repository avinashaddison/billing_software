-- 0010_per_tenant_unique.sql
-- Make product SKU / barcode and category name unique PER TENANT instead of
-- globally, so different shops can reuse the same SKU, barcode, or category
-- name. Legacy rows with a NULL tenant_id are grouped under a sentinel string
-- so they keep their own uniqueness. Fully idempotent.

-- Drop the old GLOBAL unique constraints. Cover both the Drizzle `_unique`
-- naming and the Postgres `_key` naming, whichever the live DB happens to use.
ALTER TABLE products   DROP CONSTRAINT IF EXISTS products_sku_unique;
ALTER TABLE products   DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products   DROP CONSTRAINT IF EXISTS products_barcode_unique;
ALTER TABLE products   DROP CONSTRAINT IF EXISTS products_barcode_key;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_unique;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- In case any of the above existed purely as a unique INDEX, not a constraint.
DROP INDEX IF EXISTS products_sku_unique;
DROP INDEX IF EXISTS products_barcode_unique;
DROP INDEX IF EXISTS categories_name_unique;

-- Recreate uniqueness scoped to the tenant. Existing rows are already globally
-- unique, so these indexes build cleanly with no duplicate violations.
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_sku_uq
  ON products (COALESCE(tenant_id, '__legacy_null__'), sku);

-- Barcode is optional: only enforce uniqueness for rows that actually have one
-- (a partial index lets many products share a NULL barcode).
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_barcode_uq
  ON products (COALESCE(tenant_id, '__legacy_null__'), barcode)
  WHERE barcode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_tenant_name_uq
  ON categories (COALESCE(tenant_id, '__legacy_null__'), name);
