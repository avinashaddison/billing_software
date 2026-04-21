import { logger } from "./logger";

const API_BASE   = "https://api.telegram.org";
const STORE_NAME = process.env.STORE_NAME || "Toy Mall";

const D_HEAVY = "▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰";
const D_THIN  = "─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─";

function getChatIds(): string[] {
  const raw = process.env.TELEGRAM_CHAT_ID ?? "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && getChatIds().length > 0);
}

export function recipientCount(): number {
  return getChatIds().length;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmt(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function row(label: string, value: string): string {
  return `${label}  <b>${value}</b>`;
}

async function sendToOne(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, chatId, body }, "Telegram sendMessage failed");
  }
}

async function sendMessage(text: string): Promise<void> {
  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getChatIds();
  if (!token || chatIds.length === 0) return;
  await Promise.all(chatIds.map((id) => sendToOne(token, id, text)));
}

export interface SaleAlertItem {
  productName: string;
  quantity:    number;
  price:       number;
  subtotal:    number;
}

export interface SaleAlertBill {
  id:             string;
  billNumber:     number;
  totalAmount:    number;
  itemsCount:     number;
  paymentMode:    string;
  customerPhone?: string | null;
  createdAt:      string | Date;
}

export function sendSaleAlert(bill: SaleAlertBill, items: SaleAlertItem[]): void {
  if (!isConfigured()) return;

  const dt = new Date(bill.createdAt);
  const time = dt.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
  const date = dt.toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const modeEmoji  = bill.paymentMode === "upi" ? "📲" : "💵";
  const modeLabel  = bill.paymentMode === "upi" ? "UPI" : "Cash";

  const itemLines = items.map((i, idx) => [
    `${idx + 1}. <b>${escapeHtml(i.productName)}</b>`,
    `    ▸ ${i.quantity} pc${i.quantity > 1 ? "s" : ""}  ×  ${fmt(i.price)}  <b>=  ${fmt(i.subtotal)}</b>`,
  ].join("\n")).join("\n\n");

  const lines = [
    `🧾 <b>━━  SALE INVOICE  ━━</b> 🧾`,
    `🏪  <b>${escapeHtml(STORE_NAME)}</b>`,
    D_HEAVY,
    ``,
    row(`📅`, `${date}  •  ${time}`),
    row(`🔖  Bill No  :`, `#${bill.billNumber}`),
    `🆔  Ref  :  <code>${escapeHtml(bill.id.slice(0, 8).toUpperCase())}</code>`,
    bill.customerPhone
      ? row(`📞  Customer :`, escapeHtml(bill.customerPhone))
      : null,
    ``,
    D_THIN,
    `🛍  <b>ITEMS PURCHASED</b>`,
    D_THIN,
    ``,
    itemLines,
    ``,
    D_THIN,
    `📦  ${items.length} item${items.length !== 1 ? "s" : ""}   •   📊  ${totalUnits} unit${totalUnits !== 1 ? "s" : ""} sold`,
    D_THIN,
    ``,
    `💰  <b>GRAND TOTAL  :  ${fmt(bill.totalAmount)}</b>`,
    `${modeEmoji}  <b>Payment Mode :  ${modeLabel}</b>`,
    ``,
    D_HEAVY,
    `       ✨  <i>Thank you! Visit Again</i>  ✨`,
    D_HEAVY,
  ].filter((l): l is string => l !== null);

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
  const date = dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  const lines = [
    `🧾 <b>━━  SALE INVOICE  ━━</b> 🧾`,
    `🏪  <b>${escapeHtml(STORE_NAME)}</b>`,
    D_HEAVY,
    ``,
    row(`📅`, `${date}  •  ${time}`),
    row(`🔖  Bill No  :`, `#99 (TEST)`),
    `🆔  Ref  :  <code>TEST0000</code>`,
    row(`📞  Customer :`, `9142644479`),
    ``,
    D_THIN,
    `🛍  <b>ITEMS PURCHASED</b>`,
    D_THIN,
    ``,
    `1. <b>Bunny Soft Toy</b>`,
    `    ▸ 2 pcs  ×  ₹199.00  <b>=  ₹398.00</b>`,
    ``,
    `2. <b>Lego City Set</b>`,
    `    ▸ 1 pc  ×  ₹1,299.00  <b>=  ₹1,299.00</b>`,
    ``,
    D_THIN,
    `📦  2 items   •   📊  3 units sold`,
    D_THIN,
    ``,
    `💰  <b>GRAND TOTAL  :  ₹1,697.00</b>`,
    `📲  <b>Payment Mode :  UPI</b>`,
    ``,
    D_HEAVY,
    `       ✨  <i>Thank you! Visit Again</i>  ✨`,
    D_HEAVY,
    ``,
    `<i>✅ Telegram alerts are working correctly!</i>`,
  ];

  return sendMessage(lines.join("\n"));
}

