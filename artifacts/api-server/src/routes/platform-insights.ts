/**
 * Platform insight routes — the vendor's business picture.
 *
 * `/platform/stats` only ever returned four bare counts (tenants, active
 * tenants, users, legacy users), so the admin panel could not answer the
 * questions a vendor actually asks: which shops are trading, which are paying
 * but idle, who is about to expire, and how much money moves through each one.
 *
 * Two correctness notes that matter more than they look:
 *
 *  1. Revenue is read from `bills`, NOT `sales`. The legacy `sales` table is
 *     near-empty on this installation; every real sale is a `bills` row. The
 *     old tenant list counted `sales`, which is why its per-shop numbers bore
 *     no relation to the money the shop had actually taken.
 *
 *  2. Every "today" / "last N days" boundary is an Asia/Kolkata calendar day,
 *     resolved through lib/ist — the same boundary the shop's own dashboard
 *     and reports use. Measuring on the server's UTC day instead would make
 *     the vendor's numbers disagree with the shop's for five and a half hours
 *     out of every day.
 *
 * Rows whose tenant_id is NULL are pre-multi-tenancy leftovers. They are
 * reported separately as `unassigned` rather than being silently folded into
 * a shop that may not have earned them.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  authUsersTable,
  staffProfilesTable,
  productsTable,
  billsTable,
  saleItemsTable,
  returnsTable,
} from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/platform-admin";
import { anchorExtension, PRESET_DURATIONS, resolveExpiry } from "../lib/tenant-access";
import { recordAudit } from "../lib/audit";
import { istToday, istShiftDay } from "../lib/ist";

const router: IRouter = Router();

/** A bill's Asia/Kolkata calendar day. */
const billDay = sql`DATE(${billsTable.createdAt} AT TIME ZONE 'Asia/Kolkata')`;

/** How many shops a single bulk action may touch. Guards against a runaway
 *  client turning one click into an unbounded write storm. */
const MAX_BULK_IDS = 100;

/** Days of remaining access below which a shop is flagged as "expiring". */
const EXPIRING_SOON_DAYS = 7;

