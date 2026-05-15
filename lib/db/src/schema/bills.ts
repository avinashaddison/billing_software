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
    discount:      numeric("discount", { precision: 10, scale: 2 }),
    discountType:  text("discount_type"),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bills_tenant_idx").on(table.tenantId),
    index("bills_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export const insertBillSchema = createInsertSchema(billsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;
