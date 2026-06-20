import { pgTable, uuid, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { billsTable } from "./bills";

/**
 * Money-movement ledger. One row per cash/UPI payment event, so the
 * End-of-Day report can attribute each collection to the day it ACTUALLY
 * happened (not the day the bill was created).
 *
 *   kind = 'sale'       → paid at checkout (cash/UPI bills). Already counted in
 *                         cashSales/upiSales, so EOD "dues collected" ignores
 *                         these to avoid double-counting.
 *   kind = 'collection' → a later payment against an outstanding credit /
 *                         partial bill. This is exactly what "dues collected
 *                         today" sums.
 *
 * Data-integrity guards (amount > 0, kind whitelist) live in migration 0012.
 */
export const billPaymentsTable = pgTable(
  "bill_payments",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. Mirrors the bill. */
    tenantId:    text("tenant_id"),
    billId:      uuid("bill_id").notNull().references(() => billsTable.id),
    amount:      numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentMode: text("payment_mode").notNull(),
    kind:        text("kind", { enum: ["sale", "collection"] }).notNull(),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bill_payments_bill_id_idx").on(table.billId),
    index("bill_payments_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export const insertBillPaymentSchema = createInsertSchema(billPaymentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type BillPayment = typeof billPaymentsTable.$inferSelect;