export interface LowStockAlertItem {
  productName: string;
  stock:       number;
  threshold:   number;
}

export function sendLowStockAlert(items: LowStockAlertItem[]): void {
  if (!isConfigured() || items.length === 0) return;

  const lines = items
    .map((i) => `⚠️ Low Stock: "${escapeHtml(i.productName)}" — only ${i.stock} unit${i.stock === 1 ? "" : "s"} left`)
    .join("\n");

  sendMessage(lines).catch((err) =>
    logger.warn({ err }, "Telegram low-stock alert delivery error")
  );
}

export interface DailySummaryTopProduct {
  productName: string;
  totalQty:    number;
  totalRevenue: number;
}

export interface DailySummaryData {
  date:        string;
  totalAmount: number;
  billCount:   number;
  itemsSold:   number;
  cashSales:   number;
  upiSales:    number;
  topProducts: DailySummaryTopProduct[];
}

export function sendDailySalesSummary(data: DailySummaryData): Promise<void> {
  if (!isConfigured()) return Promise.resolve();

  const { date, totalAmount, billCount, itemsSold, cashSales, upiSales, topProducts } = data;

  const [year, month, day] = date.split("-");
  const dateLabel = new Date(`${year}-${month}-${day}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });

  if (billCount === 0) {
    const lines = [
      `📊 <b>━━  DAILY SALES REPORT  ━━</b> 📊`,
      `🏪  <b>${escapeHtml(STORE_NAME)}</b>`,
      D_HEAVY,
      ``,
      row(`📅`, escapeHtml(dateLabel)),
      ``,
      `🔕  <i>No sales recorded today.</i>`,
      ``,
      D_HEAVY,
    ];
    return sendMessage(lines.join("\n"));
  }

  const topLines = topProducts.slice(0, 3).map((p, idx) => {
    const medal = ["🥇", "🥈", "🥉"][idx] ?? `${idx + 1}.`;
    return `${medal}  <b>${escapeHtml(p.productName)}</b>  —  ${p.totalQty} unit${p.totalQty !== 1 ? "s" : ""}  (${fmt(p.totalRevenue)})`;
  });

  const lines = [
    `📊 <b>━━  DAILY SALES REPORT  ━━</b> 📊`,
    `🏪  <b>${escapeHtml(STORE_NAME)}</b>`,
    D_HEAVY,
    ``,
    row(`📅`, escapeHtml(dateLabel)),
    ``,
    D_THIN,
    `💰  <b>REVENUE SUMMARY</b>`,
    D_THIN,
    ``,
    row(`🧾  Total Revenue  :`, fmt(totalAmount)),
    row(`🔖  Bills Raised   :`, String(billCount)),
    row(`📦  Items Sold     :`, String(itemsSold)),
    ``,
    row(`💵  Cash           :`, fmt(cashSales)),
    row(`📲  UPI            :`, fmt(upiSales)),
    ``,
    ...(topLines.length > 0 ? [
      D_THIN,
      `🏆  <b>TOP PRODUCTS</b>`,
      D_THIN,
      ``,
      ...topLines,
      ``,
    ] : []),
    D_HEAVY,
    `       ✨  <i>End of Day — Great job today!</i>  ✨`,
    D_HEAVY,
  ];

  return sendMessage(lines.join("\n"));
}
