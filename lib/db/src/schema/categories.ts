import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * NOTE — multi-tenant migration:
 * `name` retains its global UNIQUE constraint to keep the existing live
 * schema intact (non-destructive migration). This means category names
 * are unique across ALL tenants during the migration window. A future
 * migration may swap this for a partial unique index keyed on
 * `(tenant_id, name)` once STRICT_TENANT is fully enabled.
 */
export const categoriesTable = pgTable(
  "categories",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId:  uuid("tenant_id"),
    name:      text("name").notNull().unique(),
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
