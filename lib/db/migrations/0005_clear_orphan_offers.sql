-- DISABLED 2026-05-21.
--
-- This migration was originally intended as a one-shot cleanup of stale
-- offer state. The author assumed the only path that could leave a
-- product with (is_today_deal = false AND sale_price IS NOT NULL) was a
-- legacy bug in the Today's Deal toggle. That assumption was wrong: the
-- app also lets the merchant set a permanent sale_price independent of
-- Today's Deal.
--
-- Because runBootMigrations() re-runs every file on every server start
-- (Render's free tier cold-starts on idle), this migration was nulling
-- the merchant's sale prices several times per day.
--
-- Replaced with a no-op so the migration runner is happy if the file is
-- still referenced. The boot list in artifacts/api-server/src/lib/migrate.ts
-- has also been updated to skip this filename, so this content should
-- never actually execute again.

SELECT 1;
