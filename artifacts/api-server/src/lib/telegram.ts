import { logger } from "./logger";

const API_BASE  = "https://api.telegram.org";
const DIVIDER   = "━━━━━━━━━━━━━━━━━━━━━━";
const STORE_NAME = process.env.STORE_NAME || "Toy Mall";

export function isConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendMessage(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
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
  price:       number;
  subtotal:    number;
}

export interface SaleAlertBill {
  id:            string;
  totalAmount:   number;
  itemsCount:    number;
  paymentMode:   string;
  customerPhone?: string | null;
  createdAt:     string | Date;
}

export function sendSaleAlert(bill: SaleAlertBill, items: SaleAlertItem[]): void {
  if (!isConfigured()) return;

  const dt = new Date(bill.createdAt);
  const time = dt.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
  const date = dt.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const modeEmoji  = bill.paymentMode === "upi" ? "📲" : "💵";
  const modeLabel  = bill.paymentMode === "upi" ? "UPI" : "Cash";

  const itemLines = items.map((i) => [
    `  <b>${escapeHtml(i.productName)}</b>`,
    `  ${i.quantity} × ₹${fmt(i.price)}  =  ₹${fmt(i.subtotal)}`,
  ].join("\n")).join("\n\n");

  const lines: string[] = [
    `🧾 <b>SALE INVOICE — ${escapeHtml(STORE_NAME)}</b>`,
    DIVIDER,
    `📅 ${date}  •  ${time}`,
    `🔖 <code>${escapeHtml(bill.id)}</code>`,
    bill.customerPhone ? `📞 Customer: ${escapeHtml(bill.customerPhone)}` : "",
    DIVIDER,
    `<b>ITEMS</b>`,
    ``,
    itemLines,
    ``,
    DIVIDER,
    `  ${items.length} item${items.length !== 1 ? "s" : ""}  •  ${totalUnits} unit${totalUnits !== 1 ? "s" : ""} sold`,
    DIVIDER,
    `💰 <b>TOTAL: ₹${fmt(bill.totalAmount)}</b>`,
    `${modeEmoji} Payment: <b>${modeLabel}</b>`,
    DIVIDER,
  ].filter((l) => l !== null && l !== undefined);

  sendMessage(lines.join("\n")).catch((err) =>
    logger.warn({ err }, "Telegram alert delivery error")
  );
}

export function sendTestAlert(): Promise<void> {
  if (!isConfigured()) {
    return Promise.reject(new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured"));
  }

  const dt   = new Date();
  const time = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  const date = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  const lines = [
    `🧾 <b>SALE INVOICE — ${escapeHtml(STORE_NAME)}</b>`,
    DIVIDER,
    `📅 ${date}  •  ${time}`,
    `🔖 <code>test-0000-0000-0000-sample</code>`,
    DIVIDER,
    `<b>ITEMS</b>`,
    ``,
    `  <b>Bunny Soft Toy</b>`,
    `  2 × ₹199.00  =  ₹398.00`,
    ``,
    `  <b>Lego City Set</b>`,
    `  1 × ₹1,299.00  =  ₹1,299.00`,
    ``,
    DIVIDER,
    `  2 items  •  3 units sold`,
    DIVIDER,
    `💰 <b>TOTAL: ₹1,697.00</b>`,
    `📲 Payment: <b>UPI</b>`,
    DIVIDER,
    ``,
    `<i>✅ Telegram alerts are working correctly!</i>`,
  ];

  return sendMessage(lines.join("\n"));
}
