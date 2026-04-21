import { useState, useEffect, useCallback } from "react";
import {
  Users, Phone, ChevronRight, ArrowLeft, IndianRupee,
  ShoppingBag, Clock, Search, Loader2, Trophy, Package,
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
const MEDALS = ["🥇", "🥈", "🥉"];

const PODIUM_STYLES = [
  { card: "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30", label: "text-yellow-600 dark:text-yellow-400", ring: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300" },
  { card: "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30",    label: "text-slate-500 dark:text-slate-400",  ring: "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300" },
  { card: "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30", label: "text-orange-600 dark:text-orange-400", ring: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
];

function getLoyaltyTier(totalSpent: number) {
  if (totalSpent >= 5000) return { label: "Gold",   emoji: "⭐", bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" };
  if (totalSpent >= 1000) return { label: "Silver", emoji: "🥈", bg: "bg-slate-100 dark:bg-slate-800/50",  text: "text-slate-600 dark:text-slate-300" };
  return                         { label: "Bronze", emoji: "🔵", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" };
}

function fmt(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
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
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
              {tier.emoji} {tier.label}
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
            { label: "Total Spent", value: `₹${fmt(selected.totalSpent)}`,                                                                icon: IndianRupee, color: "text-green-600 dark:text-green-400" },
            { label: "Visits",      value: String(selected.visitCount),                                                                    icon: ShoppingBag, color: "text-blue-600 dark:text-blue-400" },
            { label: "Avg / Visit", value: `₹${fmt(selected.totalSpent / Math.max(1, selected.visitCount))}`,                              icon: IndianRupee, color: "text-purple-600 dark:text-purple-400" },
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
                        className="h-full rounded-full bg-primary transition-all"
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

  const podium = filtered.slice(0, 3);
  const rest   = filtered.slice(3);

  if (selected) {
    return <CustomerDetailView selected={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" /> Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? "Loading…" : `${filtered.length} customer${filtered.length !== 1 ? "s" : ""} · ${PERIOD_LABELS[period]}`}
            </p>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {(["all", "month", "week"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
              className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                period === p
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-muted/50 border-transparent"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center px-6">
            <Users className="w-12 h-12 opacity-30 mb-3" />
            <p className="font-bold">{search ? "No customers match" : "No customers yet"}</p>
            <p className="text-xs mt-1">
              {search ? "Try a different phone number" : "Customers with phone numbers at checkout appear here"}
            </p>
          </div>
        ) : (
          <>
            {/* ── Podium (top 3) ── */}
            {podium.length > 0 && !search && (
              <div className="p-4 md:px-6 space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Top Customers</p>
                {podium.map((c, i) => {
                  const style = PODIUM_STYLES[i];
                  const tier  = getLoyaltyTier(c.totalSpent);
                  const avg   = c.totalSpent / Math.max(1, c.visitCount);
                  return (
                    <button
                      key={c.phone}
                      onClick={() => openCustomer(c.phone)}
                      disabled={detailLoading}
                      className={`w-full p-4 rounded-2xl border-2 ${style.card} text-left hover:opacity-90 active:scale-[0.98] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Medal & rank */}
                        <div className="text-3xl leading-none">{MEDALS[i]}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-base">+91 {c.phone}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
                              {tier.emoji} {tier.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Last: {fmtDate(c.lastVisit)}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-xl font-black ${style.label}`}>₹{fmt(c.totalSpent)}</p>
                          <p className="text-[10px] text-muted-foreground">avg ₹{fmt(avg)}/visit</p>
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
              <div className={search ? "p-4 md:px-6 space-y-2" : "px-4 md:px-6 pb-4 space-y-2"}>
                {!search && rest.length > 0 && (
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Others</p>
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
                      className="w-full flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 active:bg-muted transition-colors text-left"
                    >
                      {/* Rank badge */}
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-muted-foreground">#{rank}</span>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">+91 {c.phone}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
                            {tier.emoji} {tier.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}</span>
                          <span>·</span>
                          <span>avg ₹{fmt(avg)}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{fmtDate(c.lastVisit)}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-green-600 dark:text-green-400">₹{fmt(c.totalSpent)}</p>
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
