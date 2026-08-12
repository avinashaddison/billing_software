/**
 * Per-shop caps on staff accounts and products.
 *
 * NULL means unlimited, which is what every shop has unless the vendor
 * deliberately sets a number, so this is inert until used.
 *
 * Deliberately a count-then-insert check with no lock. Two simultaneous
 * creates on a shop sitting exactly on its cap could both pass and land one
 * row over — that is a soft commercial limit, not a security invariant, and
 * paying the cost of locking the whole staff or product set on every single
 * create would be a poor trade for a shop that is nowhere near its cap.
 */

import { and, eq, sql } from "drizzle-orm";
import { db, tenantsTable, staffProfilesTable, productsTable } from "@workspace/db";

export type LimitKind = "staff" | "products";

/**
 * Returns a shop-facing message when the cap is reached, or null when the
 * create may proceed.
 */
export async function tenantLimitBlock(tenantId: string | null, kind: LimitKind): Promise<string | null> {
  /* Legacy (pre-tenanting) sessions have no shop to cap. */
  if (!tenantId) return null;

  const [shop] = await db
    .select({ maxStaff: tenantsTable.maxStaff, maxProducts: tenantsTable.maxProducts })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!shop) return null;

  const cap = kind === "staff" ? shop.maxStaff : shop.maxProducts;
  if (cap === null || cap === undefined) return null;

  const [row] = kind === "staff"
    ? await db
        .select({ n: sql<number>`(count(*))::int` })
        .from(staffProfilesTable)
        /* Only active accounts consume a seat — a disabled member shouldn't
           block the shop from hiring a replacement. */
        .where(and(eq(staffProfilesTable.tenantId, tenantId), eq(staffProfilesTable.isActive, true)))
    : await db
        .select({ n: sql<number>`(count(*))::int` })
        .from(productsTable)
        .where(eq(productsTable.tenantId, tenantId));

  const used = row?.n ?? 0;
  if (used < cap) return null;

  return kind === "staff"
    ? `Your plan allows ${cap} staff ${cap === 1 ? "account" : "accounts"} and ${used} ${used === 1 ? "is" : "are"} already in use. Contact your vendor to raise the limit.`
    : `Your plan allows ${cap} ${cap === 1 ? "product" : "products"} and you already have ${used}. Contact your vendor to raise the limit.`;
}
