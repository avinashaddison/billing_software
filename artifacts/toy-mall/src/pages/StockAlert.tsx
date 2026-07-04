import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, PackageX, Package, IndianRupee, RefreshCw, Loader2,
  ArrowDownToLine, ArrowUpToLine, SlidersHorizontal, Download, Boxes,
  ChevronRight, Activity,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ──────────────────────────────────────────────────────── */
interface Summary {
  totalProducts:   number;
  totalStock:      number;
  totalStockValue: number;
  lowStockCount:   number;
  todayInCount:    number;
  todayOutCount:   number;
}
interface Product {
  id:                string;
  name:              string;
  sku:               string;
  category:          string;
  price:             number;
  stock:             number;
  lowStockThreshold: number;
  imageUrl:          string | null;
}
type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "RETURN";
interface StockLog {
  id:          string;
  productId:   string;
  productName: string;
  productSku:  string;
  type:        MovementType;
  quantity:    number;
  createdAt:   string;
}

type Tab = "alerts" | "movement";

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

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ── Reusable bits ──────────────────────────────────────────────── */
const ACCENTS = {
  green:  { iconBg: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", bg: "from-emerald-500/8" },
  blue:   { iconBg: "bg-blue-500",    text: "text-blue-700 dark:text-blue-400",       bg: "from-blue-500/8" },
  amber:  { iconBg: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400",     bg: "from-amber-500/8" },
  rose:   { iconBg: "bg-rose-500",    text: "text-rose-700 dark:text-rose-400",       bg: "from-rose-500/8" },
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
export default function StockAlert() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("alerts");
  const [moveFilter, setMoveFilter] = useState<MovementType | "all">("all");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const typeQs = moveFilter === "all" ? "" : `&type=${moveFilter}`;
      const [s, p, l] = await Promise.all([
        fetch(`${BASE_URL}/api/dashboard/summary`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${BASE_URL}/api/products?lowStock=true`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${BASE_URL}/api/stock-logs?limit=100${typeQs}`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setSummary(s);
      setLowStock(Array.isArray(p) ? p : []);
      setLogs(Array.isArray(l) ? l : []);
    } catch {
      /* keep last good data */
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [moveFilter]);

  useEffect(() => { void load(); }, [load]);

  /* Live updates — refetch quietly when stock changes anywhere in the app. */
  useEffect(() => {
    const es = new EventSource(`${BASE_URL}/api/events`);
    const refetch = () => { void load(true); };
    ["bill_created", "stock_updated", "product_updated", "product_created", "low_stock_alert"]
      .forEach((evt) => es.addEventListener(evt, refetch));
    return () => es.close();
  }, [load]);

  /* Out of stock = subset of low-stock list with zero on hand. */
  const outOfStock = useMemo(() => lowStock.filter((p) => p.stock <= 0), [lowStock]);
  const lowOnly    = useMemo(() => lowStock.filter((p) => p.stock > 0), [lowStock]);

  /* Severity sort: out of stock first, then closest-to-threshold ratio. */
  const sortedAlerts = useMemo(
    () => [...lowStock].sort((a, b) => {
      if (a.stock === 0 && b.stock !== 0) return -1;
      if (b.stock === 0 && a.stock !== 0) return 1;
      const ra = a.lowStockThreshold > 0 ? a.stock / a.lowStockThreshold : a.stock;
      const rb = b.lowStockThreshold > 0 ? b.stock / b.lowStockThreshold : b.stock;
      return ra - rb;
    }),
    [lowStock],
  );

  const exportReorderCsv = () => {
    downloadCsv(`reorder-list-${new Date().toLocaleDateString("en-CA")}.csv`, [
      ["Product", "SKU", "Category", "On Hand", "Reorder Below", "Suggested Order", "Unit Price"],
      ...sortedAlerts.map((p) => [
        p.name, p.sku, p.category, p.stock, p.lowStockThreshold,
        Math.max(p.lowStockThreshold * 2 - p.stock, 0), p.price,
      ]),
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="px-4 md:px-6 pt-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Stock Alert
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          </h1>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {([
            { id: "alerts",   label: "Low Stock",  Icon: AlertTriangle },
            { id: "movement", label: "Movement",   Icon: Activity },
          ] as { id: Tab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-colors ${
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
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
            {/* KPI strip — shown on both tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Total SKUs"   accent="blue"  icon={Boxes}        value={fmt2(summary?.totalProducts ?? 0)} hint={`${fmt2(summary?.totalStock ?? 0)} units on hand`} />
              <Kpi label="Stock Value"  accent="green" icon={IndianRupee}  value={fmt(summary?.totalStockValue ?? 0)} hint="at selling price" />
              <Kpi label="Low Stock"    accent="amber" icon={AlertTriangle} value={fmt2(lowOnly.length)} hint="at or below reorder level" />
              <Kpi label="Out of Stock" accent="rose"  icon={PackageX}     value={fmt2(outOfStock.length)} hint={outOfStock.length ? "needs restock now" : "all good"} />
            </div>

            {tab === "alerts" && (
              <SectionCard
                title="Items To Reorder"
                icon={AlertTriangle}
                action={
                  sortedAlerts.length > 0 && (
                    <button onClick={exportReorderCsv}
                      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted transition-colors">
                      <Download className="w-3 h-3" /> Reorder CSV
                    </button>
                  )
                }
              >
                {sortedAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <Package className="w-6 h-6 text-emerald-500" />
                    </div>
                    <p className="font-bold text-sm">Everything's well stocked</p>
                    <p className="text-xs text-muted-foreground">No products are at or below their reorder level.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedAlerts.map((p) => {
                      const out = p.stock <= 0;
                      return (
                        <Link key={p.id} href={`/product?id=${p.id}`}
                          className="flex items-center gap-3 p-2.5 rounded-xl border bg-muted/40 hover:bg-muted transition-colors group">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${out ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                            {out ? <PackageX className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{p.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{p.sku} · {p.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-black text-sm tabular-nums ${out ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                              {p.stock} left
                            </p>
                            <p className="text-[10px] text-muted-foreground">reorder ≤ {p.lowStockThreshold}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}

            {tab === "movement" && (
              <SectionCard
                title="Stock Movement"
                icon={Activity}
                action={
                  <div className="flex gap-1">
                    {(["all", "IN", "OUT", "ADJUSTMENT"] as const).map((t) => (
                      <button key={t} onClick={() => setMoveFilter(t)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                          moveFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}>
                        {t === "all" ? "All" : t === "ADJUSTMENT" ? "Adj" : t}
                      </button>
                    ))}
                  </div>
                }
              >
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">No stock movements recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((l) => {
                      const isIn  = l.type === "IN";
                      const isOut = l.type === "OUT";
                      return (
                        <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-xl border bg-card">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isIn ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : isOut ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}>
                            {isIn ? <ArrowDownToLine className="w-4 h-4" /> : isOut ? <ArrowUpToLine className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{l.productName}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{l.productSku} · {timeAgo(l.createdAt)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-black text-sm tabular-nums ${
                              isIn ? "text-emerald-600 dark:text-emerald-400" : isOut ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"
                            }`}>
                              {isIn || l.type === "RETURN" ? "+" : isOut ? "−" : "±"}{l.quantity}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {l.type === "ADJUSTMENT" ? "Adjust" : l.type === "IN" ? "Stock In" : l.type === "RETURN" ? "Return" : "Sold"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}