type CountRow = { tenantId: string | null; c: number };
function countMap(rows: CountRow[]): Map<string | null, number> {
  const m = new Map<string | null, number>();
  for (const r of rows) m.set(r.tenantId, r.c);
  return m;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Access state derived from the suspend flag + expiry date. */
type Access = "active" | "suspended" | "expired" | "expiring";
/** Whether the shop is actually being used, independent of whether it may be. */
type Activity = "trading" | "idle" | "never_sold";

/* ───── GET /api/platform/overview — every shop, with money & activity ─────
 *
 * One request powers the whole admin landing screen: platform totals plus a
 * per-shop row carrying revenue, bill counts, outstanding dues, last sale and
 * a two-axis health read (may they trade / are they trading).
 */
router.get("/platform/overview", requirePlatformAdmin, async (_req, res): Promise<void> => {
  try {
    const today  = istToday();
    const from7  = istShiftDay(today, -6);   // 7 IST days, inclusive of today
    const from14 = istShiftDay(today, -13);  // 14 IST days, for the daily trend line
    const from30 = istShiftDay(today, -29);  // 30 IST days, inclusive of today

    /* Refunds shrink what a customer still owes, so receivables must subtract
       them — a credit customer who returned the goods is not a debtor. */
    const refundsSq = db
      .select({
        billId:   returnsTable.billId,
        refunded: sql<string>`sum(${returnsTable.refundAmount})`.as("refunded"),
      })
      .from(returnsTable)
      .groupBy(returnsTable.billId)
      .as("refunds_sq");

    const outstandingPerBill = sql<string>`GREATEST(0, ${billsTable.totalAmount} - ${billsTable.amountPaid} - COALESCE(${refundsSq.refunded}, 0))`;

    const [tenants, money, dues, products, staff, users, owners, daily] = await Promise.all([
      db
        .select({
          id:        tenantsTable.id,
          name:      tenantsTable.name,
          isActive:  tenantsTable.isActive,
          expiresAt: tenantsTable.expiresAt,
          createdAt: tenantsTable.createdAt,
          maxStaff:  tenantsTable.maxStaff,
          maxProducts: tenantsTable.maxProducts,
        })
        .from(tenantsTable)
        .orderBy(tenantsTable.createdAt),

      /* One grouped pass over bills produces every money window we need.
         FILTER keeps it to a single scan instead of one query per window. */
      db
        .select({
          tenantId:       billsTable.tenantId,
          billsAllTime:   sql<number>`(count(*))::int`,
          revenueAllTime: sql<string>`coalesce(sum(${billsTable.totalAmount}), 0)`,
          bills30d:       sql<number>`(count(*) filter (where ${billDay} >= ${from30}::date))::int`,
          revenue30d:     sql<string>`coalesce(sum(${billsTable.totalAmount}) filter (where ${billDay} >= ${from30}::date), 0)`,
          bills7d:        sql<number>`(count(*) filter (where ${billDay} >= ${from7}::date))::int`,
          billsToday:     sql<number>`(count(*) filter (where ${billDay} = ${today}::date))::int`,
          revenueToday:   sql<string>`coalesce(sum(${billsTable.totalAmount}) filter (where ${billDay} = ${today}::date), 0)`,
          lastSaleAt:     sql<Date | null>`max(${billsTable.createdAt})`,
        })
        .from(billsTable)
        .groupBy(billsTable.tenantId),

      db
        .select({
          tenantId:    billsTable.tenantId,
          outstanding: sql<string>`coalesce(sum(${outstandingPerBill}), 0)`,
        })
        .from(billsTable)
        .leftJoin(refundsSq, eq(refundsSq.billId, billsTable.id))
        .groupBy(billsTable.tenantId),

      db.select({ tenantId: productsTable.tenantId,      c: sql<number>`count(*)::int` }).from(productsTable).groupBy(productsTable.tenantId),
      db.select({ tenantId: staffProfilesTable.tenantId, c: sql<number>`count(*)::int` }).from(staffProfilesTable).groupBy(staffProfilesTable.tenantId),
      db.select({ tenantId: authUsersTable.tenantId,     c: sql<number>`count(*)::int` }).from(authUsersTable).groupBy(authUsersTable.tenantId),

      db
        .select({
          tenantId:  authUsersTable.tenantId,
          email:     authUsersTable.email,
          createdAt: authUsersTable.createdAt,
        })
        .from(authUsersTable)
        .where(eq(authUsersTable.role, "owner")),

      /* Platform-wide daily pulse, last 14 IST days. NULL-tenant bills are
         excluded so the trend agrees with the totals beside it, which also
         exclude unassigned rows. */
      db
        .select({
          day:     sql<string>`to_char(${billDay}, 'YYYY-MM-DD')`,
          revenue: sql<string>`coalesce(sum(${billsTable.totalAmount}), 0)`,
          bills:   sql<number>`(count(*))::int`,
        })
        .from(billsTable)
        .where(and(sql`${billDay} >= ${from14}::date`, isNotNull(billsTable.tenantId)))
        .groupBy(billDay)
        .orderBy(billDay),
    ]);

    const moneyBy = new Map(money.map((m) => [m.tenantId, m]));
    const dueBy   = new Map(dues.map((d) => [d.tenantId, num(d.outstanding)]));
    const prodBy  = countMap(products);
    const staffBy = countMap(staff);
    const userBy  = countMap(users);

    /* Earliest 'owner' row wins, so the panel shows a stable contact even when
       a shop has since added more owner accounts. */
    const ownerBy = new Map<string, { email: string; at: Date }>();
    for (const o of owners) {
      if (o.tenantId == null) continue;
      const prev = ownerBy.get(o.tenantId);
      if (!prev || o.createdAt < prev.at) ownerBy.set(o.tenantId, { email: o.email, at: o.createdAt });
    }

    const now = Date.now();
    const shops = tenants.map((t) => {
      const m = moneyBy.get(t.id);
      const billsAllTime = m?.billsAllTime ?? 0;
      const daysLeft = t.expiresAt
        ? Math.ceil((new Date(t.expiresAt).getTime() - now) / 86_400_000)
        : null;

      const access: Access =
        !t.isActive                                       ? "suspended"
        : daysLeft !== null && daysLeft < 0                ? "expired"
        : daysLeft !== null && daysLeft <= EXPIRING_SOON_DAYS ? "expiring"
        : "active";

      /* Activity is deliberately independent of access: a suspended shop that
         was trading yesterday is a very different conversation from one that
         never made a single sale. */
      const activity: Activity =
        billsAllTime === 0        ? "never_sold"
        : (m?.bills7d ?? 0) > 0   ? "trading"
        : "idle";

      return {
        id:             t.id,
        name:           t.name,
        isActive:       t.isActive,
        expiresAt:      t.expiresAt ? new Date(t.expiresAt).toISOString() : null,
        createdAt:      new Date(t.createdAt).toISOString(),
        ownerEmail:     ownerBy.get(t.id)?.email ?? null,
        daysLeft,
        access,
        activity,
        revenueToday:   num(m?.revenueToday),
        revenue30d:     num(m?.revenue30d),
        revenueAllTime: num(m?.revenueAllTime),
        billsToday:     m?.billsToday ?? 0,
        bills30d:       m?.bills30d ?? 0,
        billsAllTime,
        outstanding:    dueBy.get(t.id) ?? 0,
        lastSaleAt:     m?.lastSaleAt ? new Date(m.lastSaleAt).toISOString() : null,
        productCount:   prodBy.get(t.id) ?? 0,
        staffCount:     staffBy.get(t.id) ?? 0,
        userCount:      userBy.get(t.id) ?? 0,
      };
    });

    const sum = (pick: (s: (typeof shops)[number]) => number) =>
      shops.reduce((acc, s) => acc + pick(s), 0);

    /* Pre-multi-tenancy rows. Surfaced rather than hidden so the vendor can
       see that platform totals deliberately exclude unattributable money. */
    const orphan = moneyBy.get(null);
    const unassigned = orphan && orphan.billsAllTime > 0
      ? { bills: orphan.billsAllTime, revenue: num(orphan.revenueAllTime) }
      : null;

    /* Fill calendar gaps so a quiet day reads as zero rather than vanishing
       and letting the trend line lie about which days had trade. */
    const dailyBy = new Map(daily.map((d) => [d.day, d]));
    const series: { day: string; revenue: number; bills: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = istShiftDay(today, -i);
      const hit = dailyBy.get(d);
      series.push({ day: d, revenue: num(hit?.revenue), bills: hit?.bills ?? 0 });
    }

    res.json({
      generatedAt: new Date().toISOString(),
      day: today,
      series,
      totals: {
        shops:          shops.length,
        activeShops:    shops.filter((s) => s.access === "active" || s.access === "expiring").length,
        suspended:      shops.filter((s) => s.access === "suspended").length,
        expired:        shops.filter((s) => s.access === "expired").length,
        expiringSoon:   shops.filter((s) => s.access === "expiring").length,
        tradingShops:   shops.filter((s) => s.activity === "trading").length,
        neverSold:      shops.filter((s) => s.activity === "never_sold").length,
        revenueToday:   sum((s) => s.revenueToday),
        revenue30d:     sum((s) => s.revenue30d),
        revenueAllTime: sum((s) => s.revenueAllTime),
        billsToday:     sum((s) => s.billsToday),
        bills30d:       sum((s) => s.bills30d),
        billsAllTime:   sum((s) => s.billsAllTime),
        outstanding:    sum((s) => s.outstanding),
        products:       sum((s) => s.productCount),
        staff:          sum((s) => s.staffCount),
        users:          sum((s) => s.userCount),
      },
      shops,
      unassigned,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load overview" });
    throw err;
  }
});

/* ───── GET /api/platform/tenants/:id/detail — read-only support view ─────
 *
 * Everything needed to help a shop owner who has phoned in, without the
 * vendor having to sign in as them: recent bills, what sells, who can log in,
 * and a two-week trading shape.
 *
 * Strictly read-only, and strictly scoped to this tenant_id — legacy NULL
 * rows are NOT folded in here, because attributing them to whichever shop is
 * being viewed would invent history the shop never had.
 */
router.get("/platform/tenants/:id/detail", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "").trim();
  try {
    const [tenant] = await db
      .select({
        id:        tenantsTable.id,
        name:      tenantsTable.name,
        isActive:  tenantsTable.isActive,
        expiresAt: tenantsTable.expiresAt,
        createdAt: tenantsTable.createdAt,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id));

    if (!tenant) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }

    const today  = istToday();
    const from14 = istShiftDay(today, -13);
    const from30 = istShiftDay(today, -29);
    const scope  = eq(billsTable.tenantId, id);

    const refundsSq = db
      .select({
        billId:   returnsTable.billId,
        refunded: sql<string>`sum(${returnsTable.refundAmount})`.as("refunded"),
      })
      .from(returnsTable)
      .groupBy(returnsTable.billId)
      .as("refunds_sq");

    const [recentBills, daily, topProducts, staff, users, stock] = await Promise.all([
      db
        .select({
          billNumber:    billsTable.billNumber,
          totalAmount:   billsTable.totalAmount,
          amountPaid:    billsTable.amountPaid,
          paymentMode:   billsTable.paymentMode,
          paymentStatus: billsTable.paymentStatus,
          itemsCount:    billsTable.itemsCount,
          customerName:  billsTable.customerName,
          createdAt:     billsTable.createdAt,
        })
        .from(billsTable)
        .where(scope)
        .orderBy(desc(billsTable.createdAt))
        .limit(10),

      db
        .select({
          day:     sql<string>`to_char(${billDay}, 'YYYY-MM-DD')`,
          revenue: sql<string>`coalesce(sum(${billsTable.totalAmount}), 0)`,
          bills:   sql<number>`(count(*))::int`,
        })
        .from(billsTable)
        .where(and(scope, sql`${billDay} >= ${from14}::date`))
        .groupBy(billDay)
        .orderBy(billDay),

      db
        .select({
          name:    sql<string>`coalesce(${productsTable.name}, ${saleItemsTable.customName}, 'Unknown')`,
          qty:     sql<number>`(sum(${saleItemsTable.quantity}))::int`,
          revenue: sql<string>`coalesce(sum(${saleItemsTable.subtotal}), 0)`,
        })
        .from(saleItemsTable)
        .innerJoin(billsTable, eq(billsTable.id, saleItemsTable.saleId))
        .leftJoin(productsTable, eq(productsTable.id, saleItemsTable.productId))
        .where(and(scope, sql`${billDay} >= ${from30}::date`))
        .groupBy(sql`coalesce(${productsTable.name}, ${saleItemsTable.customName}, 'Unknown')`)
        .orderBy(desc(sql`sum(${saleItemsTable.subtotal})`))
        .limit(5),

      db
        .select({
          name:     staffProfilesTable.name,
          role:     staffProfilesTable.role,
          isActive: staffProfilesTable.isActive,
        })
        .from(staffProfilesTable)
        .where(eq(staffProfilesTable.tenantId, id))
        .orderBy(staffProfilesTable.createdAt),

      db
        .select({
          email:       authUsersTable.email,
          role:        authUsersTable.role,
          isActive:    authUsersTable.isActive,
          lastLoginAt: authUsersTable.lastLoginAt,
        })
        .from(authUsersTable)
        .where(eq(authUsersTable.tenantId, id))
        .orderBy(authUsersTable.createdAt),

      db
        .select({
          products:   sql<number>`(count(*))::int`,
          stockUnits: sql<number>`(coalesce(sum(${productsTable.stock}), 0))::int`,
          stockValue: sql<string>`coalesce(sum(${productsTable.stock} * coalesce(${productsTable.purchasePrice}, ${productsTable.price})), 0)`,
          lowStock:   sql<number>`(count(*) filter (where ${productsTable.stock} <= ${productsTable.lowStockThreshold}))::int`,
        })
        .from(productsTable)
        .where(eq(productsTable.tenantId, id)),
    ]);

    const [dues] = await db
      .select({
        outstanding: sql<string>`coalesce(sum(GREATEST(0, ${billsTable.totalAmount} - ${billsTable.amountPaid} - COALESCE(${refundsSq.refunded}, 0))), 0)`,
        openBills:   sql<number>`(count(*) filter (where GREATEST(0, ${billsTable.totalAmount} - ${billsTable.amountPaid} - COALESCE(${refundsSq.refunded}, 0)) > 0))::int`,
      })
      .from(billsTable)
      .leftJoin(refundsSq, eq(refundsSq.billId, billsTable.id))
      .where(scope);

    /* Fill the gaps so a quiet day reads as zero rather than vanishing and
       making the trend line lie about which days had trade. */
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const series: { day: string; revenue: number; bills: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = istShiftDay(today, -i);
      const hit = byDay.get(d);
      series.push({ day: d, revenue: num(hit?.revenue), bills: hit?.bills ?? 0 });
    }

    res.json({
      shop: {
        ...tenant,
        expiresAt: tenant.expiresAt ? new Date(tenant.expiresAt).toISOString() : null,
        createdAt: new Date(tenant.createdAt).toISOString(),
      },
      inventory: {
        products:   stock[0]?.products   ?? 0,
        stockUnits: stock[0]?.stockUnits ?? 0,
        stockValue: num(stock[0]?.stockValue),
        lowStock:   stock[0]?.lowStock   ?? 0,
      },
      receivables: {
        outstanding: num(dues?.outstanding),
        openBills:   dues?.openBills ?? 0,
      },
      series,
      recentBills: recentBills.map((b) => ({
        billNumber:    b.billNumber,
        total:         num(b.totalAmount),
        paid:          num(b.amountPaid),
        paymentMode:   b.paymentMode,
        paymentStatus: b.paymentStatus,
        itemsCount:    b.itemsCount,
        customerName:  b.customerName,
        createdAt:     new Date(b.createdAt).toISOString(),
      })),
      topProducts: topProducts.map((p) => ({
        name:    p.name,
        qty:     p.qty,
        revenue: num(p.revenue),
      })),
      staff,
      users: users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load shop detail" });
    throw err;
  }
});

/* ───── POST /api/platform/tenants/bulk — act on many shops at once ─────
 *
 * Body: { ids: string[], action: "activate" | "suspend" | "extend",
 *         expiresAt?: "lifetime" | preset | ISO date }
 *
 * Each shop is updated and audited individually so the audit log reads the
 * same whether the vendor acted on one shop or twenty, and so one bad id
 * cannot silently void the whole batch. Unknown ids are reported back rather
 * than failing the request.
 */
router.post("/platform/tenants/bulk", requirePlatformAdmin, async (req, res): Promise<void> => {
  const rawIds: unknown[] = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]) : [];
  const ids: string[] = [
    ...new Set(
      rawIds
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .map((v) => v.trim()),
    ),
  ];
  const action = String(req.body?.action ?? "");

  if (ids.length === 0) {
    res.status(400).json({ error: "Select at least one shop" });
    return;
  }
  if (ids.length > MAX_BULK_IDS) {
    res.status(400).json({ error: `Too many shops in one action (max ${MAX_BULK_IDS})` });
    return;
  }
  if (action !== "activate" && action !== "suspend" && action !== "extend") {
    res.status(400).json({ error: "action must be activate, suspend or extend" });
    return;
  }

  /* A preset duration ("30d") is an EXTENSION, so each shop is anchored to
   * whichever is later — today or that shop's own current expiry — exactly as
   * the single-shop extend route does. Resolving one date from now() for the
   * whole batch would SHORTEN access for any shop already paid up past it.
   * An explicit ISO date (or "lifetime") is an instruction rather than an
   * extension, so it is applied verbatim to every selected shop. */
  const rawExpiry = req.body?.expiresAt;
  const presetMs =
    action === "extend" && typeof rawExpiry === "string" && rawExpiry in PRESET_DURATIONS
      ? PRESET_DURATIONS[rawExpiry]
      : null;

  let fixedExpiry: Date | null = null;
  if (action === "extend" && presetMs === null) {
    try {
      fixedExpiry = resolveExpiry(rawExpiry);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    try {
      let patch: { isActive: boolean } | { expiresAt: Date | null };
      let appliedExpiry: Date | null = null;

      if (action === "activate")      patch = { isActive: true };
      else if (action === "suspend")  patch = { isActive: false };
      else if (presetMs !== null) {
        const [existing] = await db
          .select({ expiresAt: tenantsTable.expiresAt })
          .from(tenantsTable)
          .where(eq(tenantsTable.id, id));
        if (!existing) { results.push({ id, ok: false, error: "Shop not found" }); continue; }

        appliedExpiry = anchorExtension(existing.expiresAt, presetMs);
        patch = { expiresAt: appliedExpiry };
      } else {
        appliedExpiry = fixedExpiry;
        patch = { expiresAt: fixedExpiry };
      }

      const updated = await db
        .update(tenantsTable)
        .set(patch)
        .where(eq(tenantsTable.id, id))
        .returning({ id: tenantsTable.id });

      if (updated.length === 0) {
        results.push({ id, ok: false, error: "Shop not found" });
        continue;
      }

      results.push({ id, ok: true });
      void recordAudit({
        action:       `tenant.bulk_${action}`,
        actorId:      req.platformActor!.id,
        actorEmail:   req.platformActor!.email,
        targetTenant: id,
        ip:           req.ip,
        metadata:     action === "extend"
          ? { expiresAt: appliedExpiry ? appliedExpiry.toISOString() : "lifetime", batchSize: ids.length }
          : { batchSize: ids.length },
      });
    } catch {
      results.push({ id, ok: false, error: "Update failed" });
    }
  }

  const updated = results.filter((r) => r.ok).length;
  res.json({ action, requested: ids.length, updated, results });
});

export default router;
