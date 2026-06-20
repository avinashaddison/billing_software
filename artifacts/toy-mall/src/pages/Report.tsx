import { useState, useEffect, useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  FileText, Printer, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  IndianRupee, ShoppingBag, Package, Banknote, Smartphone, Loader2,
  HandCoins, Users, Tag, Undo2, Download, Clock, Trophy, Sparkles,
  Activity,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ──────────────────────────────────────────────────────── */
interface DayRevenue   { day: string; totalAmount: number; billCount: number; itemsCount: number; }
interface TopProduct   { productName: string; productSku: string; totalQty: number; totalRevenue: number; profit: number | null; margin: number | null; }
interface TopCustomer  { customerPhone: string | null; customerName: string | null; totalSpent: number; billCount: number; }
interface HourBucket   { hour: number; totalAmount: number; billCount: number; }
interface PeriodTotals { totalAmount: number; billCount: number; itemsSold: number; }

interface EodReport {
  date:           string;
  totalAmount:    number;
  billCount:      number;
  itemsSold:      number;
  uniqueCustomers: number;
  grossProfit:    number;
  totalCost:      number;
  margin:         number;
  profitCoverage: number;
  cashSales:      number;
  upiSales:       number;
  creditSales:    number;
  duesCreated:    number;
  duesCollected:  number;
  discount:       number;
  returnsTotal:   number;
  returnsCount:   number;
  stockIn:        { totalUnits: number; txCount: number };
  yesterday:      PeriodTotals;
  lastWeek:       PeriodTotals;
  hourly:         HourBucket[];
  topProducts:    TopProduct[];
  topCustomers:   TopCustomer[];
}

type Tab = "overview" | "sales" | "receivables" | "inventory" | "customers";

/* ── Utilities ──────────────────────────────────────────────────── */
function todayIndia() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const fmt   = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmt2  = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return null;          // avoid Infinity — UI shows "—"
  return ((curr - prev) / prev) * 100;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      // Escape quotes + wrap if contains comma/quote/newline
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
function DeltaChip({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
        — {suffix}
      </span>
    );
  }
  const up   = value > 0;
  const flat = Math.abs(value) < 0.5;
  const cls  = flat
    ? "bg-muted text-muted-foreground"
    : up
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  const Icon = flat ? Activity : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {fmtPct(value)} {suffix}
    </span>
  );
}

