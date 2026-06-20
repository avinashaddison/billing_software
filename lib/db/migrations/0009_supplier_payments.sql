-- Supplier payment history (simple payment log).
--
-- Records each payment a shop makes to a supplier: amount, method, date, note.
-- Powers the per-supplier payment history and the "total paid" rollup on the
-- Suppliers page. Deleting a supplier removes its payment rows (ON DELETE
-- CASCADE) so the existing hard-delete on suppliers keeps working.
--
-- Idempotent: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS supplier_payments (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  /* Tenant owner. NULL = legacy Hira & Sons row. */
  tenant_id   TEXT,
  supplier_id UUID         NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  /* Payment method: cash | upi | bank | other. Kept as VARCHAR (not an enum)
     so adding a method is a code change, no migration. */
  method      VARCHAR(10)  NOT NULL DEFAULT 'cash',
  note        TEXT,
  /* When the payment was actually made (user-supplied; defaults to now). */
  paid_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_payments_tenant_idx   ON supplier_payments (tenant_id);
CREATE INDEX IF NOT EXISTS supplier_payments_supplier_idx ON supplier_payments (supplier_id);
