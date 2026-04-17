import { pgTable, uuid, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { billsTable } from "./bills";
import { productsTable } from "./products";

export const returnsTable = pgTable("returns", {
  id:           uuid("id").primaryKey().defaultRandom(),
  billId:       uuid("bill_id").notNull().references(() => billsTable.id),
  productId:    uuid("product_id").notNull().references(() => productsTable.id),
  quantity:     integer("quantity").notNull(),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull(),
  reason:       text("reason").notNull().default("customer_return"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReturnSchema = createInsertSchema(returnsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returnsTable.$inferSelect;
