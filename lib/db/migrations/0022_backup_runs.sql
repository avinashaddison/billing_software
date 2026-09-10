-- Ledger of backup runs (nightly / intraday / manual / pre-restore safety).
--
-- Two jobs:
--   1. Exactly-once scheduling across processes. Both the deployment and a
--      development workspace run the scheduler against this one database, so
--      every scheduled backup is a named slot ("nightly:2026-09-10") that a
--      process must CLAIM here before it runs. The primary key on `slot` is
--      what makes the claim atomic — no env-detection, no leader election.
--   2. A durable "when did the last backup actually succeed?" answer for the
--      admin page, the public freshness endpoint and the staleness alert —
--      including Telegram-only deliveries, which leave nothing in R2.
--
-- Deliberately NOT part of the snapshot and never restored: it is operational
-- metadata about backups, not shop data.
CREATE TABLE IF NOT EXISTS backup_runs (
  slot        TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                 -- nightly | intraday | manual | safety
  status      TEXT NOT NULL,                 -- running | ok | failed
  attempts    INTEGER NOT NULL DEFAULT 1,
  claimed_by  TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  r2_key      TEXT,
  telegram    BOOLEAN NOT NULL DEFAULT false,
  encrypted   BOOLEAN NOT NULL DEFAULT false,
  size_bytes  BIGINT,
  tables      INTEGER,
  total_rows  BIGINT,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS backup_runs_finished_idx
  ON backup_runs (status, finished_at DESC);
