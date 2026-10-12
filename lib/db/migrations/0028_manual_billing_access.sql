-- Additive only. One current key per shop; replaced keys are never retained.
CREATE TABLE IF NOT EXISTS manual_billing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  key_hash text NOT NULL,
  encrypted_key text NOT NULL,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS manual_billing_keys_tenant_unique
  ON manual_billing_keys ((COALESCE(tenant_id, '__legacy_null__')));

CREATE TABLE IF NOT EXISTS manual_billing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  actor_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  key_revision uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  bill_hash text,
  bill_id uuid,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manual_billing_approvals_tenant_idx
  ON manual_billing_approvals (tenant_id, actor_id);

CREATE TABLE IF NOT EXISTS manual_billing_key_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  actor_id text NOT NULL,
  failures integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS manual_billing_key_attempts_actor_unique
  ON manual_billing_key_attempts ((COALESCE(tenant_id, '__legacy_null__')), actor_id);
