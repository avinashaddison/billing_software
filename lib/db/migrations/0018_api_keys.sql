-- Public API keys — lets a shop (tenant) grant external tools programmatic
-- access to its own data via `Authorization: Bearer <key>` on /api/v1/*.
--
-- The raw key is shown ONCE at creation; only its sha256 hex digest is
-- stored (key_hash). key_prefix keeps the first 12 characters so the UI can
-- show "adb_a1b2c3d4…" for recognition without being able to reconstruct
-- the key.
--
-- scope: 'read' = GET only; 'write' = read + create/update.
-- revoked_at NULL = active. Rows are never deleted so key history stays
-- auditable after revocation.
--
-- Idempotent: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  /* Tenant owner. NULL = legacy Hira & Sons key. */
  tenant_id    TEXT,
  name         TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,
  key_prefix   TEXT        NOT NULL,
  scope        TEXT        NOT NULL DEFAULT 'read',
  /* Human label of who created it (owner email / staff name). */
  created_by   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_tenant_idx ON api_keys (tenant_id, revoked_at);
