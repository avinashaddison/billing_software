import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppliersTable = pgTable(
  "suppliers",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId:  text("tenant_id"),
    name:      text("name").notNull(),
    contact:   text("contact"),
    email:     text("email"),
    phone:     text("phone"),
    address:   text("address"),
    notes:     text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("suppliers_tenant_idx").on(table.tenantId),
  ],
);

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
