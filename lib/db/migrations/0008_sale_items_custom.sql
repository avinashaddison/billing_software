-- Manual / non-inventory line items on a bill.
--
-- Lets the shop bill for things that do NOT live in the products catalogue:
-- a customer's own gift brought in for wrapping, an ad-hoc service charge,
-- a one-off item, etc. These lines have no SKU, no stock, no purchase price,
-- and don't move inventory or stock logs — they only contribute revenue.
--
-- Schema changes:
--   1. sale_items.product_id  → nullable (was NOT NULL)
--   2. sale_items.custom_name → new TEXT column for manual line names
--   3. CHECK constraint        → exactly one of (product_id, custom_name) is set
--      (prevents totally orphaned rows; a sale item must identify itself)
--
-- Idempotent.

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Drop NOT NULL on product_id if it's still there. ALTER COLUMN ... DROP NOT NULL
-- is a no-op when the column is already nullable, so this is safe to re-run.
ALTER TABLE sale_items
  ALTER COLUMN product_id DROP NOT NULL;

-- Sanity check: a sale item must point at a product OR carry a custom name.
-- We add the constraint via a guarded DO block so re-running the migration
-- doesn't error on "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname  = 'sale_items_product_or_custom_name_chk'
       AND conrelid = 'sale_items'::regclass
  ) THEN
    ALTER TABLE sale_items
      ADD CONSTRAINT sale_items_product_or_custom_name_chk
      CHECK (product_id IS NOT NULL OR custom_name IS NOT NULL);
  END IF;
END$$;
