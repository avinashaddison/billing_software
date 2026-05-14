import { pgTable, uuid, integer, numeric, timestamp, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { billsTable } from "./bills";
import { productsTable } from "./products";

export const saleItemsTable = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId: text("tenant_id"),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => billsTable.id),
    productId: uuid("product_id")
      .references(() => productsTable.id),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 15, scale: 2 }).notNull(),
    mrp: numeric("mrp", { precision: 15, scale: 2 }),
    /**
     * The pre-discount unit price BEFORE the cashier applied an extra line
     * discount (i.e. the sale price if the item was on sale, or the regular
     * price otherwise). When this is greater than `price`, the difference is
     * the cashier-applied "extra" discount per unit.
     */
    preDiscountPrice: numeric("pre_discount_price", { precision: 15, scale: 2 }),
    /** "percent" or "amount" — how the cashier expressed the line discount. */
    discountType:    text("discount_type"),
    /** Raw value the cashier typed (e.g. 10 for "10%" or 50 for "₹50"). */
    discountValue:   numeric("discount_value", { precision: 15, scale: 2 }),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sale_items_tenant_idx").on(table.tenantId),
  ],
);

export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItemsTable.$inferSelect;
