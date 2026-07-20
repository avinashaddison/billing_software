import { schedule } from "node-cron";
import { sql, desc, and, or, lt, isNotNull } from "drizzle-orm";
import { db, billsTable, saleItemsTable, productsTable, authSessionsTable } from "@workspace/db";
import { sendDailySalesSummary } from "./telegram";
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

  /* Nightly full-database backup → Telegram at 02:30 IST (BACKUP_HOUR overrides
     the hour). Runs before the cleanup so a backup captures the pre-prune state. */
  const backupHour = parseInt(process.env.BACKUP_HOUR ?? "2", 10);
  const clampedBackupHour = Math.max(0, Math.min(23, isNaN(backupHour) ? 2 : backupHour));
  logger.info({ backupHour: clampedBackupHour, timezone: "Asia/Kolkata" }, "Scheduling nightly DB backup (R2 / Telegram)");
  schedule(`30 ${clampedBackupHour} * * *`, () => {
    runDatabaseBackup().catch((err) =>
      logger.error({ err }, "Nightly database backup failed")
    );
  }, { timezone: "Asia/Kolkata" });
}
