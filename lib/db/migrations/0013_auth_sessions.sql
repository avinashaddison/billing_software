-- Device / session tracking for the "Devices & Sessions" manager.
--
-- Until now sessions were stateless HMAC-signed cookies with no server-side
-- record, so there was no way to list logged-in devices or revoke one
-- remotely. This table stores one row per login. Its id is embedded in the
-- session cookie (the `sid` claim) and validated on every authenticated
-- request; setting `revoked_at` logs that device out on its next request.
--
-- subject_kind + subject_id identify who the session belongs to:
--   'pin'   → staff_profiles.id   (PIN login)
--   'email' → auth_users.id       (email login)
-- There is intentionally no FK — the two auth tables are independent and a
-- session must survive even if the row is later inspected across tables.
--
-- Idempotent: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  /* Tenant owner. NULL = legacy Hira & Sons session. */
  tenant_id    TEXT,
  /* 'pin' | 'email' — which auth table subject_id points at. */
  subject_kind TEXT        NOT NULL,
  subject_id   UUID        NOT NULL,
  /* Captured at login / lazy-upgrade. Truncated by the app before insert. */
  user_agent   TEXT,
  ip           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /* NULL = active. Set to NOW() to revoke (log the device out). */
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_sessions_subject_idx ON auth_sessions (subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS auth_sessions_tenant_idx  ON auth_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx  ON auth_sessions (tenant_id, revoked_at);
