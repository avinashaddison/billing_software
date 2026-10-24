import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const scratch = vi.hoisted(() => ({
  pool: null as import("pg").Pool | null,
  db: null as NodePgDatabase | null,
}));
vi.mock("@workspace/db", async () => {
  const schema = await import("../../../../lib/db/src/schema");
  // Delegate to a real Drizzle instance once the scratch Pool is ready.
  // A pool-shaped object is NOT sufficient: Drizzle would treat it as a
  // single client and BEGIN/COMMIT could run on different pooled connections.
  const db = new Proxy({}, {
    get: (_target, property) => {
      const value = Reflect.get(scratch.db!, property);
      return typeof value === "function" ? value.bind(scratch.db) : value;
    },
  });
  return { ...schema, db };
});

import { db, heldBillsTable } from "@workspace/db";
import {
  getCartSummary,
  holdActiveCart,
  resumeHeldBill,
  withCartLock,
} from "./shared-cart";

const root = mkdtempSync(join(tmpdir(), "shared-cart-test-"));
const data = join(root, "data");
let started = false;

function testTenant(label: string) {
  return `shared-cart-test:${label}:${randomUUID()}`;
}

beforeAll(async () => {
  execFileSync("initdb", ["-D", data, "-A", "trust", "--no-locale", "--encoding=UTF8"], { stdio: "ignore" });
  execFileSync("pg_ctl", [
    "-D", data, "-l", join(root, "postgres.log"),
    "-o", `-F -h '' -k ${root} -p 55480`, "-w", "start",
  ], { stdio: "ignore" });
  started = true;
  scratch.pool = new pg.Pool({ host: root, port: 55480, user: userInfo().username, database: "postgres" });
  scratch.db = drizzle(scratch.pool);
  for (const name of ["0019_held_bills.sql", "0020_active_carts.sql"]) {
    const migration = readFileSync(new URL(`../../../../lib/db/migrations/${name}`, import.meta.url), "utf8");
    await scratch.pool.query(migration);
  }
}, 30_000);

afterAll(async () => {
  await scratch.pool?.end();
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
  rmSync(root, { recursive: true, force: true });
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