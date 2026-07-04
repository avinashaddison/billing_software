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
    /**
     * Pointer to the product this line came from. NULL when the line is a
     * MANUAL / NON-INVENTORY item (e.g. a gift brought from outside, an
     * ad-hoc service charge). For manual lines we store the human label in
     * `customName` instead. Exactly one of (productId, customName) is set —
     * enforced by a DB CHECK constraint.
     */
    productId: uuid("product_id")
      .references(() => productsTable.id),
    /**
     * Display name for a MANUAL line item. NULL on regular catalogue lines.
     * Bills, receipts and customer history fall back to this when productId
     * is NULL so the line still prints with a meaningful description.
     */
    customName: text("custom_name"),
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
    /**
     * Cost-price snapshot at sale time (products.purchase_price when the
     * bill was raised). Profit reports use this so later cost edits don't
     * rewrite history. NULL on manual lines and on rows sold before the
     * column existed — reports fall back to the product's current cost.
     */
    purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sale_items_tenant_idx").on(table.tenantId),
    index("sale_items_sale_id_idx").on(table.saleId),
    index("sale_items_product_id_idx").on(table.productId),
  ],
);

export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItemsTable.$inferSelect;
