-- Optional customer name captured at checkout, printed on the receipt
-- next to (or above) the existing customer_phone column. Nullable so
-- every existing bill stays valid.
--
-- Idempotent.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS customer_name TEXT;
