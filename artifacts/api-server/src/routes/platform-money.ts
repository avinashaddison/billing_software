/**
 * The vendor's own income: what shops paid FOR the platform.
 *
 * The app was full of money tables and none of them were the vendor's. Bills,
 * bill_payments and supplier_payments all describe a shop's trading. This
 * router covers the one flow nobody was recording — shop pays vendor for
 * access — and answers "what did I earn this month" and "who is about to
 * expire without paying".
 *
 * All month boundaries are computed in Asia/Kolkata inside SQL, so a payment
 * taken at 1am IST on the 1st lands in the right month regardless of where
 * the server runs.
 */

import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, tenantPaymentsTable, tenantsTable } from "@workspace/db";
import { recordAudit } from "../lib/audit";
import { requirePlatformAdmin } from "../middlewares/platform-admin";

const router: IRouter = Router();

const VALID_METHODS = new Set(["cash", "upi", "bank", "card", "other"]);

/** Calendar month of a payment, on the Indian calendar. */
const istMonth = sql<string>`to_char(date_trunc('month', ${tenantPaymentsTable.paidAt} AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM')`;

function parseAmount(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return null;
  return Math.round(n * 100) / 100;
}

/* ───── GET /api/platform/payments ────────────────────────────────────
 * Everything the money page needs in one call: recent payments, income by
 * month, headline totals, and who is due to renew. */
