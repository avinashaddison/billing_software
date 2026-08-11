import { schedule, type ScheduledTask } from "node-cron";
import { eq, sql, desc, and, or, lt, isNotNull } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, authSessionsTable, platformSettingsTable } from "@workspace/db";
import { sendDailySalesSummary, sendBackupFailureAlert, isConfigured as isTelegramConfigured } from "./telegram";
import { isR2Configured } from "./r2";
import { runDatabaseBackup } from "./backup";
import { logger } from "./logger";

const DAY_MS = 86_400_000;

/**
 * Prune the auth_sessions table so it doesn't grow unbounded (every login and
 * every legacy-cookie upgrade inserts a row, and every request reads it).
 * Deletes:
 *   - sessions revoked more than 30 days ago (the device is long gone), and
 *   - sessions not seen in 400 days (past the 365-day cookie lifetime, so the
 *     cookie is already dead — deleting the row can't log anyone out early).
 * Active, in-use sessions are never touched.
 */
export async function cleanupStaleSessions(): Promise<void> {
  const revokedCutoff = new Date(Date.now() - 30 * DAY_MS);
  const staleCutoff   = new Date(Date.now() - 400 * DAY_MS);
  try {
    await db.delete(authSessionsTable).where(or(
      and(isNotNull(authSessionsTable.revokedAt), lt(authSessionsTable.revokedAt, revokedCutoff)),
      lt(authSessionsTable.lastSeenAt, staleCutoff),
    ));
    logger.info("auth_sessions cleanup complete");
  } catch (err) {
    logger.error({ err }, "auth_sessions cleanup failed");
  }
}

async function fetchDailySummary(dateStr: string) {
  const [salesSummary] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${billsTable.totalAmount}), 0)`.as("total_amount"),
      billCount:   sql<number>`COUNT(*)`.as("bill_count"),
      itemsSold:   sql<number>`COALESCE(SUM(${billsTable.itemsCount}), 0)`.as("items_sold"),
      cashSales:   sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'cash' THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("cash_sales"),
      upiSales:    sql<string>`COALESCE(SUM(CASE WHEN ${billsTable.paymentMode} = 'upi' THEN ${billsTable.totalAmount} ELSE 0 END), 0)`.as("upi_sales"),
    })
    .from(billsTable)
    .where(sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${dateStr}`);

  const topProducts = await db
    .select({
      productName:  productsTable.name,
      totalQty:     sql<number>`SUM(${saleItemsTable.quantity})`.as("total_qty"),
      totalRevenue: sql<string>`SUM(${saleItemsTable.subtotal})`.as("total_revenue"),
    })
    .from(saleItemsTable)
    .innerJoin(productsTable, sql`${saleItemsTable.productId} = ${productsTable.id}`)
    .innerJoin(billsTable, sql`${saleItemsTable.saleId} = ${billsTable.id}`)
    .where(sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata') = ${dateStr}`)
    .groupBy(productsTable.name)
    .orderBy(desc(sql`SUM(${saleItemsTable.quantity})`))
    .limit(3);

  return {
    date:        dateStr,
    totalAmount: Number(salesSummary.totalAmount),
    billCount:   Number(salesSummary.billCount),
    itemsSold:   Number(salesSummary.itemsSold),
    cashSales:   Number(salesSummary.cashSales),
    upiSales:    Number(salesSummary.upiSales),
    topProducts: topProducts.map((p) => ({
      productName:  p.productName,
      totalQty:     Number(p.totalQty),
      totalRevenue: Number(p.totalRevenue),
    })),
  };
}

export async function runDailyReport(): Promise<void> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  logger.info({ date: today }, "Running daily sales summary report");
  const data = await fetchDailySummary(today);
  await sendDailySalesSummary(data);
  logger.info({ date: today, billCount: data.billCount }, "Daily sales summary sent to Telegram");
}

export function startDailyReportScheduler(): void {
  const hour = parseInt(process.env.DAILY_REPORT_HOUR ?? "21", 10);
  const clampedHour = Math.max(0, Math.min(23, isNaN(hour) ? 21 : hour));
  const cronExpr = `0 ${clampedHour} * * *`;

  logger.info({ cronExpr, timezone: "Asia/Kolkata" }, "Scheduling daily sales report");

  schedule(cronExpr, () => {
    runDailyReport().catch((err) =>
      logger.error({ err }, "Failed to send daily sales summary")
    );
  }, { timezone: "Asia/Kolkata" });

  /* Nightly session-table cleanup at 03:15 IST (low-traffic window). */
  schedule("15 3 * * *", () => {
    cleanupStaleSessions().catch((err) =>
      logger.error({ err }, "Failed to clean up auth_sessions")
    );
  }, { timezone: "Asia/Kolkata" });

  /* Nightly full-database backup → R2/Telegram at HH:30 IST. The hour is
     admin-configurable (platform_settings.backupHour, editable live from the
     admin panel); BACKUP_HOUR env is the fallback for fresh installs. Runs
     before the cleanup so a backup captures the pre-prune state. */
  /* A backup with nowhere to go is not a backup. Complain loudly at boot rather
     than letting the shop find out on the day it needs to restore. */
  if (!isR2Configured() && !isTelegramConfigured()) {
    logger.error(
      "DATABASE BACKUPS ARE NOT CONFIGURED — the nightly job will run but has nowhere to " +
      "store the file. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET, " +
      "or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID.",
    );
  }

  void readPersistedBackupHour().then((hour) => applyBackupSchedule(hour));
}

/* ═════════ Configurable backup schedule ═════════ */

let backupTask: ScheduledTask | null = null;
let currentBackupHour = clampHour(parseInt(process.env.BACKUP_HOUR ?? "2", 10));

function clampHour(h: number): number {
  return Math.max(0, Math.min(23, Number.isFinite(h) ? Math.trunc(h) : 2));
}

/** The persisted admin choice, falling back to BACKUP_HOUR env, then 2 AM. */
async function readPersistedBackupHour(): Promise<number> {
  try {
    const [row] = await db
      .select({ data: platformSettingsTable.data })
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.id, 1));
    const stored = (row?.data as { backupHour?: unknown } | null)?.backupHour;
    if (stored !== undefined && stored !== null && Number.isFinite(Number(stored))) {
      return clampHour(Number(stored));
    }
  } catch { /* fall through to env default */ }
  return clampHour(parseInt(process.env.BACKUP_HOUR ?? "2", 10));
}

export function getBackupHour(): number {
  return currentBackupHour;
}

/** (Re)schedule the nightly backup at HH:30 IST — replaces any existing job,
 *  so the admin panel can change the time without a server restart. */
export function applyBackupSchedule(hour: number): void {
  const h = clampHour(hour);
  backupTask?.stop();
  currentBackupHour = h;
  logger.info({ backupHour: h, timezone: "Asia/Kolkata" }, "Scheduling nightly DB backup (R2 / Telegram)");
  backupTask = schedule(`30 ${h} * * *`, () => {
    runDatabaseBackup().catch((err) => {
      logger.error({ err }, "Nightly database backup failed");
      /* Push it to Telegram too — nobody reads server logs at 2:30 AM. */
      void sendBackupFailureAlert(err instanceof Error ? err.message : String(err));
    });
  }, { timezone: "Asia/Kolkata" });
}
