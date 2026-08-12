import { pgTable, text, uuid, numeric, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Money a SHOP paid the VENDOR for platform access.
 *
 * Do not confuse this with the two other money tables:
 *   - `bill_payments`     — a shop's customer paying that shop.
 *   - `supplier_payments` — a shop paying its supplier.
 *   - `tenant_payments`   — a shop paying *us*. This one.
 *
 * `coversDays` / `coversUntil` snapshot what the payment bought at the moment
 * it was taken, so later changes to the shop's expiry never rewrite the
 * accounting history.
 *
 * Indexes and the `amount > 0` check live in migration 0017 (SQL is the source
 * of truth for those; this file exists for types).
 */
export const tenantPaymentsTable = pgTable("tenant_payments", {
  id:              uuid("id").primaryKey().defaultRandom(),
  tenantId:        text("tenant_id").notNull(),
  amount:          numeric("amount", { precision: 15, scale: 2 }).notNull(),
  method:          text("method").notNull().default("cash"),
  note:            text("note"),
  coversDays:      integer("covers_days"),
  coversUntil:     timestamp("covers_until", { withTimezone: true }),
  paidAt:          timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  recordedByEmail: text("recorded_by_email"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TenantPaymentRow = typeof tenantPaymentsTable.$inferSelect;
