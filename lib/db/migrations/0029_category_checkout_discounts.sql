-- Additive only. Preserve all existing category/product prices and discounts.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS checkout_discount_enabled boolean NOT NULL DEFAULT true;
