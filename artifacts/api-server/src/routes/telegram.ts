import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, tenantTelegramSettingsTable } from "@workspace/db";
import { isConfigured, resolveConfig, sendTestAlert, splitChatIds } from "../lib/telegram";
import { runDailyReport } from "../lib/scheduler";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

/** BotFather tokens look like "123456789:AAH4...".  Loose check — Telegram is
 *  the real validator (the Test Alert button); this just catches paste noise. */
const TOKEN_RE = /^\d+:[A-Za-z0-9_-]{25,}$/;

/** Chat ids are integers; groups/channels are negative ("-100..."). */
const CHAT_ID_RE = /^-?\d+$/;

/** Keep the public bot id, hide the secret half. */
function maskToken(token: string): string {
  const [id] = token.split(":");
  return `${id}:••••••••`;
}

/* ── GET /api/telegram/status — tenant-aware summary ──────────────── */
router.get("/telegram/status", async (req, res): Promise<void> => {
  const config = await resolveConfig(req.tenantId ?? null);
  res.json({
    configured: config !== null,
    recipients: config?.chatIds.length ?? 0,
    source:     config?.source ?? null, // "tenant" | "global" | null
  });
});

/* ── GET /api/telegram/settings — the tenant's own bot config ─────── */
router.get("/telegram/settings", requireAdmin, async (req, res): Promise<void> => {
  // The legacy NULL-tenant install configures Telegram via env secrets.
  if (!req.tenantId) {
    res.json({ supported: false, hasOwn: false, enabled: false, botTokenMasked: null, chatIds: "", globalFallback: isConfigured() });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(tenantTelegramSettingsTable)
      .where(eq(tenantTelegramSettingsTable.tenantId, req.tenantId));
    res.json({
      supported:      true,
      hasOwn:         !!row,
      enabled:        row?.enabled ?? false,
      botTokenMasked: row ? maskToken(row.botToken) : null,
      chatIds:        row?.chatIds ?? "",
      globalFallback: isConfigured(),
    });
  } catch { res.status(500).json({ error: "Failed to load Telegram settings" }); }
});

/* ── PUT /api/telegram/settings — owner saves their own bot ───────── */
router.put("/telegram/settings", requireAdmin, async (req, res): Promise<void> => {
  if (!req.tenantId) {
    res.status(400).json({ error: "This install uses server secrets for Telegram. Contact support to change them." });
    return;
  }
  const rawToken   = req.body?.botToken;
  const rawChatIds = req.body?.chatIds;
  const enabled    = req.body?.enabled === undefined ? true : Boolean(req.body.enabled);

  const chatIds = typeof rawChatIds === "string" ? splitChatIds(rawChatIds) : [];
  if (chatIds.length === 0) {
    res.status(400).json({ error: "At least one Chat ID is required" }); return;
  }
  const badId = chatIds.find((id) => !CHAT_ID_RE.test(id));
  if (badId) {
    res.status(400).json({ error: `"${badId}" is not a valid Chat ID (numbers only, e.g. 123456789)` });
    return;
  }

  try {
    const [existing] = await db
      .select({ botToken: tenantTelegramSettingsTable.botToken })
      .from(tenantTelegramSettingsTable)
      .where(eq(tenantTelegramSettingsTable.tenantId, req.tenantId));

    /* Empty token field on an existing config = "keep my saved token", so the
       owner can edit chat ids without re-pasting the secret. */
    let botToken: string;
    if (typeof rawToken === "string" && rawToken.trim()) {
      botToken = rawToken.trim();
      if (!TOKEN_RE.test(botToken)) {
        res.status(400).json({ error: "Bot Token doesn't look right — it should be like 123456789:AAH4bx… (from @BotFather)" });
        return;
      }
    } else if (existing) {
      botToken = existing.botToken;
    } else {
      res.status(400).json({ error: "Bot Token is required" }); return;
    }

    await db
      .insert(tenantTelegramSettingsTable)
      .values({ tenantId: req.tenantId, botToken, chatIds: chatIds.join(","), enabled })
      .onConflictDoUpdate({
        target: tenantTelegramSettingsTable.tenantId,
        set:    { botToken, chatIds: chatIds.join(","), enabled, updatedAt: sql`now()` },
      });

    res.json({ ok: true, botTokenMasked: maskToken(botToken), chatIds: chatIds.join(","), enabled });
  } catch (err) {
    logger.error({ err }, "Failed to save tenant Telegram settings");
    res.status(500).json({ error: "Failed to save Telegram settings" });
  }
});

/* ── DELETE /api/telegram/settings — back to the default channel ──── */
router.delete("/telegram/settings", requireAdmin, async (req, res): Promise<void> => {
  if (!req.tenantId) { res.status(400).json({ error: "Nothing to remove" }); return; }
  try {
    await db
      .delete(tenantTelegramSettingsTable)
      .where(eq(tenantTelegramSettingsTable.tenantId, req.tenantId));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to remove Telegram settings" }); }
});

// Sending alerts / forcing the (cross-tenant) daily report is an owner action —
// a cashier must not be able to spam the channel or fan out the report.
router.post("/telegram/test", requireAdmin, async (req, res): Promise<void> => {
  try {
    await sendTestAlert(req.tenantId ?? null);
    res.json({ ok: true, message: "Test alert sent successfully!" });
  } catch (err) {
    if (err instanceof Error && err.message === "Telegram is not configured") {
      res.status(400).json({ error: "Telegram is not configured. Save a Bot Token and Chat ID first." });
      return;
    }
    // Telegram's Bot API is upstream — log the cause, return a safe message.
    logger.error({ err }, "Telegram test alert failed");
    res.status(502).json({ error: "Failed to send test alert" });
  }
});

router.post("/telegram/daily-report", requireAdmin, async (_req, res): Promise<void> => {
  if (!isConfigured()) {
    res.status(400).json({ error: "Telegram is not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets." });
    return;
  }
  try {
    await runDailyReport();
    res.json({ ok: true, message: "Daily report sent successfully!" });
  } catch (err) {
    logger.error({ err }, "Telegram daily report failed");
    res.status(502).json({ error: "Failed to send daily report" });
  }
});

export default router;
