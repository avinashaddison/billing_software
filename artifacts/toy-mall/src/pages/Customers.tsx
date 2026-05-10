import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, ChevronRight, ArrowLeft, IndianRupee,
  ShoppingBag, Clock, Search, Loader2, Trophy, Package,
  Sparkles, TrendingUp, Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ── */
type Period = "all" | "month" | "week";

interface CustomerSummary {
  phone: string;
  totalSpent: number;
  visitCount: number;
  lastVisit: string;
}
interface TopProduct { productName: string; totalQty: number; }
interface BillItem { productName: string; productSku: string; quantity: number; price: number; subtotal: number; }
interface Bill { id: string; billNumber?: number; totalAmount: number; itemsCount: number; paymentMode: string; createdAt: string; items: BillItem[]; }
interface CustomerDetail {
  phone: string; totalSpent: number; visitCount: number;
  topProducts: TopProduct[];
  bills: Bill[];
}

const PERIOD_LABELS: Record<Period, string> = { all: "All Time", month: "This Month", week: "This Week" };

interface Tier {
  label: string;
  ring: string;
  pill: string;
  glow: string;
}

function getLoyaltyTier(totalSpent: number): Tier {
  if (totalSpent >= 5000)
    return {
      label: "Gold",
      ring: "ring-amber-300/60 dark:ring-amber-500/40",
      pill: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm shadow-amber-500/30",
      glow: "from-amber-300/30 via-yellow-300/20 to-orange-300/30",
    };
  if (totalSpent >= 1000)
    return {
      label: "Silver",
      ring: "ring-slate-300/60 dark:ring-slate-500/40",
      pill: "bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-sm shadow-slate-500/20",
      glow: "from-slate-300/20 via-slate-300/10 to-slate-300/20",
    };
  return {
    label: "Bronze",
    ring: "ring-orange-300/60 dark:ring-orange-500/40",
    pill: "bg-gradient-to-r from-orange-400 to-amber-600 text-white shadow-sm shadow-orange-500/30",
    glow: "from-orange-300/20 via-amber-300/10 to-orange-300/20",
  };
}

/* Podium-specific accents (1st / 2nd / 3rd) */
const PODIUM = [
  { gradient: "from-amber-400 via-yellow-500 to-orange-500", text: "text-amber-600 dark:text-amber-400", border: "border-amber-300/60 dark:border-amber-500/40", soft: "from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30", crown: true,  emoji: "👑" },
  { gradient: "from-slate-300 via-slate-400 to-slate-500",  text: "text-slate-600 dark:text-slate-300",   border: "border-slate-300/60 dark:border-slate-500/40", soft: "from-slate-50 to-zinc-50 dark:from-slate-900/40 dark:to-zinc-900/40", crown: false, emoji: "🥈" },
  { gradient: "from-orange-400 via-amber-500 to-orange-600", text: "text-orange-600 dark:text-orange-400", border: "border-orange-300/60 dark:border-orange-500/40", soft: "from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30", crown: false, emoji: "🥉" },
];

