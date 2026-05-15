-- Per-tenant expiry. NULL = lifetime (no expiry). The cloud
-- equivalent of the deleted license-key expiry: instead of signing
-- a key that bakes in an expiry date, the date lives directly on
-- the tenant row and is checked by tenantActiveGate at request time.
--
-- Idempotent: every statement uses IF NOT EXISTS.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Lets the gate skip non-expiring tenants without a sequential scan
-- when the cohort grows. WHERE-clause keeps the index small.
CREATE INDEX IF NOT EXISTS tenants_expires_at_idx
  ON tenants (expires_at)
  WHERE expires_at IS NOT NULL;
