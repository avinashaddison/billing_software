import { pgTable, text, uuid, numeric, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable(
  "products",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    name:              text("name").notNull(),
    sku:               text("sku").notNull().unique(),
    barcode:           text("barcode").unique(),
    category:          text("category").notNull(),
    price:             numeric("price", { precision: 10, scale: 2 }).notNull(),
    salePrice:         numeric("sale_price", { precision: 10, scale: 2 }),
    salePriceUntil:    timestamp("sale_price_until", { withTimezone: true }),
    /** Cashier-controlled flag: only products with this true show on the
        Today's Deals page (independent of having a sale price). */
    isTodayDeal:       boolean("is_today_deal").notNull().default(false),
    stock:             integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    purchasePrice:     numeric("purchase_price", { precision: 10, scale: 2 }),
    imageUrl:          text("image_url"),
    supplierId:        uuid("supplier_id"),
    createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_sku_idx").on(table.sku),
    index("products_barcode_idx").on(table.barcode),
  ]
);

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
