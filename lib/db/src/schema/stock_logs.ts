import { pgTable, text, uuid, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const stockLogsTable = pgTable(
  "stock_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId: text("tenant_id"),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    /** RETURN = customer return restock — kept distinct from IN so supplier
     *  purchase reports don't count returned goods as purchases. */
    type: text("type", { enum: ["IN", "OUT", "ADJUSTMENT", "RETURN"] }).notNull(),
    quantity: integer("quantity").notNull(),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stock_logs_tenant_idx").on(table.tenantId),
    index("stock_logs_product_id_idx").on(table.productId),
  ],
);

export const insertStockLogSchema = createInsertSchema(stockLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertStockLog = z.infer<typeof insertStockLogSchema>;
export type StockLog = typeof stockLogsTable.$inferSelect;