function fmt(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function initials(phone: string) {
  // Last 2 digits — gives each customer a stable visual id
  return phone.slice(-2);
}

/* ── Customer detail view ── */
function CustomerDetailView({
  selected,
  onBack,
}: {
  selected: CustomerDetail;
  onBack: () => void;
}) {
  const tier = getLoyaltyTier(selected.totalSpent);
  const maxQty = selected.topProducts[0]?.totalQty ?? 1;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-black text-lg">+91 {selected.phone}</h1>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${tier.pill}`}>
              {tier.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {selected.visitCount} visit{selected.visitCount !== 1 ? "s" : ""} · ₹{fmt(selected.totalSpent)} total
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-4 md:px-6">
          {[
            { label: "Total Spent", value: `₹${fmt(selected.totalSpent)}`,                                                                icon: IndianRupee, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Visits",      value: String(selected.visitCount),                                                                    icon: ShoppingBag, color: "text-blue-600 dark:text-blue-400" },
            { label: "Avg / Visit", value: `₹${fmt(selected.totalSpent / Math.max(1, selected.visitCount))}`,                              icon: TrendingUp, color: "text-violet-600 dark:text-violet-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-3 bg-card border rounded-2xl text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <p className={`text-lg font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Favourite items */}
        {selected.topProducts.length > 0 && (
          <div className="px-4 md:px-6 mb-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Favourite Items
            </h2>
            <div className="bg-card border rounded-2xl p-4 space-y-3">
              {selected.topProducts.map((p, i) => {
                const pct = Math.round((p.totalQty / maxQty) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold truncate flex-1 pr-3">{p.productName}</span>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">×{p.totalQty}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Purchase history */}
        <div className="px-4 md:px-6">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" /> Purchase History
          </h2>
          <div className="space-y-3">
            {selected.bills.map((bill) => {
              const dt = new Date(bill.createdAt);
              return (
                <div key={bill.id} className="p-4 bg-card border rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-base">₹{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">
                        {dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                        {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bill.paymentMode === "upi" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                        {bill.paymentMode?.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {bill.billNumber ? `#${bill.billNumber}` : `#${bill.id.slice(0, 6).toUpperCase()}`}
                      </span>
                    </div>
                  </div>
                  {bill.items.length > 0 && (
                    <div className="border-t pt-2 space-y-1">
                      {bill.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex-1 truncate">{item.productName}</span>
                          <span className="font-mono text-xs text-muted-foreground mx-2">×{item.quantity}</span>
                          <span className="font-bold">₹{item.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main leaderboard ── */
export default function Customers() {
  const [customers, setCustomers]     = useState<CustomerSummary[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [period, setPeriod]           = useState<Period>("all");
  const [selected, setSelected]       = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCustomers = useCallback((p: Period) => {
    setLoading(true);
    fetch(`${BASE_URL}/api/customers?period=${p}`)
      .then((r) => r.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCustomers(period); }, [period, fetchCustomers]);

  const openCustomer = async (phone: string) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/customers/${phone}`);
      setSelected(await r.json());
    } finally { setDetailLoading(false); }
  };

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setSearch("");
  };

  const filtered = customers.filter(
    (c) => !search || c.phone.includes(search.replace(/\D/g, ""))
  );

  /* Aggregate stats — drives the hero summary */
  const stats = useMemo(() => {
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    const totalVisits  = customers.reduce((s, c) => s + c.visitCount, 0);
    const avgSpend     = customers.length ? totalRevenue / customers.length : 0;
    return { totalRevenue, totalVisits, avgSpend };
  }, [customers]);

  const podium = filtered.slice(0, 3);
  const rest   = filtered.slice(3);

  if (selected) {
    return <CustomerDetailView selected={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Premium Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
        {/* Ambient blobs */}
        <div aria-hidden className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-yellow-300/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-12 w-72 h-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        {/* Subtle dot grid */}
        <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "16px 16px" }} />

        <div className="relative px-4 md:px-8 pt-5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/40 shadow-xl shadow-orange-900/20">
              <Trophy className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">Leaderboard</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                {loading ? "Loading…" : `${filtered.length} customer${filtered.length !== 1 ? "s" : ""} · ${PERIOD_LABELS[period]}`}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            {[
              { label: "Revenue",   value: `₹${fmt(stats.totalRevenue)}`, icon: IndianRupee },
              { label: "Visits",    value: fmt(stats.totalVisits),        icon: ShoppingBag  },
              { label: "Avg Spend", value: `₹${fmt(stats.avgSpend)}`,     icon: TrendingUp   },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-3 py-2.5">
                <div className="flex items-center gap-1 text-white/80">
                  <s.icon className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{s.label}</span>
                </div>
                <p className="text-base md:text-lg font-black tabular-nums leading-tight mt-0.5 truncate">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky filters ── */}
      <div className="sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b">
        <div className="px-4 md:px-8 py-3 space-y-3">
          {/* Period segmented control */}
          <div className="flex gap-1 p-1 bg-muted rounded-2xl">
            {(["all", "month", "week"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => changePeriod(p)}
                className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                  period === p
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-muted/40 border-transparent text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-amber-500" />
            </div>
            <p className="font-black text-lg">{search ? "No customers match" : "No customers yet"}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {search ? "Try a different phone number" : "Customers with phone numbers entered at checkout will appear here automatically."}
            </p>
          </div>
        ) : (
          <>
            {/* ── Podium (top 3) ── */}
            {podium.length > 0 && !search && (
              <div className="p-4 md:px-8 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Top Spenders</p>
                </div>
                {podium.map((c, i) => {
                  const style = PODIUM[i];
                  const tier  = getLoyaltyTier(c.totalSpent);
                  const avg   = c.totalSpent / Math.max(1, c.visitCount);
                  return (
                    <button
                      key={c.phone}
                      onClick={() => openCustomer(c.phone)}
                      disabled={detailLoading}
                      className={`relative w-full p-4 rounded-3xl border bg-gradient-to-br ${style.soft} ${style.border} text-left hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all overflow-hidden`}
                    >
                      {/* Soft glow */}
                      <div aria-hidden className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${style.gradient} opacity-15 blur-2xl`} />

                      <div className="relative flex items-center gap-3">
                        {/* Rank emblem */}
                        <div className="relative shrink-0">
                          {style.crown && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg leading-none drop-shadow-md">
                              {style.emoji}
                            </span>
                          )}
                          {!style.crown && (
                            <span className="absolute -top-2 -right-1 text-base leading-none drop-shadow-md">
                              {style.emoji}
                            </span>
                          )}
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style.gradient} text-white flex items-center justify-center font-black text-lg shadow-lg ring-2 ring-white/60 dark:ring-white/20`}>
                            {initials(c.phone)}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-base tabular-nums">+91 {c.phone}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${tier.pill}`}>
                              {tier.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(c.lastVisit)}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-2xl font-black tabular-nums ${style.text} drop-shadow-sm`}>₹{fmt(c.totalSpent)}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">avg ₹{fmt(avg)}/visit</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Remaining ranked list ── */}
            {(search ? filtered : rest).length > 0 && (
              <div className={search ? "p-4 md:px-8 space-y-2" : "px-4 md:px-8 pb-4 space-y-2 mt-2"}>
                {!search && rest.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 mt-3">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">All Customers</p>
                  </div>
                )}
                {(search ? filtered : rest).map((c, idx) => {
                  const rank = search ? customers.indexOf(c) + 1 : idx + 4;
                  const tier = getLoyaltyTier(c.totalSpent);
                  const avg  = c.totalSpent / Math.max(1, c.visitCount);
                  return (
                    <button
                      key={c.phone}
                      onClick={() => openCustomer(c.phone)}
                      disabled={detailLoading}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl border bg-card hover:bg-muted/40 active:bg-muted hover:shadow-sm transition-all text-left"
                    >
                      {/* Rank badge */}
                      <div className="w-7 h-7 rounded-lg bg-muted/70 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black text-muted-foreground tabular-nums">#{rank}</span>
                      </div>

                      {/* Avatar with initials */}
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 ring-1 ${tier.ring} flex items-center justify-center shrink-0 font-black text-sm text-violet-700 dark:text-violet-300`}>
                        {initials(c.phone)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm tabular-nums">+91 {c.phone}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${tier.pill}`}>
                            {tier.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}</span>
                          <span className="opacity-50">·</span>
                          <span>avg ₹{fmt(avg)}</span>
                          <span className="opacity-50">·</span>
                          <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmtDate(c.lastVisit)}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">₹{fmt(c.totalSpent)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
