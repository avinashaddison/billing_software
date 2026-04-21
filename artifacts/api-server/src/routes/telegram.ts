import { Router, type IRouter } from "express";
import { isConfigured, recipientCount, sendTestAlert } from "../lib/telegram";

const router: IRouter = Router();

router.get("/telegram/status", (_req, res): void => {
  res.json({ configured: isConfigured(), recipients: recipientCount() });
});

router.post("/telegram/test", async (_req, res): Promise<void> => {
  if (!isConfigured()) {
    res.status(400).json({ error: "Telegram is not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets." });
    return;
  }
  try {
    await sendTestAlert();
    res.json({ ok: true, message: "Test alert sent successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to send test alert" });
  }
});

export default router;
