BEGIN;

ALTER TABLE stock_logs
  ADD COLUMN IF NOT EXISTS purchase_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS note text;

COMMIT;