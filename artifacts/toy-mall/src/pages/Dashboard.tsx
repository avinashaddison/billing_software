import {
  useGetDashboardSummary, useGetTodayActivity, useGetLowStockProducts, useGetCategoryBreakdown,
  getGetDashboardSummaryQueryKey, getGetTodayActivityQueryKey,
  getGetLowStockProductsQueryKey, getGetCategoryBreakdownQueryKey,
} from "@workspace/api-client-react";
import {
  Package, IndianRupee, AlertTriangle, ArrowDownToLine, ArrowUpToLine,
  TrendingUp, FileText, Users, Tag, Truck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getCategoryStyle, getCategoryEmoji } from "@/lib/category-colors";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface DayRevenue { day: string; totalAmount: number; billCount: number; }

/* ── Revenue chart ───────────────────────────────────────────────── */
function RevenueChart() {
  const [data, setData]     = useState<DayRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/reports/revenue?days=7`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="bg-card border rounded-2xl p-4 mt-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> 7-Day Revenue
          </h2>
          {data.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              ₹{data.reduce((s, d) => s + d.totalAmount, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} total · {data.reduce((s, d) => s + d.billCount, 0)} bills
            </p>
          )}
        </div>
        <Link href="/report" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
          Full Report →
        </Link>
      </div>
      {loading ? (
        <Skeleton className="w-full h-28 rounded-xl" />
      ) : data.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No sales data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
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
                backgroundColor: "hsl(var(--card))", boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
              }}
            />
            <Bar dataKey="totalAmount" fill="url(#revenueGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
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
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
      connected
        ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"
        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`} />
      {connected ? "LIVE" : "Connecting…"}
    </div>
  );
}

/* ── StatCard ────────────────────────────────────────────────────── */
function StatCard({
  title, value, subtitle, icon: Icon, loading,
  accent = "blue", testid,
}: {
  title: string; value?: string | number; subtitle?: string;
  icon: React.ElementType; loading?: boolean;
  accent?: "blue" | "green" | "red" | "purple"; testid?: string;
}) {
  const accentMap = {
    blue:   { bar: "from-blue-500 to-indigo-500",   icon: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",   val: ""                           },
    green:  { bar: "from-emerald-500 to-green-400", icon: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400", val: "text-emerald-600 dark:text-emerald-400" },
    red:    { bar: "from-red-500 to-rose-400",       icon: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400",       val: "text-red-600 dark:text-red-400" },
    purple: { bar: "from-purple-500 to-violet-400",  icon: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400", val: "text-purple-600 dark:text-purple-400" },
  };
  const a = accentMap[accent];

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm" data-testid={testid}>
      {/* accent gradient bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${a.bar}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${a.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <p className={`text-3xl font-black leading-none tracking-tight ${a.val}`}>{value ?? 0}</p>
        )}
        {subtitle && <p className="text-[10px] mt-2 font-semibold text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary }     = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: activity, isLoading: loadingActivity }   = useGetTodayActivity({ query: { queryKey: getGetTodayActivityQueryKey() } });
  const { data: lowStock, isLoading: loadingLowStock }   = useGetLowStockProducts({ query: { queryKey: getGetLowStockProductsQueryKey() } });
  const { data: categories, isLoading: loadingCategories } = useGetCategoryBreakdown({ query: { queryKey: getGetCategoryBreakdownQueryKey() } });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 pb-28 md:pb-8">

      {/* Mobile header */}
      <div className="flex items-center justify-between md:hidden">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">VishwaKarma Complex</h1>
          <p className="text-xs text-muted-foreground">Inventory · real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge />
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your inventory · updates in real time</p>
        </div>
        <LiveBadge />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Products" icon={Package} accent="blue"
          value={summary?.totalProducts} loading={loadingSummary}
          testid="stat-total-products"
        />
        <StatCard
          title="Stock Value" icon={IndianRupee} accent="purple"
          value={summary ? `₹${summary.totalStockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : undefined}
          loading={loadingSummary} testid="stat-stock-value"
        />
        <StatCard
          title="Today IN" icon={ArrowDownToLine} accent="green"
          value={activity?.inQuantity}
          subtitle={`${activity?.inCount ?? 0} transactions`}
          loading={loadingActivity} testid="stat-today-in"
        />
        <StatCard
          title="Today OUT" icon={ArrowUpToLine} accent="red"
          value={activity?.outQuantity}
          subtitle={`${activity?.outCount ?? 0} transactions`}
          loading={loadingActivity} testid="stat-today-out"
        />
      </div>

      {/* ── Revenue chart ── */}
      <RevenueChart />

      {/* ── Quick-access tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { href: "/report",    icon: FileText, label: "Reports",   desc: "EOD summary & trends",  iconBg: "bg-blue-100 dark:bg-blue-900/40",   iconColor: "text-blue-600 dark:text-blue-400",   barFrom: "from-blue-500",   barTo: "to-indigo-400"   },
          { href: "/customers", icon: Users,    label: "Customers", desc: "Purchase history",       iconBg: "bg-purple-100 dark:bg-purple-900/40", iconColor: "text-purple-600 dark:text-purple-400", barFrom: "from-purple-500", barTo: "to-violet-400"   },
          { href: "/labels",    icon: Tag,      label: "Labels",    desc: "Print QR shelf tags",    iconBg: "bg-amber-100 dark:bg-amber-900/40",  iconColor: "text-amber-600 dark:text-amber-400",  barFrom: "from-amber-500",  barTo: "to-orange-400"   },
          { href: "/suppliers", icon: Truck,    label: "Suppliers", desc: "Manage vendors",         iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconColor: "text-emerald-600 dark:text-emerald-400", barFrom: "from-emerald-500", barTo: "to-green-400" },
        ] as const).map(({ href, icon: Icon, label, desc, iconBg, iconColor, barFrom, barTo }) => (
          <Link key={href} href={href}
            className="bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.97] transition-all group">
            <div className={`h-1 w-full bg-gradient-to-r ${barFrom} ${barTo}`} />
            <div className="p-4">
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <p className="font-black text-sm text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Two column: Alerts + Categories ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Low Stock Alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              Low Stock Alerts
            </h2>
            {summary?.lowStockCount !== undefined && summary.lowStockCount > 0 && (
              <span className="min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center">
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
              <div className="text-2xl mb-1">✅</div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">All stock levels look good!</p>
              <p className="text-xs text-muted-foreground mt-0.5">No items are running low right now</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(product => (
                <Link key={product.id} href={`/product?sku=${product.sku}`}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-[0.98] transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{product.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-red-600 dark:text-red-400 leading-none">{product.stock}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">left</p>
                  </div>
                </Link>
              ))}
              {lowStock.length > 6 && (
                <Link href="/products?filter=lowstock" className="block text-center text-sm font-bold text-primary py-2 hover:underline">
                  View all {lowStock.length} low-stock alerts →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-base font-black flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            Categories
          </h2>
          {loadingCategories ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {categories?.map(cat => {
                const style = getCategoryStyle(cat.category);
                const emoji = getCategoryEmoji(cat.category);
                return (
                  <div key={cat.category} className={`p-3 rounded-xl border ${style.bg} ${style.border} hover:opacity-90 transition-opacity`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{emoji}</span>
                      <p className={`font-bold text-xs truncate ${style.text}`}>{cat.category}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className={`text-2xl font-black leading-none ${style.text}`}>{cat.totalStock}</p>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">units</p>
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
