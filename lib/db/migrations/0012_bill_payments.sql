-- 0012_bill_payments.sql
-- Money-movement ledger so the End-of-Day report can attribute each cash/UPI
-- collection to the day it actually happened. Fully idempotent.
CREATE TABLE IF NOT EXISTS bill_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text,
  bill_id      uuid NOT NULL REFERENCES bills(id),
  amount       numeric(15, 2) NOT NULL,
  payment_mode text NOT NULL,
  kind         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Data-integrity guards (added separately so the CREATE TABLE stays idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_payments_amount_positive') THEN
    ALTER TABLE bill_payments ADD CONSTRAINT bill_payments_amount_positive CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_payments_kind_valid') THEN
    ALTER TABLE bill_payments ADD CONSTRAINT bill_payments_kind_valid CHECK (kind IN ('sale', 'collection'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bill_payments_bill_id_idx        ON bill_payments (bill_id);
CREATE INDEX IF NOT EXISTS bill_payments_tenant_created_idx ON bill_payments (tenant_id, created_at);

-- Backfill: record the at-checkout payment for existing NON-credit bills that
-- were paid (amount_paid > 0) and don't already have a ledger row. Dated at the
-- bill's creation time. We do NOT fabricate 'collection' rows for historically
-- settled credit bills (the real collection date is unknown), so accurate
-- "dues collected" reporting begins from this migration forward.
INSERT INTO bill_payments (tenant_id, bill_id, amount, payment_mode, kind, created_at)
SELECT b.tenant_id, b.id, b.amount_paid,
       CASE WHEN b.payment_mode IN ('cash', 'upi') THEN b.payment_mode ELSE 'cash' END,
       'sale', b.created_at
FROM bills b
WHERE b.amount_paid > 0
  AND b.payment_mode <> 'credit'
  AND NOT EXISTS (SELECT 1 FROM bill_payments p WHERE p.bill_id = b.id);
