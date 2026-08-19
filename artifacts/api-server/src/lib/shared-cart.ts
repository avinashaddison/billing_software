/* ── Durable shared cart (tenant-keyed) ─────────────────────────────
   The active cart and its monotonic revision live in PostgreSQL. Every
   mutation takes a transaction-scoped advisory lock derived from the tenant
   key, so separate Node processes serialize the same tenant's cart.
──────────────────────────────────────────────────────────────────── */

import { and, eq } from "drizzle-orm";
import {
  activeCartsTable,
  db,
  heldBillsTable,
  type HeldBill,
  type HeldBillItem,
} from "@workspace/db";
import { tenantWhereWrite } from "./tenant";
import { effectiveHeldBillItemPrice } from "./held-bills";

export type SharedCartItem = HeldBillItem;

export interface CartSummary {
  items: SharedCartItem[];
  revision: number;
  count: number;
  total: number;
}

export interface LockedCart {
  getSummary: () => CartSummary;
  revisionMatches: (expectedRevision: number) => boolean;
  addOrIncrement: (
    item: Omit<SharedCartItem, "quantity">,
    quantity?: number,
  ) => Promise<CartSummary>;
  updateItem: (
    productId: string,
    patch: Partial<Pick<
      SharedCartItem,
      "quantity" | "discountType" | "discountPercent" | "discountAmount"
    >>,
  ) => Promise<CartSummary>;
  removeItem: (productId: string) => Promise<CartSummary>;
  replace: (items: SharedCartItem[]) => Promise<CartSummary>;
  clear: () => Promise<CartSummary>;
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function keyFor(tenantId: string | null | undefined): string {
  return tenantId ? `tenant:${tenantId}` : "tenant:__legacy_null__";
}

function cloneItems(items: SharedCartItem[]): SharedCartItem[] {
  return items.map((item) => ({ ...item }));
}

function summarize(items: SharedCartItem[], revision: number): CartSummary {
  const cloned = cloneItems(items);
  return {
    items: cloned,
    revision,
    count: cloned.reduce((sum, item) => sum + item.quantity, 0),
    total: cloned.reduce(
      (sum, item) => sum + effectiveHeldBillItemPrice(item) * item.quantity,
      0,
    ),
  };
}

async function withCartTransaction<T>(
  tenantId: string | null | undefined,
  operation: (cart: LockedCart, tx: DbTransaction) => Promise<T> | T,
): Promise<T> {
  const normalizedTenantId = tenantId ?? null;
  const cartKey = keyFor(normalizedTenantId);

  return db.transaction(async (tx) => {
    // INSERT creates a first cart; the no-op conflict UPDATE takes a row lock
    // and returns the latest committed snapshot. That lock lasts until this
    // transaction commits, serializing this tenant across every API replica.
    const [row] = await tx
      .insert(activeCartsTable)
      .values({
        cartKey,
        tenantId: normalizedTenantId,
        items: [],
        revision: 0,
      })
      .onConflictDoUpdate({
        target: activeCartsTable.cartKey,
        set: { cartKey },
      })
      .returning({
        items: activeCartsTable.items,
        revision: activeCartsTable.revision,
      });

    if (!row) throw new Error("Unable to initialise active cart");

    let items = cloneItems(row.items);
    let revision = row.revision;

    const persist = async (nextItems: SharedCartItem[]): Promise<CartSummary> => {
      items = cloneItems(nextItems);
      revision += 1;
      await tx
        .update(activeCartsTable)
        .set({
          items,
          revision,
          updatedAt: new Date(),
        })
        .where(eq(activeCartsTable.cartKey, cartKey));
      return summarize(items, revision);
    };

    const cart: LockedCart = {
      getSummary: () => summarize(items, revision),
      revisionMatches: (expectedRevision) => revision === expectedRevision,
      addOrIncrement: async (item, quantity = 1) => {
        const next = cloneItems(items);
        const existing = next.find((candidate) => candidate.productId === item.productId);
        if (existing) existing.quantity += quantity;
        else next.push({ ...item, quantity });
        return persist(next);
      },
      updateItem: async (productId, patch) => {
        const next = cloneItems(items);
        const index = next.findIndex((item) => item.productId === productId);
        if (index === -1) return summarize(items, revision);
        if (patch.quantity !== undefined && patch.quantity <= 0) {
          next.splice(index, 1);
        } else {
          const updated = { ...next[index], ...patch };
          if (patch.discountType === "amount") {
            updated.discountPercent = undefined;
            updated.discountAmount = patch.discountAmount || undefined;
          } else if (patch.discountType === "percent") {
            updated.discountAmount = undefined;
            updated.discountPercent = patch.discountPercent || undefined;
          }
          next[index] = updated;
        }
        return persist(next);
      },
      removeItem: async (productId) => {
        const next = items.filter((item) => item.productId !== productId);
        if (next.length === items.length) return summarize(items, revision);
        return persist(next);
      },
      replace: (nextItems) => persist(nextItems),
      clear: () => persist([]),
    };

    return operation(cart, tx);
  });
}

/** Serialize an arbitrary cart operation across all API replicas. */
export async function withCartLock<T>(
  tenantId: string | null | undefined,
  operation: (cart: LockedCart) => Promise<T> | T,
): Promise<T> {
  return withCartTransaction(tenantId, (cart) => operation(cart));
}

export async function getCartSummary(
  tenantId: string | null | undefined = null,
): Promise<CartSummary> {
  const [row] = await db
    .select({
      items: activeCartsTable.items,
      revision: activeCartsTable.revision,
    })
    .from(activeCartsTable)
    .where(eq(activeCartsTable.cartKey, keyFor(tenantId)))
    .limit(1);
  if (row) return summarize(row.items, row.revision);
  return summarize([], 0);
}

export type HoldActiveCartResult =
  | { kind: "conflict"; cart: CartSummary }
  | { kind: "empty" }
  | { kind: "created"; row: HeldBill; summary: CartSummary };

export async function holdActiveCart(
  tenantId: string | null | undefined,
  expectedRevision: number,
  metadata: { customerName?: string; note?: string },
): Promise<HoldActiveCartResult> {
  return withCartTransaction(tenantId, async (cart, tx) => {
    const active = cart.getSummary();
    if (!cart.revisionMatches(expectedRevision)) {
      return { kind: "conflict" as const, cart: active };
    }
    if (active.items.length === 0) return { kind: "empty" as const };

    const [row] = await tx
      .insert(heldBillsTable)
      .values({
        tenantId: tenantId ?? null,
        customerName: metadata.customerName || null,
        note: metadata.note || null,
        items: active.items,
      })
      .returning();
    if (!row) throw new Error("Unable to create held bill");

    return {
      kind: "created" as const,
      row,
      summary: await cart.clear(),
    };
  });
}

export type ResumeHeldBillResult =
  | { kind: "conflict"; cart: CartSummary }
  | { kind: "missing" }
  | { kind: "resumed"; selected: HeldBill; summary: CartSummary };

export async function resumeHeldBill(
  tenantId: string | null | undefined,
  heldBillId: string,
  expectedRevision: number,
): Promise<ResumeHeldBillResult> {
  return withCartTransaction(tenantId, async (cart, tx) => {
    const active = cart.getSummary();
    if (!cart.revisionMatches(expectedRevision)) {
      return { kind: "conflict" as const, cart: active };
    }

    const [selected] = await tx
      .delete(heldBillsTable)
      .where(and(
        eq(heldBillsTable.id, heldBillId),
        tenantWhereWrite(heldBillsTable.tenantId, tenantId ?? null),
      ))
      .returning();
    if (!selected) return { kind: "missing" as const };

    if (active.items.length > 0) {
      await tx.insert(heldBillsTable).values({
        tenantId: tenantId ?? null,
        note: "Cart automatically held while resuming another bill",
        items: active.items,
      });
    }

    return {
      kind: "resumed" as const,
      selected,
      summary: await cart.replace(selected.items),
    };
  });
}