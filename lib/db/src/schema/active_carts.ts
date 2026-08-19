import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { HeldBillItem } from "./held_bills";

/**
 * The tenant's one active checkout cart.
 *
 * Keeping the snapshot and its CAS revision in PostgreSQL makes cart changes
 * visible to every API replica and lets hold/resume update durable state in
 * the same transaction as the held-bill row.
 */
export const activeCartsTable = pgTable(
  "active_carts",
  {
    /** Deterministic tenant key; also represents the legacy NULL tenant. */
    cartKey: text("cart_key").primaryKey(),
    tenantId: text("tenant_id"),
    items: jsonb("items").$type<HeldBillItem[]>().notNull().default([]),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("active_carts_tenant_idx").on(table.tenantId),
  ],
);

export type ActiveCart = typeof activeCartsTable.$inferSelect;