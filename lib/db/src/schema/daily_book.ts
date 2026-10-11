import { pgTable, uuid, text, boolean, date, integer, timestamp, bigint, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const dailyNotesTable = pgTable("daily_notes", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: text("tenant_id").references(() => tenantsTable.id),
  content: text("content").notNull(), entryDate: date("entry_date").notNull(),
  isTask: boolean("is_task").notNull().default(false), dueDate: date("due_date"),
  completed: boolean("completed").notNull().default(false), archived: boolean("archived").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const dailyKhataAccountsTable = pgTable("daily_khata_accounts", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: text("tenant_id").references(() => tenantsTable.id),
  name: text("name").notNull(), archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const dailyKhataEntriesTable = pgTable("daily_khata_entries", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: text("tenant_id").references(() => tenantsTable.id),
  accountId: uuid("account_id").notNull().references(() => dailyKhataAccountsTable.id),
  direction: text("direction").notNull(), amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
  entryDate: date("entry_date").notNull(), method: text("method").notNull(), note: text("note").notNull().default(""),
  voidedAt: timestamp("voided_at", { withTimezone: true }), voidReason: text("void_reason"), correctedFrom: uuid("corrected_from"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const dailyBookRequestsTable = pgTable("daily_book_requests", {
  id: uuid("id").primaryKey().defaultRandom(), tenantId: text("tenant_id").references(() => tenantsTable.id),
  requestKey: uuid("request_key").notNull(), payloadHash: text("payload_hash").notNull(),
  status: integer("status").notNull(), response: jsonb("response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
