import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, ChevronRight, ArrowLeft, IndianRupee,
  ShoppingBag, Clock, Search, Loader2, Trophy, Package,
  Sparkles, TrendingUp, Calendar, HandCoins, CheckCircle2, X as XIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ── */
type Period = "all" | "month" | "week";
type Filter = "all" | "dues";

interface CustomerSummary {
  phone: string;
  name?: string | null;
  totalSpent: number;
  outstanding?: number;
  unpaidCount?: number;
  visitCount: number;
  lastVisit: string;
}
interface TopProduct { productName: string; totalQty: number; }
interface BillItem { productName: string; productSku: string; quantity: number; price: number; subtotal: number; }
interface BillReturn {
  productName: string;
  productSku:  string;
  quantity:    number;
  refundAmount: number;
  reason:      string;
  createdAt:   string;
}
interface Bill {
  id: string;
  billNumber?: number;
  totalAmount: number;
  amountPaid?: number;
  refundedAmount?: number;
  paymentStatus?: "paid" | "partial" | "unpaid";
  itemsCount: number;
  paymentMode: string;
  createdAt: string;
  items: BillItem[];
  returns?: BillReturn[];
}
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

/* ── Inline "Record Payment" form for a single credit bill ── */
function RecordPaymentForm({
  bill, onCancel, onRecorded,
}: {
  bill: Bill;
  onCancel: () => void;
  onRecorded: () => void;
}) {
  const outstanding = Math.max(
    0,
    bill.totalAmount - (bill.amountPaid ?? 0) - (bill.refundedAmount ?? 0),
  );
  const [amount, setAmount] = useState<string>(outstanding.toFixed(2));
  const [mode,   setMode]   = useState<"cash" | "upi">("cash");
  const [busy,   setBusy]   = useState(false);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${BASE_URL}/api/bills/${bill.id}/payment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: n, paymentMode: mode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Payment failed");
      toast.success(`Recorded ₹${n.toLocaleString("en-IN")} payment`);
      onRecorded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t pt-3 mt-2 space-y-2 bg-rose-50/50 dark:bg-rose-950/20 -mx-4 px-4 -mb-4 pb-3 rounded-b-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">Record payment</p>
        <button onClick={onCancel} className="p-1 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/40">
          <XIcon className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
          <input
            type="number"
            min="0"
            step="0.01"
            max={outstanding}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-10 pl-6 pr-2 rounded-xl border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400/40"
          />
        </div>
        <div className="inline-flex rounded-xl border bg-muted overflow-hidden h-10 shrink-0">
          <button type="button" onClick={() => setMode("cash")}
            className={`px-3 text-xs font-black transition-colors ${mode === "cash" ? "bg-amber-500 text-white" : "text-muted-foreground"}`}>
            Cash
          </button>
          <button type="button" onClick={() => setMode("upi")}
            className={`px-3 text-xs font-black transition-colors border-l ${mode === "upi" ? "bg-blue-500 text-white" : "text-muted-foreground"}`}>
            UPI
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => setAmount(outstanding.toFixed(2))}
          className="font-bold underline text-rose-600 dark:text-rose-400"
        >
          Full ₹{outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => setAmount((outstanding / 2).toFixed(2))}
          className="font-bold underline text-rose-600 dark:text-rose-400"
        >
          Half
        </button>
      </div>
      <button
        onClick={submit}
        disabled={busy}
        className="w-full h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {busy ? "Saving…" : "Record Payment"}
      </button>
    </div>
  );
}

