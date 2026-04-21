import { pgTable, uuid, numeric, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billsTable = pgTable("bills", {
  id:            uuid("id").primaryKey().defaultRandom(),
  totalAmount:   numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  itemsCount:    integer("items_count").notNull(),
  customerPhone: varchar("customer_phone", { length: 10 }),
  paymentMode:   varchar("payment_mode", { length: 10 }).notNull().default("cash"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBillSchema = createInsertSchema(billsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;
