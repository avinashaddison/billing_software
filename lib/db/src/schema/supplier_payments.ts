import { pgTable, text, uuid, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";

/**
 * Supplier payment history (simple payment log).
 *
 * One row per payment the shop makes to a supplier. Powers the "total paid"
 * rollup and the per-supplier payment history on the Suppliers page.
 */
export const supplierPaymentsTable = pgTable(
  "supplier_payments",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons row. */
    tenantId:   text("tenant_id"),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliersTable.id, { onDelete: "cascade" }),
    amount:     numeric("amount", { precision: 15, scale: 2 }).notNull(),
    method:     text("method", { enum: ["cash", "upi", "bank", "other"] }).notNull().default("cash"),
    note:       text("note"),
    /** When the payment was actually made (user-supplied; defaults to now). */
    paidAt:     timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("supplier_payments_tenant_idx").on(table.tenantId),
    index("supplier_payments_supplier_idx").on(table.supplierId),
  ],
);

export const insertSupplierPaymentSchema = createInsertSchema(supplierPaymentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSupplierPayment = z.infer<typeof insertSupplierPaymentSchema>;
export type SupplierPayment = typeof supplierPaymentsTable.$inferSelect;
