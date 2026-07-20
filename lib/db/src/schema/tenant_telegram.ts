import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-tenant Telegram notification config. Each shop owner can register
 * their OWN bot token + chat id(s) from Settings so their sale / low-stock
 * alerts go to their private channel instead of the shared vendor one.
 *
 * A tenant WITHOUT a row (or with enabled=false) falls back to the global
 * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env config — preserving the legacy
 * single-channel behaviour. The legacy NULL-tenant install always uses env
 * (tenant_id is the PK, so NULL can't be stored).
 *
 * `chat_ids` is comma-separated, same convention as the env var.
 */
export const tenantTelegramSettingsTable = pgTable("tenant_telegram_settings", {
  tenantId:  text("tenant_id").primaryKey(),
  botToken:  text("bot_token").notNull(),
  chatIds:   text("chat_ids").notNull(),
  enabled:   boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TenantTelegramSettingsRow = typeof tenantTelegramSettingsTable.$inferSelect;
