-- 0016_tenant_telegram.sql
-- Per-tenant Telegram notification config: each shop owner can register their
-- own bot token + chat id(s) so sale / low-stock alerts reach THEIR channel.
-- Tenants without a row keep using the global env config (fallback).
-- Additive + idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS tenant_telegram_settings (
  tenant_id   text PRIMARY KEY,
  bot_token   text NOT NULL,
  chat_ids    text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
