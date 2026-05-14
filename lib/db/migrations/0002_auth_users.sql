-- ============================================================================
-- 0002_auth_users — add the email/password SaaS auth table.
-- ============================================================================
--
-- Safe to run multiple times. Every statement is idempotent.
-- Does not touch any existing table or row.
--
-- Coexists with the legacy `staff_profiles` PIN-login table — both are
-- supported simultaneously and the signed session cookie's `kind` field
-- routes lookups to the right table.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS auth_users (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                text,
  email                    text NOT NULL,
  password_hash            text NOT NULL,
  role                     text NOT NULL DEFAULT 'cashier',
  is_active                boolean NOT NULL DEFAULT true,
  last_login_at            timestamp with time zone,
  password_reset_token     text,
  password_reset_expires   timestamp with time zone,
  created_at               timestamp with time zone NOT NULL DEFAULT now(),
  updated_at               timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_users_tenant_idx ON auth_users (tenant_id);

/* Case-insensitive uniqueness on (tenant_id, email).
   COALESCE → NULL-tenant rows share a single bucket (so a SaaS-wide
   vendor admin email can't be duplicated). Per-tenant rows are
   uniqueified inside their tenant. */
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_per_tenant
  ON auth_users (COALESCE(tenant_id, ''), LOWER(email));

/* Lookup helper for the password reset flow. */
CREATE INDEX IF NOT EXISTS auth_users_reset_token_idx
  ON auth_users (password_reset_token)
  WHERE password_reset_token IS NOT NULL;

COMMIT;
