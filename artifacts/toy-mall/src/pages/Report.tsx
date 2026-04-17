import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  FileText, Printer, ChevronLeft, ChevronRight, TrendingUp,
  IndianRupee, ShoppingBag, Package, Banknote, Smartphone, Loader2,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface DayRevenue { day: string; totalAmount: number; billCount: number; itemsCount: number; }
interface TopProduct  { productName: string; productSku: string; totalQty: number; totalRevenue: number; }
interface EodReport {
  date: string; totalAmount: number; billCount: number; itemsSold: number;
  cashSales: number; upiSales: number;
  stockIn: { totalUnits: number; txCount: number };
  topProducts: TopProduct[];
}

function todayIndia() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function Report() {
  const [date, setDate]       = useState(todayIndia);
  const [eod, setEod]         = useState<EodReport | null>(null);
  const [revenue, setRevenue] = useState<DayRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [revDays, setRevDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE_URL}/api/reports/end-of-day?date=${date}`).then((r) => r.json()),
      fetch(`${BASE_URL}/api/reports/revenue?days=${revDays}`).then((r) => r.json()),
    ]).then(([e, r]) => { setEod(e); setRevenue(r); }).finally(() => setLoading(false));
  }, [date, revDays]);

  const stepDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  };

  const formatDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const isToday = date === todayIndia();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-xl p-3 shadow-xl text-xs">
        <p className="font-black mb-1">{formatDay(label)}</p>
        <p className="text-green-600">Revenue: ₹{Number(payload[0]?.value ?? 0).toLocaleString("en-IN")}</p>
        <p className="text-blue-600">Bills: {payload[1]?.value ?? 0}</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Reports
          </h1>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6 p-4 md:p-6 space-y-5 print:p-2">

        {/* ── Revenue Chart ── */}
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Revenue Trend</h2>
            <div className="flex gap-1">
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setRevDays(d)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${revDays === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : revenue.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenue} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="totalAmount" name="Revenue (₹)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="billCount"   name="Bills"       fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── End-of-day date picker ── */}
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Daily Report</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => stepDate(-1)} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors active:scale-90">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input type="date" value={date} max={todayIndia()}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-bold bg-transparent border-0 focus:outline-none cursor-pointer text-center" />
              <button onClick={() => stepDate(1)} disabled={isToday}
                className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors active:scale-90 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : eod ? (
            <div className="space-y-4">
              {/* Summary grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Revenue",  value: fmt(eod.totalAmount),  icon: IndianRupee, color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30"  },
                  { label: "Bills Raised",   value: String(eod.billCount),  icon: FileText,    color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30"    },
                  { label: "Items Sold",     value: String(eod.itemsSold),  icon: Package,     color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
                  { label: "Stock IN Units", value: String(eod.stockIn.totalUnits), icon: ShoppingBag, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`p-3 rounded-xl ${bg} border`}>
                    <Icon className={`w-4 h-4 mb-1 ${color}`} />
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {/* Payment split */}
              {eod.billCount > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-yellow-600 shrink-0" />
                    <div>
                      <p className="font-black text-yellow-700 dark:text-yellow-400">{fmt(eod.cashSales)}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Cash</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-black text-blue-700 dark:text-blue-400">{fmt(eod.upiSales)}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">UPI</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top products */}
              {eod.topProducts.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Top Selling Products</h3>
                  <div className="space-y-2">
                    {eod.topProducts.map((p, i) => (
                      <div key={p.productSku} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${i === 0 ? "bg-amber-400 text-amber-900" : i === 1 ? "bg-zinc-400 text-zinc-900" : i === 2 ? "bg-orange-400 text-orange-900" : "bg-muted text-muted-foreground"}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{p.productName}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{p.productSku}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm">{p.totalQty} units</p>
                          <p className="text-xs text-muted-foreground">{fmt(p.totalRevenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {eod.billCount === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No sales recorded for this date</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
