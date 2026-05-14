import { pgTable, uuid, integer, numeric, timestamp, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const salesTable = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId: text("tenant_id"),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    quantity: integer("quantity").notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sales_tenant_idx").on(table.tenantId),
  ],
);

export const insertSaleSchema = createInsertSchema(salesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
