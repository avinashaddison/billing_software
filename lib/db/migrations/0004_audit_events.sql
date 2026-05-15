-- Append-only audit trail of platform-admin actions. Every sensitive
-- /api/platform/* write logs a row here so we can answer "who suspended
-- which tenant, when, from where" without trawling deploy logs.
--
-- Idempotent: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS audit_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  /* Auth user that performed the action. NULL only if the actor was
     deleted afterwards (we never delete on purpose — kept nullable for
     future-proofing). */
  actor_id     UUID         REFERENCES auth_users(id) ON DELETE SET NULL,
  /* Email is denormalised so a row stays readable even if the actor row
     is later renamed. */
  actor_email  TEXT         NOT NULL,
  /* Free-form action verb, e.g. "tenant.suspend", "tenant.extend".
     Kept as TEXT (not an enum) so adding a new action is just a code
     change, no migration needed. */
  action       TEXT         NOT NULL,
  /* Tenant the action affected, if any (some platform actions are
     tenant-scoped, others are global). */
  target_tenant TEXT,
  /* Arbitrary structured payload — old/new values, request body, etc. */
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  /* Best-effort client IP (from req.ip, which honours X-Forwarded-For
     because app.set("trust proxy", 1) is on). */
  ip           TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_events_target_idx ON audit_events (target_tenant, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx  ON audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events (action, created_at DESC);
