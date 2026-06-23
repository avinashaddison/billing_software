import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  BarChart3, TrendingUp, IndianRupee, FileText, ShoppingBag, Loader2,
  Trophy, Download, RefreshCw, Package, Activity,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ──────────────────────────────────────────────────────── */
interface DayRevenue { day: string; totalAmount: number; billCount: number; itemsCount: number; }
interface SkuPerf {
  productId:    string;
  productName:  string;
  productSku:   string;
  category:     string;
  totalQty:     number;
  totalRevenue: number;
  billCount:    number;
  profit:       number | null;
  margin:       number | null;
}
type Metric = "totalRevenue" | "totalQty";

/* ── Utilities ──────────────────────────────────────────────────── */
const fmt  = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmt2 = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── Reusable bits ──────────────────────────────────────────────── */
const ACCENTS = {
  green:  { iconBg: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "from-emerald-500/8" },
  blue:   { iconBg: "bg-blue-500",    text: "text-blue-700 dark:text-blue-400",       bg: "from-blue-500/8" },
  purple: { iconBg: "bg-purple-500",  text: "text-purple-700 dark:text-purple-400",   bg: "from-purple-500/8" },
  teal:   { iconBg: "bg-teal-500",    text: "text-teal-700 dark:text-teal-400",       bg: "from-teal-500/8" },
} as const;
function Kpi({ label, value, icon: Icon, accent, hint }: {
  label: string; value: string; icon: React.ElementType;
  accent: keyof typeof ACCENTS; hint?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="relative bg-card border rounded-2xl overflow-hidden p-4 shadow-sm">
      <div className={`absolute inset-0 bg-gradient-to-br ${a.bg} to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest leading-tight">{label}</p>
          <div className={`w-7 h-7 rounded-xl ${a.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <p className={`text-2xl font-black leading-none tracking-tight ${a.text}`}>{value}</p>
        {hint && <p className="text-[10px] font-bold text-muted-foreground mt-2">{hint}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, action, children }: {
  title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-black flex items-center gap-2 text-sm">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function Analytics() {
  const [days, setDays]       = useState(30);
  const [revenue, setRevenue] = useState<DayRevenue[]>([]);
  const [skus, setSkus]       = useState<SkuPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric]   = useState<Metric>("totalQty");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [r, s] = await Promise.all([
        fetch(`${BASE_URL}/api/reports/revenue?days=${days}`).then((x) => (x.ok ? x.json() : [])),
        fetch(`${BASE_URL}/api/reports/sku-performance?days=${days}`).then((x) => (x.ok ? x.json() : [])),
      ]);
      setRevenue(Array.isArray(r) ? r : []);

      let skuData: SkuPerf[] = Array.isArray(s) ? s : [];
      /* Fallback for API builds that don't yet expose /reports/sku-performance.
         We aggregate the per-day end-of-day top-products (which ARE bill-based
         and current) across the days in the window that actually had sales.
         This keeps the data correct AND range-aware without an API restart.
         Note: EOD returns each day's top 10, so this is a close approximation;
         the real endpoint (after restart) is exact and adds bill counts. */
      if (skuData.length === 0) {
        const activeDays = (Array.isArray(r) ? r : [])
          .filter((d: DayRevenue) => d.totalAmount > 0)
          .map((d: DayRevenue) => d.day)
          .slice(-31);
        if (activeDays.length) {
          const eods = await Promise.all(
            activeDays.map((day) =>
              fetch(`${BASE_URL}/api/reports/end-of-day?date=${day}`)
                .then((x) => (x.ok ? x.json() : null))
                .catch(() => null)),
          );
          const map = new Map<string, SkuPerf>();
          for (const e of eods) {
            if (!e || !Array.isArray(e.topProducts)) continue;
            for (const p of e.topProducts) {
              const key = p.productId ?? p.productSku;
              if (!key) continue;
              const cur = map.get(key) ?? {
                productId: p.productId ?? key, productName: p.productName ?? "Unknown",
                productSku: p.productSku ?? "—", category: "",
                totalQty: 0, totalRevenue: 0, billCount: 0, profit: null, margin: null,
              };
              cur.totalQty     += Number(p.totalQty)     || 0;
              cur.totalRevenue += Number(p.totalRevenue)  || 0;
              if (p.profit != null) cur.profit = (cur.profit ?? 0) + Number(p.profit);
              map.set(key, cur);
            }
          }
          skuData = Array.from(map.values()).map((s2) => ({
            ...s2,
            margin: s2.profit != null && s2.totalRevenue > 0
              ? (s2.profit / s2.totalRevenue) * 100
              : null,
          }));
        }
      }
      setSkus(skuData);
    } catch {
      /* keep last good data */
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const formatDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  /* Window totals derived from the daily revenue series. */
  const totals = useMemo(() => {
    const totalRevenue = revenue.reduce((s, r) => s + r.totalAmount, 0);
    const totalBills   = revenue.reduce((s, r) => s + r.billCount, 0);
    const totalItems   = revenue.reduce((s, r) => s + r.itemsCount, 0);
    const best         = revenue.reduce<DayRevenue | null>((b, r) => (!b || r.totalAmount > b.totalAmount ? r : b), null);
    return {
      totalRevenue, totalBills, totalItems,
      avgBill: totalBills > 0 ? totalRevenue / totalBills : 0,
      best,
    };
  }, [revenue]);

  /* SKU list ordered by the active metric, plus a top-8 slice for the chart. */
  const rankedSkus = useMemo(
    () => [...skus].sort((a, b) => b[metric] - a[metric]),
    [skus, metric],
  );
  const chartSkus = useMemo(
    () => rankedSkus.slice(0, 8).map((s) => ({
      name: s.productName.length > 14 ? s.productName.slice(0, 13) + "…" : s.productName,
      value: s[metric],
    })),
    [rankedSkus, metric],
  );

  const exportSkuCsv = () => {
    downloadCsv(`sku-performance-${days}d.csv`, [
      ["Rank", "Product", "SKU", "Category", "Units Sold", "Revenue", "Bills", "Profit", "Margin %"],
      ...rankedSkus.map((s, i) => [
        i + 1, s.productName, s.productSku, s.category, s.totalQty, s.totalRevenue,
        s.billCount, s.profit ?? "", s.margin != null ? s.margin.toFixed(1) : "",
      ]),
    ]);
  };

  const noSales = revenue.every((r) => r.totalAmount === 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="px-4 md:px-6 pt-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Analytics
            <span className="hidden md:inline text-xs font-bold text-muted-foreground ml-2">Last {days} days</span>
          </h1>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-2 pb-3">
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {[7, 14, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 h-8 rounded-lg text-xs font-bold transition-all ${days === d ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6 p-4 md:p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Revenue"  accent="green"  icon={IndianRupee} value={fmt(totals.totalRevenue)} hint={`over ${days} days`} />
              <Kpi label="Bills"    accent="blue"   icon={FileText}    value={fmt2(totals.totalBills)}  hint={`${fmt2(totals.totalItems)} items sold`} />
              <Kpi label="Avg Bill" accent="purple" icon={ShoppingBag} value={fmt(totals.avgBill)}      hint="revenue per bill" />
              <Kpi label="Best Day" accent="teal"   icon={TrendingUp}  value={totals.best && totals.best.totalAmount > 0 ? fmt(totals.best.totalAmount) : "—"} hint={totals.best && totals.best.totalAmount > 0 ? formatDay(totals.best.day) : "no sales yet"} />
            </div>

            {/* Sales trend */}
            <SectionCard title="Sales Trend" icon={TrendingUp}>
              {noSales ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No sales in this window</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={revenue} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="anaRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                      labelFormatter={formatDay}
                      contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                    />
                    <Area type="monotone" dataKey="totalAmount" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#anaRevGrad)" dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Bills per day */}
            <SectionCard title="Bills Per Day" icon={Activity}>
              {noSales ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No bills in this window</div>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={revenue} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={20} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number) => [`${v}`, "Bills"]}
                      labelFormatter={formatDay}
                      contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                    />
                    <Bar dataKey="billCount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* SKU performance */}
            <SectionCard
              title="Top Selling Products"
              icon={Trophy}
              action={
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                    {([
                      { id: "totalRevenue", label: "Revenue" },
                      { id: "totalQty",     label: "Units" },
                    ] as { id: Metric; label: string }[]).map((m) => (
                      <button key={m.id} onClick={() => setMetric(m.id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                          metric === m.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {rankedSkus.length > 0 && (
                    <button onClick={exportSkuCsv}
                      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted transition-colors">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                </div>
              }
            >
              {rankedSkus.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-sm">No product sales yet</p>
                  <p className="text-xs text-muted-foreground">Make some sales to see your best sellers here.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(140, chartSkus.length * 34)}>
                    <BarChart data={chartSkus} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => (metric === "totalRevenue" ? `₹${fmt2(v as number)}` : fmt2(v as number))} />
                      <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: number) => [metric === "totalRevenue" ? `₹${v.toLocaleString("en-IN")}` : `${v} units`, metric === "totalRevenue" ? "Revenue" : "Units"]}
                        contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartSkus.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#f59e0b" : "hsl(var(--primary))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-2 mt-3">
                    {rankedSkus.slice(0, 20).map((s, i) => (
                      <div key={s.productId} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          i === 0 ? "bg-amber-400 text-amber-900"
                          : i === 1 ? "bg-zinc-400 text-zinc-900"
                          : i === 2 ? "bg-orange-400 text-orange-900"
                          : "bg-muted text-muted-foreground"
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{s.productName}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{s.productSku}{s.billCount > 0 ? ` · ${s.billCount} bill${s.billCount === 1 ? "" : "s"}` : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm tabular-nums">{metric === "totalRevenue" ? fmt(s.totalRevenue) : `${s.totalQty} units`}</p>
                          <p className="text-xs text-muted-foreground">{metric === "totalRevenue" ? `${s.totalQty} units` : fmt(s.totalRevenue)}</p>
                          {s.margin != null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              s.margin >= 30 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : s.margin >= 15 ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                            }`}>
                              {s.margin.toFixed(0)}% margin
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
