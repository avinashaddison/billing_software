import { logger } from "./logger";

const API_BASE = "https://api.telegram.org";

function isConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendMessage(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `${API_BASE}/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, body }, "Telegram sendMessage failed");
  }
}

export interface SaleAlertItem {
  productName: string;
  quantity:    number;
  subtotal:    number;
}

export interface SaleAlertBill {
  id:          string;
  totalAmount: number;
  itemsCount:  number;
  paymentMode: string;
  createdAt:   string | Date;
}

export function sendSaleAlert(bill: SaleAlertBill, items: SaleAlertItem[]): void {
  if (!isConfigured()) return;

  const time = new Date(bill.createdAt).toLocaleTimeString("en-IN", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const date = new Date(bill.createdAt).toLocaleDateString("en-IN", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
    timeZone: "Asia/Kolkata",
  });

  const itemLines = items
    .map((i) => `  • ${escapeHtml(i.productName)} ×${i.quantity}  →  ₹${i.subtotal.toLocaleString("en-IN")}`)
    .join("\n");

  const modeEmoji = bill.paymentMode === "upi" ? "📲" : "💵";
  const modeLabel = bill.paymentMode === "upi"  ? "UPI"  : "Cash";

  const text = [
    `🛒 <b>New Sale</b>  —  Bill #${escapeHtml(bill.id)}`,
    `─────────────────────`,
    itemLines,
    `─────────────────────`,
    `💰 Total: <b>₹${bill.totalAmount.toLocaleString("en-IN")}</b>   ${modeEmoji} ${modeLabel}`,
    `🕐 ${time}, ${date}`,
  ].join("\n");

  sendMessage(text).catch((err) =>
    logger.warn({ err }, "Telegram alert delivery error")
  );
}

export function sendTestAlert(): Promise<void> {
  if (!isConfigured()) {
    return Promise.reject(new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured"));
  }

  const now = new Date();
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  const text = [
    `✅ <b>Test Alert — Toy Mall</b>`,
    `─────────────────────`,
    `  • Sample Toy ×2  →  ₹500`,
    `  • Lego Set ×1    →  ₹1,200`,
    `─────────────────────`,
    `💰 Total: <b>₹1,700</b>   📲 UPI`,
    `🕐 ${time}, ${date}`,
    ``,
    `<i>Telegram alerts are working correctly!</i>`,
  ].join("\n");

  return sendMessage(text);
}

export { isConfigured };
