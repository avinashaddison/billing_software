-- Additive only: preserve existing products, prices, stock and payments.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS checkout_discount_enabled boolean NOT NULL DEFAULT true;
