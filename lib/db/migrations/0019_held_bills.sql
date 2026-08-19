-- Persist cashier carts that are temporarily parked while another customer
-- is served. Cart lines are immutable snapshots: checkout still validates
-- current stock and price-integrity rules when the bill is finally completed.
--
-- Idempotent and additive-only so it is safe for the boot migration runner.

CREATE TABLE IF NOT EXISTS held_bills (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  /* Tenant owner. NULL = legacy Hira & Sons shop. */
  tenant_id     TEXT,
  customer_name TEXT,
  note          TEXT,
  items         JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS held_bills_tenant_created_idx
  ON held_bills (tenant_id, created_at DESC);