import { useGetDashboardSummary, useGetTodayActivity, useGetLowStockProducts, useGetCategoryBreakdown, getGetDashboardSummaryQueryKey, getGetTodayActivityQueryKey, getGetLowStockProductsQueryKey, getGetCategoryBreakdownQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, IndianRupee, AlertTriangle, ArrowDownToLine, ArrowUpToLine, Layers, TrendingUp, FileText, Users, Tag, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface DayRevenue { day: string; totalAmount: number; billCount: number; }

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

  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="bg-card border rounded-2xl p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> 7-Day Revenue</h2>
        <Link href="/report" className="text-xs font-bold text-primary hover:underline">Full Report →</Link>
      </div>
      {loading ? (
        <div className="h-28 flex items-center justify-center"><Skeleton className="w-full h-24 rounded-xl" /></div>
      ) : data.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No sales data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="day" tickFormatter={fmt} tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} labelFormatter={fmt}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
            <Bar dataKey="totalAmount" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

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

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: activity, isLoading: loadingActivity } = useGetTodayActivity({ query: { queryKey: getGetTodayActivityQueryKey() } });
  const { data: lowStock, isLoading: loadingLowStock } = useGetLowStockProducts({ query: { queryKey: getGetLowStockProductsQueryKey() } });
  const { data: categories, isLoading: loadingCategories } = useGetCategoryBreakdown({ query: { queryKey: getGetCategoryBreakdownQueryKey() } });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Mobile-only header */}
      <div className="flex items-center justify-between mb-2 md:hidden">
        <h1 className="text-2xl font-black text-foreground tracking-tight">ToyMall</h1>
        <div className="flex items-center gap-2">
          <LiveBadge />
          <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20">Staff View</Badge>
        </div>
      </div>

      {/* Desktop page title */}
      <div className="hidden md:flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your inventory · updates in real time</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge />
          <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">Staff View</Badge>
        </div>
      </div>

      {/* Stats grid: 2 cols on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Products" value={summary?.totalProducts} icon={Package} loading={loadingSummary} testid="stat-total-products" />
        <StatCard title="Stock Value" value={summary ? `₹${summary.totalStockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : undefined} icon={IndianRupee} loading={loadingSummary} testid="stat-stock-value" />
        <StatCard title="Today IN" value={activity?.inQuantity} subtitle={`${activity?.inCount ?? 0} transactions`} icon={ArrowDownToLine} loading={loadingActivity} className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900" valueClassName="text-green-700 dark:text-green-400" testid="stat-today-in" />
        <StatCard title="Today OUT" value={activity?.outQuantity} subtitle={`${activity?.outCount ?? 0} transactions`} icon={ArrowUpToLine} loading={loadingActivity} className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" valueClassName="text-red-700 dark:text-red-400" testid="stat-today-out" />
      </div>

      {/* Revenue chart */}
      <RevenueChart />

      {/* Quick-access tiles for new sections */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
        {[
          { href: "/report",    icon: FileText, label: "Reports",   desc: "EOD summary & trends",  color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30"   },
          { href: "/customers", icon: Users,    label: "Customers", desc: "Purchase history",       color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
          { href: "/labels",    icon: Tag,      label: "Labels",    desc: "Print QR shelf tags",    color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
          { href: "/suppliers", icon: Truck,    label: "Suppliers", desc: "Manage vendors",         color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30"  },
        ].map(({ href, icon: Icon, label, desc, color, bg }) => (
          <Link key={href} href={href}
            className={`flex flex-col p-3 rounded-2xl border ${bg} hover:opacity-90 active:scale-[0.97] transition-all`}>
            <Icon className={`w-5 h-5 mb-1.5 ${color}`} />
            <p className={`font-black text-sm ${color}`}>{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Two column on desktop for alerts + categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* Low Stock Alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-5 h-5" />
              Low Stock Alerts
            </h2>
            {summary?.lowStockCount !== undefined && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold">{summary.lowStockCount}</Badge>
            )}
          </div>

          {loadingLowStock ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : !lowStock || lowStock.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-6 text-center border border-dashed">
              <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">All stock levels look good!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(product => (
                <Link key={product.id} href={`/product?sku=${product.sku}`} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-red-600 dark:text-red-400 leading-none">{product.stock}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Left</p>
                    </div>
                  </div>
                </Link>
              ))}
              {lowStock.length > 6 && (
                <Link href="/products?lowStock=true" className="block text-center text-sm font-bold text-primary p-2">
                  View all {lowStock.length} alerts →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Layers className="text-primary w-5 h-5" />
            Categories
          </h2>
          {loadingCategories ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {categories?.map(cat => (
                <div key={cat.category} className="p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors">
                  <p className="font-bold text-sm truncate mb-1">{cat.category}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-2xl font-black leading-none">{cat.totalStock}</p>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Items</p>
                      <p className="text-[10px] text-muted-foreground">{cat.productCount} SKUs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, loading, className = "", valueClassName = "", testid }: {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon: React.ElementType;
  loading?: boolean;
  className?: string;
  valueClassName?: string;
  testid?: string;
}) {
  return (
    <Card className={className} data-testid={testid}>
      <CardContent className="p-4 flex flex-col items-start justify-between h-full min-h-[100px]">
        <div className="flex items-center justify-between w-full mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
          <Icon className="w-4 h-4 opacity-50" />
        </div>
        <div className="mt-auto w-full">
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className={`text-2xl font-black leading-none tracking-tight ${valueClassName}`}>{value ?? 0}</p>
          )}
          {subtitle && <p className="text-[10px] mt-1 font-semibold opacity-70">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
