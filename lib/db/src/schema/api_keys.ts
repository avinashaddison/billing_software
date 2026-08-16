import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * api_keys — per-tenant credentials for the public /api/v1 surface.
 *
 * Raw keys are never stored: only the sha256 hex digest (`keyHash`).
 * `keyPrefix` holds the first characters for recognisable display.
 * `scope` is 'read' or 'write' (write implies read). `revokedAt` NULL =
 * active; rows are kept after revocation so key history stays auditable.
 */
export const apiKeysTable = pgTable(
  "api_keys",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    /** Tenant owner. NULL = legacy Hira & Sons key. */
    tenantId:   text("tenant_id"),
    name:       text("name").notNull(),
    keyHash:    text("key_hash").notNull().unique(),
    keyPrefix:  text("key_prefix").notNull(),
    scope:      text("scope").notNull().default("read"),
    /** Human label of who created it (owner email / staff name). */
    createdBy:  text("created_by").notNull().default(""),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt:  timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("api_keys_tenant_idx").on(table.tenantId, table.revokedAt),
  ],
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
