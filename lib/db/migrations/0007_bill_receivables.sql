-- Receivables (credit sales) support.
--
-- Adds `amount_paid` and `payment_status` to bills so we can track which
-- bills are still owed to the shop. Existing rows are backfilled as fully
-- paid (every legacy bill is assumed to have been a cash/UPI sale at
-- checkout time — receivables were not a concept before this migration).
--
-- payment_status values:
--   'paid'    — amount_paid >= total_amount
--   'partial' — 0 < amount_paid < total_amount
--   'unpaid'  — amount_paid = 0
--
-- Idempotent.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(10)   NOT NULL DEFAULT 'paid';

-- Backfill: every pre-existing bill was implicitly paid in full.
UPDATE bills
   SET amount_paid    = total_amount,
       payment_status = 'paid'
 WHERE amount_paid = 0
   AND payment_status = 'paid';

CREATE INDEX IF NOT EXISTS bills_tenant_status_idx
  ON bills (tenant_id, payment_status);