router.get("/platform/payments", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantFilter = typeof req.query.tenantId === "string" && req.query.tenantId ? req.query.tenantId : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  try {
    const payments = await db
      .select({
        id:          tenantPaymentsTable.id,
        tenantId:    tenantPaymentsTable.tenantId,
        shopName:    tenantsTable.name,
        amount:      tenantPaymentsTable.amount,
        method:      tenantPaymentsTable.method,
        note:        tenantPaymentsTable.note,
        coversDays:  tenantPaymentsTable.coversDays,
        coversUntil: tenantPaymentsTable.coversUntil,
        paidAt:      tenantPaymentsTable.paidAt,
        recordedBy:  tenantPaymentsTable.recordedByEmail,
      })
      .from(tenantPaymentsTable)
      .leftJoin(tenantsTable, eq(tenantsTable.id, tenantPaymentsTable.tenantId))
      .where(tenantFilter ? eq(tenantPaymentsTable.tenantId, tenantFilter) : sql`true`)
      .orderBy(desc(tenantPaymentsTable.paidAt))
      .limit(limit);

    /* Totals must span every payment, not just the page above. */
    const byMonth = await db
      .select({
        month: istMonth.as("month"),
        total: sql<string>`coalesce(sum(${tenantPaymentsTable.amount}), 0)`,
        count: sql<number>`(count(*))::int`,
      })
      .from(tenantPaymentsTable)
      .where(tenantFilter ? eq(tenantPaymentsTable.tenantId, tenantFilter) : sql`true`)
      .groupBy(istMonth)
      .orderBy(sql`1 desc`)
      .limit(13);

    const [totals] = await db
      .select({
        allTime: sql<string>`coalesce(sum(${tenantPaymentsTable.amount}), 0)`,
        count:   sql<number>`(count(*))::int`,
        payingShops: sql<number>`(count(distinct ${tenantPaymentsTable.tenantId}))::int`,
      })
      .from(tenantPaymentsTable)
      .where(tenantFilter ? eq(tenantPaymentsTable.tenantId, tenantFilter) : sql`true`);

    /* Shops whose access has run out, or runs out within a fortnight. Lifetime
       shops (expiresAt NULL) are excluded — they are never "due".
       Payment history is joined in JS rather than as a correlated subquery:
       drizzle renders a bare column reference in the select list, which breaks
       the correlation. */
    const dueShops = await db
      .select({
        id:        tenantsTable.id,
        name:      tenantsTable.name,
        isActive:  tenantsTable.isActive,
        expiresAt: tenantsTable.expiresAt,
      })
      .from(tenantsTable)
      .where(sql`${tenantsTable.expiresAt} is not null and ${tenantsTable.expiresAt} < now() + interval '14 days'`)
      .orderBy(tenantsTable.expiresAt);

    const paidByShop = new Map<string, { lastPaidAt: Date | null; paidTotal: string }>();
    if (dueShops.length > 0) {
      const history = await db
        .select({
          tenantId:   tenantPaymentsTable.tenantId,
          lastPaidAt: sql<Date | null>`max(${tenantPaymentsTable.paidAt})`,
          paidTotal:  sql<string>`coalesce(sum(${tenantPaymentsTable.amount}), 0)`,
        })
        .from(tenantPaymentsTable)
        .where(inArray(tenantPaymentsTable.tenantId, dueShops.map((t) => t.id)))
        .groupBy(tenantPaymentsTable.tenantId);
      for (const h of history) paidByShop.set(h.tenantId, { lastPaidAt: h.lastPaidAt, paidTotal: h.paidTotal });
    }

    const renewals = dueShops.map((t) => ({
      ...t,
      lastPaidAt: paidByShop.get(t.id)?.lastPaidAt ?? null,
      paidTotal:  paidByShop.get(t.id)?.paidTotal ?? "0",
    }));

    /* byMonth is grouped on IST calendar months, so both labels have to be
       IST months too. Stepping a Date back by a month and then formatting it
       in IST is wrong for the first 5.5 hours of an IST month — that instant
       is still the previous month in UTC, so it lands two months back and the
       "last month" card reads zero. Do the arithmetic on the IST label. */
    const nowMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
    const [nowYear, nowMonthNum] = nowMonth.split("-").map(Number);
    const prevMonth = nowMonthNum === 1
      ? `${nowYear - 1}-12`
      : `${nowYear}-${String(nowMonthNum - 1).padStart(2, "0")}`;

    res.json({
      payments,
      byMonth,
      renewals,
      summary: {
        thisMonth:   byMonth.find((m) => m.month === nowMonth)?.total ?? "0",
        lastMonth:   byMonth.find((m) => m.month === prevMonth)?.total ?? "0",
        allTime:     totals?.allTime ?? "0",
        count:       totals?.count ?? 0,
        payingShops: totals?.payingShops ?? 0,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load payments" });
  }
});

/* ───── POST /api/platform/payments — record money received ──────────── */
router.post("/platform/payments", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : "";
  const amount = parseAmount(req.body?.amount);
  const method = typeof req.body?.method === "string" ? req.body.method : "cash";
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;
  const coversDays = Number.isInteger(req.body?.coversDays) ? (req.body.coversDays as number) : null;

  if (!tenantId) { res.status(400).json({ error: "Which shop paid?" }); return; }
  if (amount === null) { res.status(400).json({ error: "Enter an amount greater than zero" }); return; }
  if (!VALID_METHODS.has(method)) { res.status(400).json({ error: "Unknown payment method" }); return; }

  /* An explicit date is allowed (cash entered days later) but must be real
     and not in the future — a future-dated payment silently corrupts every
     monthly total until that date passes. */
  let paidAt: Date | undefined;
  if (req.body?.paidAt) {
    const d = new Date(String(req.body.paidAt));
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "That payment date isn't valid" }); return; }
    if (d.getTime() > Date.now() + 60_000) { res.status(400).json({ error: "A payment can't be dated in the future" }); return; }
    paidAt = d;
  }

  try {
    const [shop] = await db
      .select({ id: tenantsTable.id, name: tenantsTable.name, expiresAt: tenantsTable.expiresAt })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!shop) { res.status(404).json({ error: "Shop not found" }); return; }

    const [row] = await db
      .insert(tenantPaymentsTable)
      .values({
        tenantId:        shop.id,
        amount:          amount.toFixed(2),
        method,
        note,
        coversDays,
        /* Snapshot the access this bought, so later extends don't rewrite it. */
        coversUntil:     shop.expiresAt ?? null,
        ...(paidAt ? { paidAt } : {}),
        recordedByEmail: req.platformActor!.email,
      })
      .returning();

    void recordAudit({
      action:       "platform.payment_recorded",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: shop.id,
      ip:           req.ip,
      metadata:     { amount: amount.toFixed(2), method, coversDays },
    });

    res.status(201).json({ ok: true, payment: row, shopName: shop.name });
  } catch {
    res.status(500).json({ error: "Failed to record that payment" });
  }
});

/* ───── DELETE /api/platform/payments/:paymentId — undo a typo ───────── */
router.delete("/platform/payments/:paymentId", requirePlatformAdmin, async (req, res): Promise<void> => {
  const paymentId = String(req.params.paymentId);
  try {
    const deleted = await db
      .delete(tenantPaymentsTable)
      .where(eq(tenantPaymentsTable.id, paymentId))
      .returning({ id: tenantPaymentsTable.id, tenantId: tenantPaymentsTable.tenantId, amount: tenantPaymentsTable.amount });
    if (deleted.length === 0) { res.status(404).json({ error: "That payment record no longer exists" }); return; }

    void recordAudit({
      action:       "platform.payment_deleted",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: deleted[0].tenantId,
      ip:           req.ip,
      metadata:     { paymentId, amount: deleted[0].amount },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to remove that payment" });
  }
});

export default router;
