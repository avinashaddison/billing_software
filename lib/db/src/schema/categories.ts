import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * NOTE — multi-tenant uniqueness:
 * Category `name` uniqueness is enforced PER TENANT via migration 0010
 * (categories_tenant_name_uq), NOT a global UNIQUE — so each shop can have
 * its own "Toys"/"Snacks" category without colliding with another shop.
 * Legacy NULL-tenant rows are grouped under a sentinel in that index.
 */
export const categoriesTable = pgTable(
  "categories",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId:  text("tenant_id"),
    name:      text("name").notNull(),
    emoji:     text("emoji").notNull().default("🎁"),
    skuCode:   text("sku_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("categories_tenant_idx").on(table.tenantId),
  ],
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true, createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
