-- Manual / non-inventory line items on a bill.
--
-- Lets the shop bill for things that do NOT live in the products catalogue:
-- a customer's own gift brought in for wrapping, an ad-hoc service charge,
-- a one-off item, etc. These lines have no SKU, no stock, no purchase price,
-- and don't move inventory or stock logs — they only contribute revenue.
--
-- Schema changes:
--   1. sale_items.custom_name → new TEXT column for manual line names
--   2. sale_items.product_id  → nullable (was NOT NULL)
--   3. backfill: orphan rows (no product_id, no custom_name) get a labelled
--      placeholder so the new CHECK constraint can attach cleanly. This is
--      a NO-DATA-LOSS path — financial fields (price, quantity, subtotal,
--      sale_id) are untouched. Only the human-readable name is filled in.
--   4. CHECK constraint → every sale_item must identify itself either by
--      product_id (catalogue line) or custom_name (manual line).
--
-- Fully idempotent. Re-running on a clean DB is a no-op; re-running on a
-- partially-applied DB (e.g. previous boot got through the column add but
-- failed on the constraint) finishes the job.

-- 1) Add the custom_name column. Safe to re-run.
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- 2) Drop NOT NULL on product_id. No-op if already nullable.
ALTER TABLE sale_items
  ALTER COLUMN product_id DROP NOT NULL;

-- 3) Backfill orphan rows BEFORE attempting the CHECK constraint.
--
--    Why this is here:
--    A previous schema state allowed (or somehow ended up with) sale_items
--    rows where product_id IS NULL — typically pre-NOT-NULL legacy data, or
--    rows whose referenced product was hard-deleted in an earlier era. The
--    new constraint says "either product_id OR custom_name must be set".
--    If we attach it without backfilling, Postgres rejects it with:
--
--      check constraint "sale_items_product_or_custom_name_chk"
--      of relation "sale_items" is violated by some row
--
--    and the entire migration aborts (which is exactly what was happening
--    on the live deploy). The fix is to give those orphan rows a sensible
--    label so the receipt and customer history stay readable, then attach
--    the constraint.
--
--    This UPDATE only touches the offending rows (both fields NULL). All
--    other rows are untouched. No quantities, prices, or subtotals change.
UPDATE sale_items
   SET custom_name = '(unknown item)'
 WHERE product_id  IS NULL
   AND custom_name IS NULL;

-- 4) Attach the CHECK constraint. Guarded so re-runs don't error on
--    "constraint already exists".
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

