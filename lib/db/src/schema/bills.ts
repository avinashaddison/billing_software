import { pgTable, uuid, numeric, integer, timestamp, varchar, serial, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billsTable = pgTable(
  "bills",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId:      text("tenant_id"),
    billNumber:    serial("bill_number").notNull(),
    totalAmount:   numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    itemsCount:    integer("items_count").notNull(),
    /** Optional customer name captured at checkout. Printed on the receipt. */
    customerName:  text("customer_name"),
    customerPhone: varchar("customer_phone", { length: 10 }),
    paymentMode:   varchar("payment_mode", { length: 10 }).notNull().default("cash"),
    /** How much of `totalAmount` has been collected. Equals totalAmount for
     *  fully-paid cash/UPI bills; 0 for fresh credit sales; somewhere in
     *  between for partial payments. */
    amountPaid:    numeric("amount_paid", { precision: 15, scale: 2 }).notNull().default("0"),
    /** Derived from amountPaid vs totalAmount but stored so the receivables
     *  query can hit a partial index instead of computing on every row. */
    paymentStatus: varchar("payment_status", { length: 10 }).notNull().default("paid"),
    /** Raw value the cashier typed (e.g. 10 for "10%" or 50 for "₹50"). */
    discount:      numeric("discount", { precision: 10, scale: 2 }),
    discountType:  text("discount_type"),
    /** The actual rupee discount applied (clamped, percent resolved against
     *  the pre-discount subtotal). Reports MUST use this, not `discount`. */
    discountAmount: numeric("discount_amount", { precision: 15, scale: 2 }),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bills_tenant_idx").on(table.tenantId),
    index("bills_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("bills_tenant_status_idx").on(table.tenantId, table.paymentStatus),
    index("bills_customer_phone_idx").on(table.customerPhone),
  ],
);

export const insertBillSchema = createInsertSchema(billsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;
