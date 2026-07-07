-- 0015_platform_settings.sql
-- Global (platform-wide) settings — a single-row jsonb store shared across all
-- tenants. Currently holds the public subscription pricing shown on the landing
-- page and edited from /admin. Additive + idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS platform_settings (
  id          integer PRIMARY KEY DEFAULT 1,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row with the launch pricing (₹4,999 deal / ₹9,999 original)
-- so the public pricing endpoint returns real numbers before the admin ever
-- opens the panel. ON CONFLICT keeps whatever the admin has already saved.
INSERT INTO platform_settings (id, data)
VALUES (1, '{"dealPrice": 4999, "originalPrice": 9999}'::jsonb)
ON CONFLICT (id) DO NOTHING;
