-- ============================================================================
-- Hira & Sons multi-tenant migration — additive only.
-- ============================================================================
--
-- Safe to run multiple times. Every operation is gated by `IF NOT EXISTS`
-- so re-runs are no-ops. No column types are altered, no rows are touched.
--
-- What this script does:
--   1. Creates the new `tenants` table (text-PK, slug-style identifier).
--   2. Adds nullable `tenant_id text` to the two tables that don't have it
--      yet: `staff_permissions` and `license_status`.
--   3. Creates btree indexes on `tenant_id` for every priority table so
--      tenant-scoped queries stay fast.
--   4. Creates partial unique indexes on the two singletons
--      (`store_settings`, `license_status`) so each tenant gets at most one
--      row, while leaving any existing legacy NULL row untouched.
--
-- What this script DOES NOT do:
--   - Change any existing column's type (`tenant_id text` stays `text`).
--   - Drop or alter any constraint.
--   - Backfill any data.
--   - Touch any of the 12 tables' existing columns or rows.
-- ============================================================================

BEGIN;

------------------------------------------------------------------------------
-- 1. tenants table
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_active_idx ON tenants (is_active);

------------------------------------------------------------------------------
-- 2. Add missing tenant_id columns (both nullable; preserves legacy NULL).
------------------------------------------------------------------------------
ALTER TABLE staff_permissions
  ADD COLUMN IF NOT EXISTS tenant_id text;

ALTER TABLE license_status
  ADD COLUMN IF NOT EXISTS tenant_id text;

------------------------------------------------------------------------------
-- 3. Indexes on tenant_id for every priority table.
------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS products_tenant_idx          ON products          (tenant_id);
CREATE INDEX IF NOT EXISTS bills_tenant_idx             ON bills             (tenant_id);
CREATE INDEX IF NOT EXISTS bills_tenant_created_idx     ON bills             (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS sales_tenant_idx             ON sales             (tenant_id);
CREATE INDEX IF NOT EXISTS sale_items_tenant_idx        ON sale_items        (tenant_id);
CREATE INDEX IF NOT EXISTS stock_logs_tenant_idx        ON stock_logs        (tenant_id);
CREATE INDEX IF NOT EXISTS returns_tenant_idx           ON returns           (tenant_id);
CREATE INDEX IF NOT EXISTS categories_tenant_idx        ON categories        (tenant_id);
CREATE INDEX IF NOT EXISTS suppliers_tenant_idx         ON suppliers         (tenant_id);
CREATE INDEX IF NOT EXISTS staff_profiles_tenant_idx    ON staff_profiles    (tenant_id);
CREATE INDEX IF NOT EXISTS staff_permissions_tenant_idx ON staff_permissions (tenant_id);

------------------------------------------------------------------------------
-- 4. Partial unique indexes on singletons.
--    These constrain non-NULL tenant_id values to be unique per table, while
--    leaving any legacy NULL row(s) unconstrained.
------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS store_settings_tenant_unique
  ON store_settings (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS license_status_tenant_unique
  ON license_status (tenant_id)
  WHERE tenant_id IS NOT NULL;

COMMIT;