/* ── Customer detail view ── */
function CustomerDetailView({
  selected,
  onBack,
  onRefresh,
}: {
  selected: CustomerDetail;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const tier = getLoyaltyTier(selected.totalSpent);
  const maxQty = selected.topProducts[0]?.totalQty ?? 1;
  const [recordingFor, setRecordingFor] = useState<string | null>(null);

  /* Aggregate outstanding across this customer's bills, net of returns.
   * outstanding(bill) = max(0, total − paid − refunded) — server uses the
   * same formula, this keeps the badge in sync between server and client. */
  const billOutstanding = (b: Bill) =>
    Math.max(0, b.totalAmount - (b.amountPaid ?? b.totalAmount) - (b.refundedAmount ?? 0));
  const outstanding = selected.bills.reduce((s, b) => s + billOutstanding(b), 0);
  const unpaidCount = selected.bills.filter((b) => billOutstanding(b) > 0).length;

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
        {/* ── Outstanding callout (only when this customer owes money) ── */}
        {outstanding > 0 && (
          <div className="mx-4 md:mx-6 mt-4 p-4 rounded-2xl border-2 border-rose-300 dark:border-rose-700 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/20 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center shadow-sm shrink-0">
              <HandCoins className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">Outstanding</p>
              <p className="text-2xl font-black text-rose-700 dark:text-rose-300 leading-none tracking-tight mt-0.5">
                ₹{fmt(outstanding)}
              </p>
              <p className="text-[11px] font-bold text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                across {unpaidCount} unpaid bill{unpaidCount !== 1 ? "s" : ""} · scroll down to collect
              </p>
            </div>
          </div>
        )}

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
              const dt          = new Date(bill.createdAt);
              const paid        = bill.amountPaid ?? bill.totalAmount;
              const refunded    = bill.refundedAmount ?? 0;
              const billDue     = Math.max(0, bill.totalAmount - paid - refunded);
              /* Derive status client-side too — server status may lag if the
               * UI is showing stale data after a fresh return / payment. */
              const status: "paid" | "partial" | "unpaid" =
                billDue === 0 ? "paid" : (paid > 0 || refunded > 0) ? "partial" : "unpaid";
              const isCredit    = status !== "paid";
              const hasReturns  = (bill.returns?.length ?? 0) > 0;
              const statusPill  = status === "paid"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : status === "partial"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
              const modePill = bill.paymentMode === "upi"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : bill.paymentMode === "credit"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
              return (
                <div key={bill.id} className={`p-4 bg-card border rounded-2xl space-y-3 ${isCredit ? "border-rose-300/60 dark:border-rose-800/60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-base">₹{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">
                        {dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                        {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </p>
                      {isCredit && (
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                          Paid ₹{paid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          {refunded > 0 && (
                            <> · Returned ₹{refunded.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</>
                          )}
                          {" "}· Due ₹{billDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                      )}
                      {!isCredit && refunded > 0 && (
                        <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                          Refunded ₹{refunded.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusPill}`}>
                        {status}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${modePill}`}>
                        {bill.paymentMode?.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
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
                  {hasReturns && (
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 flex items-center gap-1 mb-1">
                        <Undo2 className="w-3 h-3" /> Returns
                      </p>
                      {bill.returns!.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex-1 truncate">
                            {r.productName}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground mx-2">×{r.quantity}</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">
                            −₹{r.refundAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isCredit && recordingFor !== bill.id && (
                    <button
                      onClick={() => setRecordingFor(bill.id)}
                      className="w-full h-10 rounded-xl border-2 border-rose-300 dark:border-rose-700 bg-rose-500/5 hover:bg-rose-500/10 text-rose-700 dark:text-rose-300 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                      <HandCoins className="w-3.5 h-3.5" /> Record Payment · ₹{billDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </button>
                  )}
                  {isCredit && recordingFor === bill.id && (
                    <RecordPaymentForm
                      bill={bill}
                      onCancel={() => setRecordingFor(null)}
                      onRecorded={() => {
                        setRecordingFor(null);
                        onRefresh();
                      }}
                    />
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
  const [filter, setFilter]           = useState<Filter>("all");
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

  const openCustomer = useCallback(async (phone: string) => {
    setDetailLoading(true);
    try {
      const r    = await fetch(`${BASE_URL}/api/customers/${phone}`);
      const data = await r.json();
      // Don't render the detail view from an error payload — it would look
      // broken (no bills, no name, etc.). Surface the error to the user instead.
      if (!r.ok) {
        toast.error(data?.error || `No record for +91 ${phone}`);
        return;
      }
      setSelected(data);
    } catch (e) {
      toast.error((e as Error).message || "Could not load customer");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /* Auto-open a customer when the dashboard deep-links via ?phone=98765...
   * Runs whenever the URL search string changes (handles SPA back/forward). */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phone  = params.get("phone");
    if (phone && /^\d{10}$/.test(phone)) {
      openCustomer(phone);
    }
  }, [openCustomer]);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setSearch("");
  };

  /* Filter + sort:
   *  - "all"  → keep server's order (top spenders first)
   *  - "dues" → only customers with outstanding > 0, sorted by outstanding desc */
  const filtered = useMemo(() => {
    let list = customers;
    if (search) {
      const q = search.replace(/\D/g, "");
      list = list.filter((c) => c.phone.includes(q));
    }
    if (filter === "dues") {
      list = list
        .filter((c) => (c.outstanding ?? 0) > 0)
        .sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0));
    }
    return list;
  }, [customers, search, filter]);

  /* Aggregate stats — drives the hero summary */
  const stats = useMemo(() => {
    const totalRevenue     = customers.reduce((s, c) => s + c.totalSpent, 0);
    const totalVisits      = customers.reduce((s, c) => s + c.visitCount, 0);
    const totalOutstanding = customers.reduce((s, c) => s + (c.outstanding ?? 0), 0);
    const debtorCount      = customers.filter((c) => (c.outstanding ?? 0) > 0).length;
    return { totalRevenue, totalVisits, totalOutstanding, debtorCount };
  }, [customers]);

  /* Podium only makes sense for the spender leaderboard, not the dues list. */
  const podium = filter === "all" ? filtered.slice(0, 3) : [];
  const rest   = filter === "all" ? filtered.slice(3) : filtered;

  if (selected) {
    return (
      <CustomerDetailView
        selected={selected}
        onBack={() => setSelected(null)}
        onRefresh={() => {
          // Re-fetch the detail (updates outstanding + bill statuses)
          openCustomer(selected.phone);
          // Refresh the leaderboard list too so totals stay in sync
          fetchCustomers(period);
        }}
      />
    );
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

          {/* Stats row — Outstanding is the high-signal one, give it accent */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-3 py-2.5">
              <div className="flex items-center gap-1 text-white/80">
                <IndianRupee className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Revenue</span>
              </div>
              <p className="text-base md:text-lg font-black tabular-nums leading-tight mt-0.5 truncate">₹{fmt(stats.totalRevenue)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-3 py-2.5">
              <div className="flex items-center gap-1 text-white/80">
                <ShoppingBag className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Visits</span>
              </div>
              <p className="text-base md:text-lg font-black tabular-nums leading-tight mt-0.5 truncate">{fmt(stats.totalVisits)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFilter(stats.totalOutstanding > 0 ? "dues" : "all")}
              className={`text-left rounded-2xl backdrop-blur-md border px-3 py-2.5 transition-all active:scale-95 ${
                stats.totalOutstanding > 0
                  ? "bg-rose-500/30 border-rose-200/60 ring-2 ring-white/40 shadow-lg shadow-rose-900/20 hover:bg-rose-500/40"
                  : "bg-white/15 border-white/20"
              }`}
            >
              <div className="flex items-center gap-1 text-white">
                <HandCoins className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Owed to you</span>
              </div>
              <p className="text-base md:text-lg font-black tabular-nums leading-tight mt-0.5 truncate">
                ₹{fmt(stats.totalOutstanding)}
              </p>
              {stats.debtorCount > 0 && (
                <p className="text-[9px] font-bold text-white/90 leading-none mt-0.5">
                  {stats.debtorCount} debtor{stats.debtorCount !== 1 ? "s" : ""} · tap to filter
                </p>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Sticky filters ── */}
      <div className="sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b">
        <div className="px-4 md:px-8 py-3 space-y-3">
          {/* All / Has Dues — primary view switch */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 h-10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
                filter === "all"
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              All Customers
            </button>
            <button
              type="button"
              onClick={() => setFilter("dues")}
              disabled={stats.debtorCount === 0}
              className={`flex-1 h-10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 ${
                filter === "dues"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/30"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
              }`}
            >
              <HandCoins className="w-3.5 h-3.5" />
              Has Dues
              {stats.debtorCount > 0 && (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  filter === "dues" ? "bg-white text-rose-600" : "bg-rose-600 text-white"
                }`}>
                  {stats.debtorCount}
                </span>
              )}
            </button>
          </div>

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
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${
              filter === "dues"
                ? "bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/30 dark:to-teal-950/30"
                : "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30"
            }`}>
              {filter === "dues"
                ? <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                : <Users className="w-10 h-10 text-amber-500" />
              }
            </div>
            <p className="font-black text-lg">
              {filter === "dues"
                ? "All settled!"
                : search ? "No customers match" : "No customers yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {filter === "dues"
                ? "No customer owes you money right now."
                : search ? "Try a different phone number" : "Customers with phone numbers entered at checkout will appear here automatically."}
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
                            <span className="font-black text-base truncate">
                              {c.name || `+91 ${c.phone}`}
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${tier.pill}`}>
                              {tier.label}
                            </span>
                            {(c.outstanding ?? 0) > 0 && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-600 text-white shadow-sm flex items-center gap-1">
                                <HandCoins className="w-2.5 h-2.5" />
                                Due ₹{fmt(c.outstanding!)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                            {c.name && <span className="font-mono tabular-nums">+91 {c.phone}</span>}
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
              <div className={search || filter === "dues" ? "p-4 md:px-8 space-y-2" : "px-4 md:px-8 pb-4 space-y-2 mt-2"}>
                {!search && filter === "all" && rest.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 mt-3">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">All Customers</p>
                  </div>
                )}
                {filter === "dues" && (
                  <div className="flex items-center gap-2 mb-2">
                    <HandCoins className="w-3.5 h-3.5 text-rose-500" />
                    <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Customers Who Owe You</p>
                  </div>
                )}
                {(search ? filtered : rest).map((c, idx) => {
                  const rank = search || filter === "dues" ? idx + 1 : idx + 4;
                  const tier = getLoyaltyTier(c.totalSpent);
                  const avg  = c.totalSpent / Math.max(1, c.visitCount);
                  const due  = c.outstanding ?? 0;
                  const isDebtor = due > 0;
                  return (
                    <button
                      key={c.phone}
                      onClick={() => openCustomer(c.phone)}
                      disabled={detailLoading}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border bg-card hover:shadow-sm transition-all text-left ${
                        isDebtor
                          ? "border-rose-300/60 dark:border-rose-800/60 hover:bg-rose-50/40 dark:hover:bg-rose-950/20"
                          : "hover:bg-muted/40 active:bg-muted"
                      }`}
                    >
                      {/* Rank badge */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isDebtor && filter === "dues" ? "bg-rose-500 text-white" : "bg-muted/70 text-muted-foreground"
                      }`}>
                        <span className="text-[10px] font-black tabular-nums">#{rank}</span>
                      </div>

                      {/* Avatar with initials */}
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 ring-1 ${tier.ring} flex items-center justify-center shrink-0 font-black text-sm text-violet-700 dark:text-violet-300`}>
                        {initials(c.phone)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm truncate">
                            {c.name || `+91 ${c.phone}`}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${tier.pill}`}>
                            {tier.label}
                          </span>
                          {isDebtor && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                              <HandCoins className="w-2.5 h-2.5" />
                              ₹{fmt(due)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.name && <span className="font-mono tabular-nums">+91 {c.phone}</span>}
                          {c.name && <span className="opacity-50">·</span>}
                          <span>{c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}</span>
                          <span className="opacity-50">·</span>
                          <span>avg ₹{fmt(avg)}</span>
                          <span className="opacity-50">·</span>
                          <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmtDate(c.lastVisit)}</span>
                          {isDebtor && (c.unpaidCount ?? 0) > 0 && (
                            <>
                              <span className="opacity-50">·</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {c.unpaidCount} unpaid bill{c.unpaidCount !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
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