interface KpiProps {
  label:    string;
  value:    string;
  icon:     React.ElementType;
  accent:   "green" | "blue" | "purple" | "orange" | "rose" | "amber" | "teal";
  delta?:   number | null;
  deltaLbl?: string;
  hint?:    string;
}
const ACCENTS: Record<KpiProps["accent"], { bg: string; iconBg: string; text: string }> = {
  green:  { bg: "from-emerald-500/8 to-transparent",  iconBg: "bg-emerald-500",  text: "text-emerald-700 dark:text-emerald-400" },
  blue:   { bg: "from-blue-500/8 to-transparent",     iconBg: "bg-blue-500",     text: "text-blue-700 dark:text-blue-400" },
  purple: { bg: "from-purple-500/8 to-transparent",   iconBg: "bg-purple-500",   text: "text-purple-700 dark:text-purple-400" },
  orange: { bg: "from-orange-500/8 to-transparent",   iconBg: "bg-orange-500",   text: "text-orange-700 dark:text-orange-400" },
  rose:   { bg: "from-rose-500/8 to-transparent",     iconBg: "bg-rose-500",     text: "text-rose-700 dark:text-rose-400" },
  amber:  { bg: "from-amber-500/8 to-transparent",    iconBg: "bg-amber-500",    text: "text-amber-700 dark:text-amber-400" },
  teal:   { bg: "from-teal-500/8 to-transparent",     iconBg: "bg-teal-500",     text: "text-teal-700 dark:text-teal-400" },
};
function Kpi({ label, value, icon: Icon, accent, delta, deltaLbl, hint }: KpiProps) {
  const a = ACCENTS[accent];
  return (
    <div className="relative bg-card border rounded-2xl overflow-hidden p-4 shadow-sm">
      <div className={`absolute inset-0 bg-gradient-to-br ${a.bg} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest leading-tight">{label}</p>
          <div className={`w-7 h-7 rounded-xl ${a.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
        <p className={`text-2xl font-black leading-none tracking-tight ${a.text}`}>{value}</p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {delta !== undefined && <DeltaChip value={delta} suffix={deltaLbl} />}
          {hint && <span className="text-[10px] font-bold text-muted-foreground">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title, icon: Icon, action, children,
}: {
  title:   string;
  icon:    React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
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

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="no-print flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted transition-colors"
    >
      <Download className="w-3 h-3" /> CSV
    </button>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function Report() {
  const [date, setDate]       = useState(todayIndia);
  const [eod, setEod]         = useState<EodReport | null>(null);
  const [revenue, setRevenue] = useState<DayRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [revDays, setRevDays] = useState(7);
  const [tab, setTab]         = useState<Tab>("overview");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE_URL}/api/reports/end-of-day?date=${date}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BASE_URL}/api/reports/revenue?days=${revDays}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([e, r]) => { setEod(e); setRevenue(Array.isArray(r) ? r : []); })
      .catch(() => { setEod(null); setRevenue([]); })
      .finally(() => setLoading(false));
  }, [date, revDays]);

  const stepDate = (delta: number) => {
    const [yyyy, mm, dd] = date.split("-").map(Number);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    d.setUTCDate(d.getUTCDate() + delta);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dateVal = String(d.getUTCDate()).padStart(2, "0");
    setDate(`${y}-${m}-${dateVal}`);
  };

  const formatDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const isToday   = date === todayIndia();

  /* Deltas — fall back to null when there's no comparison base */
  const deltaRev   = eod ? pctDelta(eod.totalAmount, eod.yesterday.totalAmount) : null;
  const deltaBills = eod ? pctDelta(eod.billCount,   eod.yesterday.billCount)   : null;
  const deltaWeek  = eod ? pctDelta(eod.totalAmount, eod.lastWeek.totalAmount)  : null;

  /* Quick presets */
  const setRelative = (days: number) => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    d.setDate(d.getDate() - days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  };

  /* CSV builders — colocated with the data so they pick up format changes */
  const downloadOverviewCsv = () => {
    if (!eod) return;
    downloadCsv(`overview-${eod.date}.csv`, [
      ["Metric", "Value"],
      ["Date", eod.date],
      ["Total Revenue", eod.totalAmount],
      ["Bills", eod.billCount],
      ["Items Sold", eod.itemsSold],
      ["Unique Customers", eod.uniqueCustomers],
      ["Gross Profit", eod.grossProfit],
      ["Total Cost", eod.totalCost],
      ["Margin %", eod.margin.toFixed(2)],
      ["Cash Sales", eod.cashSales],
      ["UPI Sales", eod.upiSales],
      ["Credit Sales", eod.creditSales],
      ["Dues Collected", eod.duesCollected],
      ["Discount Given", eod.discount],
      ["Returns Total", eod.returnsTotal],
    ]);
  };
  const downloadProductsCsv = () => {
    if (!eod) return;
    downloadCsv(`top-products-${eod.date}.csv`, [
      ["Rank", "Product", "SKU", "Qty", "Revenue", "Profit", "Margin %"],
      ...eod.topProducts.map((p, i) => [
        i + 1, p.productName, p.productSku, p.totalQty, p.totalRevenue,
        p.profit ?? "", p.margin != null ? p.margin.toFixed(1) : "",
      ]),
    ]);
  };
  const downloadCustomersCsv = () => {
    if (!eod) return;
    downloadCsv(`top-customers-${eod.date}.csv`, [
      ["Rank", "Customer", "Phone", "Bills", "Total Spent"],
      ...eod.topCustomers.map((c, i) => [
        i + 1, c.customerName ?? "", c.customerPhone ?? "", c.billCount, c.totalSpent,
      ]),
    ]);
  };
  const downloadHourlyCsv = () => {
    if (!eod) return;
    downloadCsv(`hourly-${eod.date}.csv`, [
      ["Hour", "Revenue", "Bills"],
      ...eod.hourly.map((h) => [h.hour, h.totalAmount, h.billCount]),
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Sticky header: title + period selector + actions ── */}
      <div className="px-4 md:px-6 pt-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10 print:static print:bg-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Reports
            <span className="hidden md:inline text-xs font-bold text-muted-foreground ml-2">
              {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </h1>
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 pb-3 flex-wrap no-print">
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            <button onClick={() => setDate(todayIndia())}
              className={`px-3 h-8 rounded-lg text-xs font-bold transition-all ${isToday ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Today
            </button>
            <button onClick={() => setRelative(1)}
              className={`px-3 h-8 rounded-lg text-xs font-bold transition-all ${date === (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); })() ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Yesterday
            </button>
            <button onClick={() => setRelative(7)}
              className="px-3 h-8 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground transition-all">
              7d ago
            </button>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            <button onClick={() => stepDate(-1)} className="w-7 h-7 rounded-md hover:bg-background flex items-center justify-center active:scale-90 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input type="date" value={date} max={todayIndia()}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-bold bg-transparent border-0 focus:outline-none cursor-pointer text-center w-28" />
            <button onClick={() => stepDate(1)} disabled={isToday}
              className="w-7 h-7 rounded-md hover:bg-background flex items-center justify-center active:scale-90 transition-all disabled:opacity-30">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px overflow-x-auto no-print">
          {([
            { id: "overview",    label: "Overview",    Icon: Sparkles },
            { id: "sales",       label: "Sales",       Icon: TrendingUp },
            { id: "receivables", label: "Receivables", Icon: HandCoins },
            { id: "inventory",   label: "Inventory",   Icon: Package },
            { id: "customers",   label: "Customers",   Icon: Users },
          ] as { id: Tab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 border-b-2 transition-colors shrink-0 ${
                tab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6 p-4 md:p-6 space-y-5 print:p-2">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && eod && (
          <>
            {tab === "overview" && (
              <OverviewTab
                eod={eod} revenue={revenue} revDays={revDays} setRevDays={setRevDays}
                deltaRev={deltaRev} deltaBills={deltaBills} deltaWeek={deltaWeek}
                formatDay={formatDay} onCsv={downloadOverviewCsv}
              />
            )}
            {tab === "sales" && (
              <SalesTab eod={eod} onProductsCsv={downloadProductsCsv} onHourlyCsv={downloadHourlyCsv} />
            )}
            {tab === "receivables" && (
              <ReceivablesTab eod={eod} />
            )}
            {tab === "inventory" && (
              <InventoryTab eod={eod} />
            )}
            {tab === "customers" && (
              <CustomersTab eod={eod} onCsv={downloadCustomersCsv} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Overview tab — the at-a-glance EOD
 * ═══════════════════════════════════════════════════════════════════ */
function OverviewTab({
  eod, revenue, revDays, setRevDays, deltaRev, deltaBills, deltaWeek, formatDay, onCsv,
}: {
  eod: EodReport;
  revenue: DayRevenue[];
  revDays: number;
  setRevDays: (n: number) => void;
  deltaRev:   number | null;
  deltaBills: number | null;
  deltaWeek:  number | null;
  formatDay:  (d: string) => string;
  onCsv:      () => void;
}) {
  const PAYMENT_COLORS = ["#f59e0b", "#3b82f6", "#e11d48"]; // cash, upi, credit
  const paymentData = useMemo(() => ([
    { name: "Cash",   value: eod.cashSales,   color: PAYMENT_COLORS[0] },
    { name: "UPI",    value: eod.upiSales,    color: PAYMENT_COLORS[1] },
    { name: "Credit", value: eod.creditSales, color: PAYMENT_COLORS[2] },
  ].filter((d) => d.value > 0)), [eod]);

  return (
    <>
      {/* Hero KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Revenue"     accent="green"  icon={IndianRupee} value={fmt(eod.totalAmount)}  delta={deltaRev}   deltaLbl="vs yest" />
        <Kpi label="Profit"      accent="teal"   icon={TrendingUp}  value={fmt(eod.grossProfit)}  hint={eod.profitCoverage > 0 ? `${eod.margin.toFixed(0)}% margin` : "set cost prices for margin"} />
        <Kpi label="Bills"       accent="blue"   icon={FileText}    value={fmt2(eod.billCount)}   delta={deltaBills} deltaLbl="vs yest" />
        <Kpi label="Customers"   accent="purple" icon={Users}       value={fmt2(eod.uniqueCustomers)} hint={`${fmt2(eod.itemsSold)} items sold`} />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Dues Created"   accent="rose"   icon={HandCoins} value={fmt(eod.duesCreated)}   hint={eod.duesCreated  > 0 ? "from credit sales" : "no credit today"} />
        <Kpi label="Dues Collected" accent="green"  icon={Banknote}  value={fmt(eod.duesCollected)} hint="paid against bills today" />
        <Kpi label="Discount Given" accent="amber"  icon={Tag}       value={fmt(eod.discount)}      hint={eod.totalAmount > 0 ? `${((eod.discount/(eod.totalAmount+eod.discount))*100).toFixed(1)}% of pre-discount` : ""} />
        <Kpi label="Returns"        accent="orange" icon={Undo2}     value={fmt(eod.returnsTotal)}  hint={`${eod.returnsCount} return${eod.returnsCount === 1 ? "" : "s"}`} />
      </div>

      {/* Revenue Trend (multi-day) */}
      <SectionCard
        title="Revenue Trend"
        icon={TrendingUp}
        action={
          <div className="flex gap-1 no-print">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setRevDays(d)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${revDays === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {d}d
              </button>
            ))}
          </div>
        }
      >
        {revenue.every((r) => r.totalAmount === 0) ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No sales data in this window</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenue} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                labelFormatter={formatDay}
                contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
              />
              <Area type="monotone" dataKey="totalAmount" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {deltaWeek !== null && (
          <p className="text-[11px] text-muted-foreground mt-2 font-semibold">
            Today vs same day last week: <DeltaChip value={deltaWeek} />
          </p>
        )}
      </SectionCard>

      {/* Payment-mode pie + Export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Payment Mix" icon={Banknote}>
          {paymentData.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No bills on this date</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={150}>
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}>
                    {paymentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {paymentData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="font-bold">{d.name}</span>
                    </span>
                    <span className="tabular-nums font-black">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Export"
          icon={Download}
          action={<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CSV</span>}
        >
          <div className="grid grid-cols-2 gap-2 no-print">
            <button onClick={onCsv} className="text-left p-3 rounded-xl border bg-card hover:bg-muted transition-colors">
              <p className="text-xs font-black">Overview</p>
              <p className="text-[10px] text-muted-foreground">All EOD totals</p>
            </button>
            <button onClick={() => window.print()} className="text-left p-3 rounded-xl border bg-card hover:bg-muted transition-colors">
              <p className="text-xs font-black">Full Page PDF</p>
              <p className="text-[10px] text-muted-foreground">via browser print</p>
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 print:hidden">
            Each tab has its own CSV button — switch tabs to export top products, customers, hourly, etc.
          </p>
        </SectionCard>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Sales tab — hourly + top products
 * ═══════════════════════════════════════════════════════════════════ */
function SalesTab({
  eod, onProductsCsv, onHourlyCsv,
}: {
  eod: EodReport;
  onProductsCsv: () => void;
  onHourlyCsv:   () => void;
}) {
  const peakHour = eod.hourly.reduce((p, h) => (h.totalAmount > p.totalAmount ? h : p), eod.hourly[0] ?? { hour: 0, totalAmount: 0, billCount: 0 });

  return (
    <>
      <SectionCard
        title="Hourly Distribution"
        icon={Clock}
        action={<CsvButton onClick={onHourlyCsv} />}
      >
        {eod.billCount === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No bills on this date</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={eod.hourly} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  labelFormatter={(h) => `${h}:00 – ${h}:59`}
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                />
                <Bar dataKey="totalAmount" radius={[4, 4, 0, 0]}>
                  {eod.hourly.map((h, i) => (
                    <Cell key={i} fill={h.hour === peakHour.hour && peakHour.totalAmount > 0 ? "#10b981" : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {peakHour.totalAmount > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 font-semibold">
                Peak hour: <b className="text-emerald-600 dark:text-emerald-400">{peakHour.hour}:00 – {peakHour.hour}:59</b> · {fmt(peakHour.totalAmount)} across {peakHour.billCount} bill{peakHour.billCount === 1 ? "" : "s"}
              </p>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Top Selling Products"
        icon={Trophy}
        action={<CsvButton onClick={onProductsCsv} />}
      >
        {eod.topProducts.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-6">No products sold on this date</p>
        ) : (
          <div className="space-y-2">
            {eod.topProducts.map((p, i) => (
              <div key={p.productSku} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                  i === 0 ? "bg-amber-400 text-amber-900"
                  : i === 1 ? "bg-zinc-400 text-zinc-900"
                  : i === 2 ? "bg-orange-400 text-orange-900"
                  : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.productName}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{p.productSku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-sm">{p.totalQty} units</p>
                  <p className="text-xs text-muted-foreground">{fmt(p.totalRevenue)}</p>
                  {p.margin != null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      p.margin >= 30 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : p.margin >= 15 ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                    }`}>
                      {p.margin.toFixed(0)}% margin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Receivables tab — dues movement
 * ═══════════════════════════════════════════════════════════════════ */
function ReceivablesTab({ eod }: { eod: EodReport }) {
  const net = eod.duesCollected - eod.duesCreated;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Dues Created Today"   accent="rose"  icon={HandCoins} value={fmt(eod.duesCreated)}   hint="new credit sales" />
        <Kpi label="Dues Collected Today" accent="green" icon={Banknote}  value={fmt(eod.duesCollected)} hint="payments received" />
        <Kpi label="Net Movement"         accent={net >= 0 ? "green" : "rose"} icon={net >= 0 ? TrendingUp : TrendingDown}
             value={`${net >= 0 ? "+" : ""}${fmt(net)}`} hint={net >= 0 ? "you collected more than lent" : "more credit went out"} />
      </div>

      <SectionCard title="What's Happening Here" icon={Sparkles}>
        <div className="text-sm space-y-2 text-muted-foreground leading-relaxed">
          <p>
            <b className="text-foreground">Dues Created</b> = total value of credit-mode sales today
            (bill goes out, money doesn't).
          </p>
          <p>
            <b className="text-foreground">Dues Collected</b> = total amountPaid on today's bills.
            A precise "dues collected from old credit bills" needs a payments-ledger table —
            <span className="italic"> not built yet, but on the roadmap</span>.
          </p>
          <p>
            For a full debtors list (who owes how much), see the
            <a href="/customers?filter=dues" className="text-primary font-bold ml-1 hover:underline">Customers page</a>.
          </p>
        </div>
      </SectionCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Inventory tab — stock movement
 * ═══════════════════════════════════════════════════════════════════ */
function InventoryTab({ eod }: { eod: EodReport }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Stock IN Units" accent="green" icon={ShoppingBag} value={fmt2(eod.stockIn.totalUnits)} hint={`${eod.stockIn.txCount} transaction${eod.stockIn.txCount === 1 ? "" : "s"}`} />
        <Kpi label="Items Sold"     accent="blue"  icon={Package}     value={fmt2(eod.itemsSold)}           hint={`across ${eod.billCount} bill${eod.billCount === 1 ? "" : "s"}`} />
        <Kpi label="Returns"        accent="orange" icon={Undo2}      value={fmt(eod.returnsTotal)}         hint={`${eod.returnsCount} return${eod.returnsCount === 1 ? "" : "s"}`} />
      </div>

      <SectionCard title="Need More?" icon={Sparkles}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Deeper inventory analytics (dead stock, stock value trend, per-category turnover) live on the
          <a href="/products" className="text-primary font-bold ml-1 hover:underline">Products page</a>.
          A dedicated Inventory Report is on the roadmap — tell me to build it when you want it.
        </p>
      </SectionCard>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Customers tab — top spenders for the day
 * ═══════════════════════════════════════════════════════════════════ */
function CustomersTab({ eod, onCsv }: { eod: EodReport; onCsv: () => void }) {
  return (
    <SectionCard
      title="Top Customers"
      icon={Users}
      action={<CsvButton onClick={onCsv} />}
    >
      {eod.topCustomers.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">
          No identified customers on this date.<br />
          <span className="text-[11px]">Walk-ins without a phone number aren't counted here.</span>
        </p>
      ) : (
        <div className="space-y-2">
          {eod.topCustomers.map((c, i) => (
            <div key={c.customerPhone ?? i} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                i === 0 ? "bg-amber-400 text-amber-900"
                : i === 1 ? "bg-zinc-400 text-zinc-900"
                : i === 2 ? "bg-orange-400 text-orange-900"
                : "bg-muted text-muted-foreground"
              }`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">
                  {c.customerName || `+91 ${c.customerPhone}`}
                </p>
                {c.customerName && c.customerPhone && (
                  <p className="text-[10px] font-mono text-muted-foreground">+91 {c.customerPhone}</p>
                )}
                <p className="text-[10px] text-muted-foreground">{c.billCount} bill{c.billCount === 1 ? "" : "s"} today</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">{fmt(c.totalSpent)}</p>
                <p className="text-[10px] text-muted-foreground">avg {fmt(c.totalSpent / Math.max(1, c.billCount))}/bill</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
