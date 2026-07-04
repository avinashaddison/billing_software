import {
  useGetDashboardSummary, useGetTodayActivity, useGetLowStockProducts, useGetCategoryBreakdown,
  useGetReceivablesSummary,
  getGetDashboardSummaryQueryKey, getGetTodayActivityQueryKey,
  getGetLowStockProductsQueryKey, getGetCategoryBreakdownQueryKey,
  getGetReceivablesSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Package, IndianRupee, AlertTriangle, ArrowDownToLine, ArrowUpToLine,
  TrendingUp, FileText, Users, Tag, Truck, ChevronRight, Activity,
  CalendarClock, Infinity as InfinityIcon, HandCoins,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getCategoryStyle, getCategoryEmoji } from "@/lib/category-colors";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface DayRevenue { day: string; totalAmount: number; billCount: number; }

/* ── Revenue chart ───────────────────────────────────────────────── */
function RevenueChart() {
  const [data, setData] = useState<DayRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/reports/revenue?days=7`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const totalRevenue = data.reduce((s, d) => s + d.totalAmount, 0);
  const totalBills = data.reduce((s, d) => s + d.billCount, 0);

  return (
    <div className="relative bg-card border rounded-2xl overflow-hidden shadow-sm">
      {/* subtle gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-4 pb-2">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <h2 className="text-sm font-black text-foreground">7-Day Revenue</h2>
            </div>
            {data.length > 0 && (
              <div className="flex items-baseline gap-2 mt-2 ml-0.5">
                <span className="text-2xl font-black text-foreground">
                  ₹{totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs text-muted-foreground font-semibold">{totalBills} bills</span>
              </div>
            )}
          </div>
          <Link href="/report"
            className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors">
            Full Report <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="px-2 pb-3">
        {loading ? (
          <Skeleton className="w-full h-28 rounded-xl mx-2" />
        ) : data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No sales data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickFormatter={fmt} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                labelFormatter={fmt}
                contentStyle={{
                  fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))", boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
                }}
              />
              <Area dataKey="totalAmount" stroke="hsl(var(--primary))" strokeWidth={2.5}
                fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ── Valid Till badge ────────────────────────────────────────────────
 *
 * Pulls the current tenant's expires_at from /api/tenant/me and shows it
 * as a pill. Colours:
 *   - Lifetime (no expiry)  → blue
 *   - > 7 days remaining    → emerald
 *   - ≤ 7 days remaining    → amber
 *   - expired               → rose (rare — the gate 403's first, but
 *                                    surfaces if user reaches Dashboard) */
interface TenantMe {
  id: string;
  name: string;
  isActive: boolean;
  expiresAt: string | null;
}

function ValidTillBadge() {
  const [t, setT] = useState<TenantMe | null>(null);
  useEffect(() => {
    fetch(`${BASE_URL}/api/tenant/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setT)
      .catch(() => { /* silently absent — better than a noisy red badge */ });
  }, []);
  if (!t) return null;

  const lifetime = !t.expiresAt;
  const daysLeft = t.expiresAt
    ? Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  let label: string;
  let tone:  string;
  let Icon  = CalendarClock as React.ElementType;
  if (lifetime) {
    label = "Lifetime";
    tone  = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25";
    Icon  = InfinityIcon;
  } else if (daysLeft! < 0) {
    label = `Expired ${Math.abs(daysLeft!)}d ago`;
    tone  = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25";
  } else if (daysLeft! <= 7) {
    label = `${daysLeft}d left`;
    tone  = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
  } else {
    /* Format as "Valid till 14 May 2027" so the owner can plan renewal */
    label = `Valid till ${new Date(t.expiresAt!).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    })}`;
    tone  = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${tone}`}
      title={t.expiresAt ? `Tenant access expires ${new Date(t.expiresAt).toLocaleString()}` : "No expiry set"}>
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

/* ── LIVE badge ──────────────────────────────────────────────────── */
function LiveBadge() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${BASE_URL}/api/events`);
    es.addEventListener("connected", () => setConnected(true));
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
      connected
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
    }`}>
      <Activity className={`w-3 h-3 ${connected ? "text-emerald-500" : "text-zinc-400"}`} />
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
      {connected ? "LIVE" : "Connecting…"}
    </div>
  );
}

/* ── StatCard ────────────────────────────────────────────────────── */
type Accent = "blue" | "green" | "red" | "purple" | "teal" | "slate";

const accentMap: Record<Accent, {
  gradient: string; iconBg: string; iconColor: string; valColor: string; glow: string;
}> = {
  slate:  { gradient: "from-slate-500/8 via-slate-500/4 to-transparent",    iconBg: "bg-slate-500",   iconColor: "text-white", valColor: "text-foreground",                                glow: "shadow-slate-500/8"   },
  teal:   { gradient: "from-teal-600/10 via-teal-600/5 to-transparent",     iconBg: "bg-teal-600",    iconColor: "text-white", valColor: "text-teal-700 dark:text-teal-300",               glow: "shadow-teal-600/10"   },
  blue:   { gradient: "from-blue-500/10 via-blue-500/5 to-transparent",     iconBg: "bg-blue-500",    iconColor: "text-white", valColor: "text-foreground",                                glow: "shadow-blue-500/10"   },
  purple: { gradient: "from-purple-500/10 via-purple-500/5 to-transparent", iconBg: "bg-purple-500",  iconColor: "text-white", valColor: "text-purple-600 dark:text-purple-400",           glow: "shadow-purple-500/10" },
  green:  { gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent", iconBg: "bg-emerald-500", iconColor: "text-white", valColor: "text-emerald-600 dark:text-emerald-400",      glow: "shadow-emerald-500/10" },
  red:    { gradient: "from-red-500/10 via-red-500/5 to-transparent",       iconBg: "bg-red-500",     iconColor: "text-white", valColor: "text-red-600 dark:text-red-400",                glow: "shadow-red-500/10"    },
};

function StatCard({
  title, value, subtitle, icon: Icon, loading, accent = "blue", testid, href,
}: {
  title: string; value?: string | number; subtitle?: string;
  icon: React.ElementType; loading?: boolean;
  accent?: Accent; testid?: string;
  /** When set, the whole card becomes a link to this route. */
  href?: string;
}) {
  const a = accentMap[accent];
  const body = (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${a.gradient} pointer-events-none`} />
      <div className="relative p-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest leading-tight">{title}</p>
          <div className={`w-8 h-8 rounded-xl ${a.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
            <Icon className={`w-4 h-4 ${a.iconColor}`} />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-9 w-24 mt-1" />
        ) : (
          <p className={`text-3xl font-black leading-none tracking-tight ${a.valColor}`}>{value ?? 0}</p>
        )}
        {subtitle && (
          <p className="text-[10px] mt-2 font-semibold text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </>
  );

  const baseClass = `relative bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${a.glow}`;

  if (href) {
    return (
      <Link href={href} data-testid={testid}
        className={`${baseClass} block cursor-pointer active:scale-[0.98] transition-all`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={baseClass} data-testid={testid}>
      {body}
    </div>
  );
}

/* ── Receivables (money customers owe) ──────────────────────────── */
function fmtRupees(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtDebtorLabel(d: { customerName?: string | null; customerPhone?: string | null }) {
  if (d.customerName) return d.customerName;
  if (d.customerPhone) return d.customerPhone;
  return "Walk-in";
}

function ReceivablesCard() {
  const { data, isLoading } = useGetReceivablesSummary({
    query: { queryKey: getGetReceivablesSummaryQueryKey() },
  });

  const total      = data?.totalOutstanding ?? 0;
  const billCount  = data?.billCount ?? 0;
  const topDebtors = data?.topDebtors ?? [];
  const hasDues    = total > 0;

  return (
    <div className={`relative bg-card border rounded-2xl overflow-hidden shadow-sm ${hasDues ? "shadow-rose-500/10" : ""}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${hasDues ? "from-rose-500/8 via-rose-500/3" : "from-emerald-500/8 via-emerald-500/3"} to-transparent pointer-events-none`} />

      <div className="relative p-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shadow-sm ${hasDues ? "bg-rose-500" : "bg-emerald-500"}`}>
              <HandCoins className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-black text-foreground">Customers Owe You</h2>
          </div>
          <Link
            href="/customers"
            className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
              hasDues
                ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            }`}
          >
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <Skeleton className="h-9 w-40 mt-1" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black tracking-tight ${hasDues ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              ₹{fmtRupees(total)}
            </span>
            {hasDues && (
              <span className="text-xs text-muted-foreground font-semibold">
                across {billCount} bill{billCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
        {!isLoading && !hasDues && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            All settled — no outstanding credit sales.
          </p>
        )}
      </div>

      {/* Top debtors list — only when there's something to chase */}
      {hasDues && topDebtors.length > 0 && (
        <div className="relative px-3 pb-3 space-y-1.5">
          {topDebtors.slice(0, 3).map((d, i) => {
            const phone = d.customerPhone;
            const label = fmtDebtorLabel(d);
            const row = (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background/60 border hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors">
                <div className="w-7 h-7 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{label}</p>
                  {d.customerName && d.customerPhone && (
                    <p className="text-[10px] text-muted-foreground font-mono">{d.customerPhone}</p>
                  )}
                  {!d.customerName && (
                    <p className="text-[10px] text-muted-foreground">{d.billCount} unpaid bill{d.billCount !== 1 ? "s" : ""}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-rose-600 dark:text-rose-400 leading-none tabular-nums">
                    ₹{fmtRupees(d.outstanding)}
                  </p>
                </div>
              </div>
            );
            return phone
              ? <Link key={`${phone}-${i}`} href={`/customers?phone=${phone}`}>{row}</Link>
              : <div key={`anon-${i}`}>{row}</div>;
          })}
        </div>
      )}
    </div>
  );
}

/* ── Quick-tile ──────────────────────────────────────────────────── */
const quickTiles = [
  { href: "/stock-alert", icon: AlertTriangle, label: "Stock Alert", desc: "Low stock & movement", iconBg: "bg-amber-500",   gradient: "from-amber-500/8"  },
  { href: "/analytics",   icon: TrendingUp,    label: "Analytics",   desc: "Trends & SKU stats",   iconBg: "bg-indigo-500",  gradient: "from-indigo-500/8" },
  { href: "/report",    icon: FileText, label: "Reports",   desc: "EOD & trends",     iconBg: "bg-blue-500",    gradient: "from-blue-500/8"   },
  { href: "/customers", icon: Users,    label: "Customers", desc: "Purchase history", iconBg: "bg-purple-500",  gradient: "from-purple-500/8" },
  { href: "/labels",    icon: Tag,      label: "Labels",    desc: "Barcode shelf labels",    iconBg: "bg-amber-500",   gradient: "from-amber-500/8"  },
  { href: "/suppliers", icon: Truck,    label: "Suppliers", desc: "Manage vendors",   iconBg: "bg-emerald-500", gradient: "from-emerald-500/8" },
] as const;

/* ── Main ────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const store = useStoreSettings();
  const { data: summary, isLoading: loadingSummary }       = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: activity, isLoading: loadingActivity }     = useGetTodayActivity({ query: { queryKey: getGetTodayActivityQueryKey() } });
  const { data: lowStock, isLoading: loadingLowStock }     = useGetLowStockProducts({ query: { queryKey: getGetLowStockProductsQueryKey() } });
  const { data: categories, isLoading: loadingCategories } = useGetCategoryBreakdown({ query: { queryKey: getGetCategoryBreakdownQueryKey() } });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 pb-28 md:pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          {/* Mobile shows store name, desktop shows "Dashboard" */}
          <h1 className="text-2xl font-black text-foreground tracking-tight md:hidden">{store.name}</h1>
          <h1 className="text-2xl font-black text-foreground tracking-tight hidden md:block">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Overview of your inventory · updates in real time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ValidTillBadge />
          <LiveBadge />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Products" icon={Package} accent="slate"
          value={summary?.totalProducts} loading={loadingSummary} testid="stat-total-products" />
        <StatCard title="Stock Value" icon={IndianRupee} accent="teal"
          value={summary ? `₹${Number(summary.totalStockValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : undefined}
          loading={loadingSummary} testid="stat-stock-value" />
        <StatCard title="Today IN" icon={ArrowDownToLine} accent="green"
          value={activity?.inQuantity}
          subtitle={`${activity?.inCount ?? 0} transactions`}
          loading={loadingActivity} testid="stat-today-in"
          href="/products?added=today" />
        <StatCard title="Today OUT" icon={ArrowUpToLine} accent="red"
          value={activity?.outQuantity}
          subtitle={`${activity?.outCount ?? 0} transactions`}
          loading={loadingActivity} testid="stat-today-out"
          href="/today-out" />
      </div>

      {/* ── Revenue + Receivables (money in / money owed) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RevenueChart />
        <ReceivablesCard />
      </div>

      {/* ── Quick-access tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickTiles.map(({ href, icon: Icon, label, desc, iconBg, gradient }) => (
          <Link key={href} href={href}
            className={`relative bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.97] transition-all group`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
            <div className="relative p-4">
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="font-black text-sm text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="absolute top-3 right-3 w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Two column: Alerts + Categories ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Low Stock Alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-white" />
              </div>
              Low Stock Alerts
            </h2>
            {summary?.lowStockCount !== undefined && summary.lowStockCount > 0 && (
              <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                {summary.lowStockCount}
              </span>
            )}
          </div>

          {loadingLowStock ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : !lowStock || lowStock.length === 0 ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-5 text-center border border-emerald-200 dark:border-emerald-900">
              <div className="text-2xl mb-1.5">✅</div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">All stock levels look good!</p>
              <p className="text-xs text-muted-foreground mt-0.5">No items are running low</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(product => (
                <Link key={product.id} href={`/product?sku=${product.sku}`}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-red-50/60 dark:hover:bg-red-950/20 active:scale-[0.98] transition-all group">
                  <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{product.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-red-600 dark:text-red-400 leading-none">{product.stock}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">LEFT</p>
                  </div>
                </Link>
              ))}
              {lowStock.length > 6 && (
                <Link href="/products?filter=lowstock"
                  className="flex items-center justify-center gap-1 text-sm font-bold text-primary py-2 hover:underline">
                  View all {lowStock.length} alerts <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-sm font-black flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Package className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            Categories
          </h2>
          {loadingCategories ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="bg-muted/30 rounded-2xl p-5 text-center border">
              <p className="text-sm font-bold text-muted-foreground">No categories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => {
                const style = getCategoryStyle(cat.category);
                const emoji = getCategoryEmoji(cat.category);
                return (
                  <div key={cat.category}
                    className={`relative p-3 rounded-xl border ${style.bg} ${style.border} hover:shadow-sm transition-shadow overflow-hidden`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-lg leading-none">{emoji}</span>
                      <p className={`font-bold text-xs truncate ${style.text}`}>{cat.category}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className={`text-2xl font-black leading-none ${style.text}`}>{cat.totalStock}</p>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">UNITS</p>
                        <p className="text-[9px] text-muted-foreground">{cat.productCount} SKUs</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
