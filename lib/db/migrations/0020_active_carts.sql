-- Durable, revisioned active carts.
-- A deterministic cart_key gives the legacy NULL tenant its own row while
-- preserving a normal primary key for tenant carts.
CREATE TABLE IF NOT EXISTS active_carts (
  cart_key  TEXT PRIMARY KEY,
  tenant_id TEXT,
  items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  revision   BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS active_carts_tenant_idx
  ON active_carts (tenant_id);