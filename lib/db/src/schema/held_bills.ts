import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export interface HeldBillItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
  discountType?: "percent" | "amount";
  isManual?: boolean;
}

/**
 * A cashier's parked, not-yet-checked-out cart.
 *
 * Items are stored as a snapshot because prices and discounts must resume
 * exactly as the cashier left them. Holding a bill does not reserve stock;
 * normal checkout validation remains authoritative when the sale completes.
 */
export const heldBillsTable = pgTable(
  "held_bills",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons shop. */
    tenantId:     text("tenant_id"),
    customerName: text("customer_name"),
    note:         text("note"),
    items:        jsonb("items").$type<HeldBillItem[]>().notNull(),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("held_bills_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export type HeldBill = typeof heldBillsTable.$inferSelect;