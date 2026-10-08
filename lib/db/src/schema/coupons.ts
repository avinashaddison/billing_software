import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { billsTable } from "./bills";

export const couponsTable = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").references(() => tenantsTable.id),
  code: text("code").notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: numeric("discount_value", {
    precision: 10,
    scale: 2,
  }).notNull(),
  maxUses: integer("max_uses").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const couponRedemptionsTable = pgTable("coupon_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").references(() => tenantsTable.id),
  couponId: uuid("coupon_id")
    .notNull()
    .references(() => couponsTable.id),
  customerPhone: text("customer_phone").notNull(),
  billId: uuid("bill_id").references(() => billsTable.id, {
    onDelete: "set null",
  }),
  discountAmount: numeric("discount_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
