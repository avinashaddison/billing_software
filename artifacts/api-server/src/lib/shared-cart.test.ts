import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { activeCartsTable, db, heldBillsTable } from "@workspace/db";
import {
  getCartSummary,
  holdActiveCart,
  resumeHeldBill,
  withCartLock,
} from "./shared-cart";

const testTenants: string[] = [];

function testTenant(label: string) {
  const tenant = `shared-cart-test:${label}:${randomUUID()}`;
  testTenants.push(tenant);
  return tenant;
}

afterAll(async () => {
  if (testTenants.length > 0) {
    await db
      .delete(activeCartsTable)
      .where(inArray(activeCartsTable.tenantId, testTenants));
    await db
      .delete(heldBillsTable)
      .where(inArray(heldBillsTable.tenantId, testTenants));
  }
});

describe("durable revisioned shared cart", () => {
  it("preserves manual lines, discounts, and tenant isolation", async () => {
    const tenantA = testTenant("a");
    const tenantB = testTenant("b");
    const start = await getCartSummary(tenantA);

    const summary = await withCartLock(tenantA, (cart) => cart.replace([
      {
        productId: "catalogue-product",
        sku: "SKU-1",
        name: "Catalogue item",
        quantity: 2,
        price: 100,
        discountType: "percent",
        discountPercent: 10,
      },
      {
        productId: "manual-test-line",
        sku: "—",
        name: "Gift wrap",
        quantity: 1,
        price: 25,
        isManual: true,
      },
    ]));

    expect(summary.revision).toBe(start.revision + 1);
    expect(summary.count).toBe(3);
    expect(summary.total).toBe(205);
    expect(summary.items[1]).toMatchObject({ isManual: true, name: "Gift wrap" });
    expect((await getCartSummary(tenantB)).items).toEqual([]);
    expect(await withCartLock(tenantA, (cart) => cart.revisionMatches(summary.revision))).toBe(true);
    expect(await withCartLock(tenantA, (cart) => cart.revisionMatches(start.revision))).toBe(false);
  }, 20_000);

  it("normalizes discount modes and advances the revision", async () => {
    const tenant = testTenant("discounts");
    const created = await withCartLock(tenant, (cart) => cart.replace([{
      productId: "product",
      sku: "SKU",
      name: "Product",
      quantity: 1,
      price: 100,
      discountType: "percent",
      discountPercent: 20,
    }]));

    const updated = await withCartLock(tenant, (cart) => cart.updateItem("product", {
      discountType: "amount",
      discountAmount: 15,
      discountPercent: 0,
    }));

    expect(updated.revision).toBe(created.revision + 1);
    expect(updated.items[0]).toMatchObject({
      discountType: "amount",
      discountAmount: 15,
    });
    expect(updated.items[0]?.discountPercent).toBeUndefined();
    expect(updated.total).toBe(85);
  }, 20_000);

  it("serializes asynchronous operations for the same tenant", async () => {
    const tenant = testTenant("lock");
    const events: string[] = [];
    let releaseFirst!: () => void;
    let signalFirstStarted!: () => void;
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const firstStarted = new Promise<void>((resolve) => { signalFirstStarted = resolve; });

    const first = withCartLock(tenant, async () => {
      events.push("first:start");
      signalFirstStarted();
      await gate;
      events.push("first:end");
    });
    await firstStarted;

    const second = withCartLock(tenant, () => {
      events.push("second");
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  }, 20_000);

  it("holds and swaps carts atomically in durable storage", async () => {
    const tenant = testTenant("hold-resume");
    const firstCart = await withCartLock(tenant, (cart) => cart.replace([{
      productId: "first",
      sku: "FIRST",
      name: "First cart item",
      quantity: 2,
      price: 50,
      discountType: "amount",
      discountAmount: 5,
    }]));

    const held = await holdActiveCart(
      tenant,
      firstCart.revision,
      { customerName: "Test customer" },
    );
    expect(held.kind).toBe("created");
    if (held.kind !== "created") throw new Error("Expected held cart");
    expect(held.summary.items).toEqual([]);

    const secondCart = await withCartLock(tenant, (cart) => cart.replace([{
      productId: "manual-second",
      sku: "—",
      name: "Second manual item",
      quantity: 1,
      price: 25,
      isManual: true,
    }]));
    const resumed = await resumeHeldBill(tenant, held.row.id, secondCart.revision);
    expect(resumed.kind).toBe("resumed");
    if (resumed.kind !== "resumed") throw new Error("Expected resumed cart");
    expect(resumed.summary.items).toEqual(firstCart.items);

    const parkedRows = await db
      .select({ items: heldBillsTable.items })
      .from(heldBillsTable)
      .where(eq(heldBillsTable.tenantId, tenant));
    expect(parkedRows).toHaveLength(1);
    expect(parkedRows[0]?.items).toEqual(secondCart.items);
  }, 20_000);
});