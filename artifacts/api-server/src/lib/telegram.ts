import { eq, isNull } from "drizzle-orm";
import { db, tenantTelegramSettingsTable, storeSettingsTable } from "@workspace/db";
import { logger } from "./logger";

const API_BASE   = "https://api.telegram.org";
const STORE_NAME = process.env.STORE_NAME || "Toy Mall";

const D_HEAVY = "▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰";
const D_THIN  = "─  ─  ─  ─  ─  ─  ─  ─  ─  ─  ─";

export function splitChatIds(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function getChatIds(): string[] {
  return splitChatIds(process.env.TELEGRAM_CHAT_ID ?? "");
}

export interface TelegramConfig {
  token:   string;
  chatIds: string[];
  /** "tenant" = the shop's own bot from Settings; "global" = env fallback. */
  source:  "tenant" | "global";
}

function envConfig(): TelegramConfig | null {
  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getChatIds();
  if (!token || chatIds.length === 0) return null;
  return { token, chatIds, source: "global" };
}

/**
 * Resolve the delivery config for a tenant's alerts: the tenant's own
 * enabled row wins; otherwise the global env config (legacy behaviour).
 * A DB error also falls back to env — an alert should degrade, not vanish.
 */
export async function resolveConfig(tenantId: string | null): Promise<TelegramConfig | null> {
  if (tenantId) {
    try {
      const [row] = await db
        .select()
        .from(tenantTelegramSettingsTable)
        .where(eq(tenantTelegramSettingsTable.tenantId, tenantId));
      if (row?.enabled) {
        const chatIds = splitChatIds(row.chatIds);
        if (row.botToken && chatIds.length > 0) {
          return { token: row.botToken, chatIds, source: "tenant" };
        }
      }
    } catch (err) {
      logger.warn({ err, tenantId }, "tenant telegram config lookup failed — falling back to env");
    }
  }
  return envConfig();
}

/** The shop name for a tenant's alert header (store_settings.data.name),
 *  falling back to the env STORE_NAME used by the legacy install. */
async function resolveStoreName(tenantId: string | null): Promise<string> {
  try {
    const [row] = await db
      .select({ data: storeSettingsTable.data })
      .from(storeSettingsTable)
      .where(tenantId == null
        ? isNull(storeSettingsTable.tenantId)
        : eq(storeSettingsTable.tenantId, tenantId))
      .limit(1);
    const name = (row?.data as { name?: unknown } | null)?.name;
    if (typeof name === "string" && name.trim()) return name.trim();
  } catch (err) {
    logger.warn({ err, tenantId }, "store name lookup failed for telegram alert");
  }
  return STORE_NAME;
}

export function isConfigured(): boolean {
  return envConfig() !== null;
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

async function deliver(config: TelegramConfig, text: string): Promise<void> {
  await Promise.all(config.chatIds.map((id) => sendToOne(config.token, id, text)));
}

/** Env-config-only send — used by the vendor-level surfaces (cross-tenant
 *  daily report). Per-tenant alerts go through resolveConfig() + deliver(). */
async function sendMessage(text: string): Promise<void> {
  const config = envConfig();
  if (!config) return;
  await deliver(config, text);
}

/**
 * Alert when a nightly database backup fails.
 *
 * A backup that quietly stops working looks exactly like one that is working,
 * right up until the day it is needed — which is the worst possible moment to
 * discover the difference. Failures used to go to the log only, where nobody
 * was watching.
 *
 * Best-effort by design: this must never throw back into the scheduler and
 * mask the original failure.
 */
export async function sendBackupFailureAlert(reason: string): Promise<void> {
  try {
    await sendMessage(
      "🚨 <b>Database backup FAILED</b>\n\n" +
      `<code>${escapeHtml(reason).slice(0, 500)}</code>\n\n` +
      "Tonight's backup did not complete. Please check the server logs — " +
      "the shop is running without a fresh restore point until this is fixed."
    );
  } catch (err) {
    logger.warn({ err }, "could not deliver backup-failure alert");
  }
}

/**
 * Send a file (e.g. a gzipped DB backup) as a Telegram document to every
 * configured chat — or an explicit override list (BACKUP_TELEGRAM_CHAT_ID).
 * Uses multipart/form-data via the global FormData/Blob (Node 18+). Silently
 * no-ops when unconfigured. Telegram's bot document limit is ~50 MB.
 */
export async function sendDocument(
  filename: string,
  content: Buffer,
  caption: string,
  chatIdsOverride?: string[],
): Promise<void> {
  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = chatIdsOverride && chatIdsOverride.length > 0 ? chatIdsOverride : getChatIds();
  if (!token || chatIds.length === 0) return;
  for (const chatId of chatIds) {
    try {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption.slice(0, 1024));
      form.append("parse_mode", "HTML");
      form.append("document", new Blob([new Uint8Array(content)]), filename);
      const res = await fetch(`${API_BASE}/bot${token}/sendDocument`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn({ status: res.status, chatId, body }, "Telegram sendDocument failed");
      }
    } catch (err) {
      logger.warn({ err, chatId }, "Telegram sendDocument error");
    }
  }
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

export function sendSaleAlert(tenantId: string | null, bill: SaleAlertBill, items: SaleAlertItem[]): void {
  void (async () => {
    const config = await resolveConfig(tenantId);
    if (!config) return;
    const storeName = await resolveStoreName(tenantId);
    await deliver(config, buildSaleAlertText(storeName, bill, items));
  })().catch((err) => logger.warn({ err }, "Telegram alert delivery error"));
}

function buildSaleAlertText(storeName: string, bill: SaleAlertBill, items: SaleAlertItem[]): string {
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
    `🏪  <b>${escapeHtml(storeName)}</b>`,
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

  return lines.join("\n");
}

export async function sendTestAlert(tenantId: string | null): Promise<void> {
  const config = await resolveConfig(tenantId);
  if (!config) {
    throw new Error("Telegram is not configured");
  }
  const storeName = await resolveStoreName(tenantId);

  const dt   = new Date();
  const time = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  const date = dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

  const lines = [
    `🧾 <b>━━  SALE INVOICE  ━━</b> 🧾`,
    `🏪  <b>${escapeHtml(storeName)}</b>`,
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

  await deliver(config, lines.join("\n"));
}

export interface LowStockAlertItem {
  productName: string;
  stock:       number;
  threshold:   number;
}

export function sendLowStockAlert(tenantId: string | null, items: LowStockAlertItem[]): void {
  if (items.length === 0) return;

  const lines = items
    .map((i) => `⚠️ Low Stock: "${escapeHtml(i.productName)}" — only ${i.stock} unit${i.stock === 1 ? "" : "s"} left`)
    .join("\n");

  void (async () => {
    const config = await resolveConfig(tenantId);
    if (!config) return;
    await deliver(config, lines);
  })().catch((err) => logger.warn({ err }, "Telegram low-stock alert delivery error"));
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
