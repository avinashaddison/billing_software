import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";

const fake = vi.hoisted(() => ({
  rows: [] as unknown[][],
  writes: vi.fn(),
}));
vi.mock("@workspace/db", async (original) => {
  const actual = await original<Record<string, unknown>>();
  return {
    ...actual,
    db: {
      select: () => {
        const chain: Record<string, unknown> = {};
        for (const name of [
          "from",
          "where",
          "orderBy",
          "limit",
          "groupBy",
          "leftJoin",
          "innerJoin",
        ]) {
          chain[name] = () => chain;
        }
        chain.then = (resolve: (value: unknown[]) => void) =>
          resolve(fake.rows.shift() ?? []);
        return chain;
      },
      update: () => ({
        set: (values: unknown) => ({
          where: () => {
            fake.writes(values);
            return Promise.resolve([]);
          },
        }),
      }),
    },
  };
});
import { requireAuth } from "./auth";
import { dailyMoneyReadGate } from "./today-billing";
import staffRouter from "../routes/staff";
import billsRouter from "../routes/bills";

const tenantId = "test-fixture";
const staffId = "00000000-0000-0000-0000-000000000001";
const sessionId = "00000000-0000-0000-0000-000000000002";
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.staffId = staffId;
  req.tenantId = tenantId;
  req.authKind = "pin";
  req.sessionId = sessionId;
  next();
});
app.use(requireAuth);
app.use(dailyMoneyReadGate);
app.use(staffRouter);
app.use(billsRouter);
app.get("/reports/revenue", (_req, res) => res.json([{ totalAmount: 123 }]));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("No test port");
const base = `http://127.0.0.1:${address.port}`;
afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
);
beforeEach(() => {
  fake.rows.length = 0;
  fake.writes.mockClear();
});

const profile = (role = "staff", tenant = tenantId) => ({
  id: staffId,
  role,
  tenantId: tenant,
  isActive: true,
});
function validAuth(role = "staff") {
  fake.rows.push(
    [profile(role)],
    [
      {
        revokedAt: null,
        lastSeenAt: new Date(),
        lastActivityAt: new Date(),
      },
    ],
  );
}

describe("real HTTP authorization paths with a fake database (no live writes)", () => {
  it("expired owner cannot use auth/me despite the public path allowlist", async () => {
    fake.rows.push(
      [profile("owner")],
      [
        {
          revokedAt: null,
          lastSeenAt: new Date(),
          lastActivityAt: new Date(Date.now() - 600_001),
        },
      ],
    );
    const response = await fetch(`${base}/auth/me`);
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Expires=");
    expect(fake.writes).not.toHaveBeenCalled();
  });
  it("a polling last-seen bump does not revive an inactive owner", async () => {
    fake.rows.push(
      [profile("owner")],
      [
        {
          revokedAt: null,
          lastSeenAt: new Date(),
          lastActivityAt: new Date(Date.now() - 600_001),
        },
      ],
    );
    const response = await fetch(`${base}/auth/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"idleForMs":0}',
    });
    expect(response.status).toBe(401);
    expect(fake.writes).not.toHaveBeenCalled();
  });
  it("a recent owner can record interaction without background data refreshing it", async () => {
    validAuth("owner");
    const response = await fetch(`${base}/auth/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"idleForMs":12}',
    });
    expect(response.status).toBe(204);
    expect(
      fake.writes.mock.calls.some(
        ([values]) => "lastActivityAt" in (values as object),
      ),
    ).toBe(true);
  });
  it("bad activity bodies cannot extend the owner deadline", async () => {
    validAuth("owner");
    const response = await fetch(`${base}/auth/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"idleForMs":-1}',
    });
    expect(response.status).toBe(400);
    expect(
      fake.writes.mock.calls.some(
        ([values]) => "lastActivityAt" in (values as object),
      ),
    ).toBe(false);
  });
  it("staff with reports but no explicit today grant cannot call revenue API", async () => {
    validAuth();
    fake.rows.push([profile()], [{ resource: "reports", level: "write" }]);
    expect((await fetch(`${base}/reports/revenue`)).status).toBe(403);
  });
  it("staff cannot bypass a denied today-summary by requesting it directly", async () => {
    validAuth();
    fake.rows.push(
      [profile()],
      [
        { resource: "billing", level: "read" },
        { resource: "scan", level: "write" },
      ],
    );
    expect((await fetch(`${base}/bills/today-summary`)).status).toBe(403);
  });
  it("today-only staff can read the accurate summary when explicitly allowed", async () => {
    validAuth();
    fake.rows.push(
      [profile()],
      [{ resource: "todayBilling", level: "write" }],
      [{ billCount: 83, totalAmount: "9876.5" }],
    );
    const response = await fetch(`${base}/bills/today-summary`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      billCount: 83,
      totalAmount: 9876.5,
    });
  });
  it("a stale cookie cannot use an owner's role from a different tenant", async () => {
    validAuth("owner");
    fake.rows.push([profile("owner", "different-shop")]);
    expect((await fetch(`${base}/bills/today-summary`)).status).toBe(403);
  });
  it("without approval, direct reads of another cashier's today receipt are denied", async () => {
    validAuth();
    fake.rows.push(
      [{ id: staffId, createdAt: new Date(), createdByStaffId: sessionId }],
      [profile()],
      [{ resource: "scan", level: "write" }],
    );
    expect((await fetch(`${base}/bills/${staffId}`)).status).toBe(403);
  });
  it("checkout continues to validate input, rather than requiring today permission", async () => {
    validAuth();
    fake.rows.push([profile()], [{ level: "write" }]);
    const response = await fetch(`${base}/bills/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });
});
