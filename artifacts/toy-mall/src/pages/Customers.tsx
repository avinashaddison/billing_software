import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, ChevronRight, ArrowLeft, IndianRupee,
  ShoppingBag, Clock, Search, Loader2, Trophy, Package,
  Sparkles, TrendingUp, Calendar, HandCoins, CheckCircle2, X as XIcon,
  Undo2, Phone, MessageCircle, Flame, Crown, Repeat, BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip,
} from "recharts";

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
  customerName?: string | null;
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

/* ── Tier → gradient palette for the avatar / hero ── */
function getTierPalette(label: string) {
  if (label === "Gold")   return { grad: "from-amber-400 via-orange-500 to-rose-500",  glow: "shadow-amber-500/30",  Icon: Crown };
  if (label === "Silver") return { grad: "from-slate-400 via-zinc-500 to-slate-600",   glow: "shadow-slate-500/25",  Icon: BadgeCheck };
  return                          { grad: "from-orange-400 via-amber-500 to-yellow-500", glow: "shadow-orange-500/25", Icon: BadgeCheck };
}

/* ── Smart tag derivation ───────────────────────────────────────── */
function deriveTags(args: {
  visitCount: number;
  totalSpent: number;
  outstanding: number;
  bills:      Bill[];
}) {
  const tags: { label: string; tone: string; Icon: React.ElementType }[] = [];
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const hasToday = args.bills.some((b) => b.createdAt.slice(0, 10) === todayStr);
  if (hasToday)              tags.push({ label: "Visited today",  tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", Icon: Flame });
  if (args.visitCount >= 5)  tags.push({ label: "Frequent buyer", tone: "bg-violet-500/10  text-violet-700  dark:text-violet-400  border-violet-500/30",  Icon: Repeat });
  if (args.totalSpent >= 5000) tags.push({ label: "Big spender",   tone: "bg-amber-500/10   text-amber-700   dark:text-amber-400   border-amber-500/30",   Icon: Trophy });
  if (args.outstanding > 0)  tags.push({ label: "Has dues",       tone: "bg-rose-500/10    text-rose-700    dark:text-rose-400    border-rose-500/30",    Icon: HandCoins });
  return tags;
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
  const tier    = getLoyaltyTier(selected.totalSpent);
  const palette = getTierPalette(tier.label);
  const maxQty  = selected.topProducts[0]?.totalQty ?? 1;
  /* Total spent per favourite product, so the bar reflects revenue not just
   * units (a 1× big-ticket item shouldn't look weaker than 2× cheap items
   * when we're trying to show "what this customer is worth us"). Falls back
   * gracefully — the server doesn't send spend per favourite, so we tally
   * it from the bill items list. */
  const spendByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of selected.bills) {
      for (const it of b.items) {
        map.set(it.productName, (map.get(it.productName) ?? 0) + it.subtotal);
      }
    }
    return map;
  }, [selected.bills]);
  const maxSpend = Math.max(1, ...Array.from(spendByProduct.values()));

  const [recordingFor, setRecordingFor] = useState<string | null>(null);

  /* Aggregate outstanding across this customer's bills, net of returns.
   * outstanding(bill) = max(0, total − paid − refunded) — server uses the
   * same formula, this keeps the badge in sync between server and client. */
  const billOutstanding = (b: Bill) =>
    Math.max(0, b.totalAmount - (b.amountPaid ?? b.totalAmount) - (b.refundedAmount ?? 0));
  const outstanding = selected.bills.reduce((s, b) => s + billOutstanding(b), 0);
  const unpaidCount = selected.bills.filter((b) => billOutstanding(b) > 0).length;

  /* Spending timeline (oldest → newest) for the sparkline. Reverse-sorts
   * since bills come back desc-by-date from the API. */
  const timeline = useMemo(
    () => [...selected.bills].reverse().map((b, i) => ({
      idx:    i,
      amount: b.totalAmount,
      date:   new Date(b.createdAt),
    })),
    [selected.bills],
  );

  const avgVisit  = selected.totalSpent / Math.max(1, selected.visitCount);
  const firstBill = selected.bills[selected.bills.length - 1];
  const memberSince = firstBill
    ? new Date(firstBill.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : null;

  const phone   = selected.phone;
  const waUrl   = `https://wa.me/91${phone}`;
  const telUrl  = `tel:+91${phone}`;
  const tags    = deriveTags({ visitCount: selected.visitCount, totalSpent: selected.totalSpent, outstanding, bills: selected.bills });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Compact sticky bar (just back + mini-context, appears on scroll) ── */}
      <div className="px-4 md:px-6 py-3 border-b sticky top-0 bg-background/85 backdrop-blur z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-sm truncate">
            {selected.bills[0]?.customerName || `+91 ${phone}`}
          </h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Customer</p>
        </div>
        <a href={telUrl}
          className="w-8 h-8 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors"
          title="Call">
          <Phone className="w-3.5 h-3.5" />
        </a>
        <a href={waUrl} target="_blank" rel="noreferrer"
          className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors"
          title="WhatsApp">
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">

        {/* ═══════════════════════════════════════════════════════════
            HERO CARD — avatar, identity, tier, stats, sparkline
            ═══════════════════════════════════════════════════════════ */}
        <div className="mx-4 md:mx-6 mt-4 rounded-3xl overflow-hidden border bg-card shadow-sm">
          {/* Top: gradient band carrying the avatar + tier */}
          <div className={`relative bg-gradient-to-br ${palette.grad} text-white p-5 ${palette.glow} shadow-lg`}>
            {/* Ambient blobs for depth */}
            <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-3xl pointer-events-none" />
            <div aria-hidden className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-white/10 blur-3xl pointer-events-none" />

            <div className="relative flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-sm ring-2 ring-white/40 flex items-center justify-center shrink-0 shadow-xl">
                <span className="text-2xl font-black tracking-tight">{initials(phone)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black tracking-tight truncate">
                    {selected.bills[0]?.customerName || `+91 ${phone}`}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-white/25 backdrop-blur-sm ring-1 ring-white/40">
                    <palette.Icon className="w-3 h-3" />
                    {tier.label}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-white/85 mt-0.5">
                  {selected.bills[0]?.customerName && <>+91 {phone} · </>}
                  {memberSince ? <>Since {memberSince}</> : "New customer"}
                </p>
              </div>
            </div>

            {/* Inline stats row — Spent / Visits / Avg */}
            <div className="relative grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/80">Spent</p>
                <p className="text-base md:text-lg font-black tabular-nums leading-tight">₹{fmt(selected.totalSpent)}</p>
              </div>
              <div className="rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/80">Visits</p>
                <p className="text-base md:text-lg font-black tabular-nums leading-tight">{selected.visitCount}</p>
              </div>
              <div className="rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/80">Avg / visit</p>
                <p className="text-base md:text-lg font-black tabular-nums leading-tight">₹{fmt(avgVisit)}</p>
              </div>
            </div>
          </div>

          {/* Bottom: tags + spending sparkline */}
          <div className="p-4 space-y-3">
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map(({ label, tone, Icon }) => (
                  <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border ${tone}`}>
                    <Icon className="w-2.5 h-2.5" />
                    {label}
                  </span>
                ))}
              </div>
            )}

            {timeline.length >= 2 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Spending Timeline
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground">
                    {timeline.length} bill{timeline.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="h-16 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="custSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Spent"]}
                        labelFormatter={(_, p) => p?.[0]?.payload?.date
                          ? (p[0].payload.date as Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : ""}
                        contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2}
                        fill="url(#custSpark)" dot={false} activeDot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

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

        {/* ── Favourite Items — rank · units · spend · proportional bar ── */}
        {selected.topProducts.length > 0 && (
          <div className="px-4 md:px-6 mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Favourite Items
              </h2>
              <span className="text-[10px] font-bold text-muted-foreground">
                Top {selected.topProducts.length}
              </span>
            </div>
            <div className="bg-card border rounded-2xl p-3 space-y-2">
              {selected.topProducts.map((p, i) => {
                const qtyPct   = Math.round((p.totalQty / maxQty) * 100);
                const spend    = spendByProduct.get(p.productName) ?? 0;
                const spendPct = Math.max(8, Math.round((spend / maxSpend) * 100));
                const rankPill = i === 0 ? "bg-amber-400 text-amber-900"
                  : i === 1 ? "bg-zinc-300 text-zinc-800"
                  : i === 2 ? "bg-orange-300 text-orange-900"
                  : "bg-muted text-muted-foreground";
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${rankPill}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-bold truncate">{p.productName}</span>
                        <span className="text-[11px] font-bold text-muted-foreground tabular-nums shrink-0">
                          ×{p.totalQty} · <span className="text-foreground">₹{fmt(spend)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 transition-all"
                          style={{ width: `${spendPct}%` }}
                          title={`${qtyPct}% of top unit-mover · ₹${fmt(spend)} lifetime`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Purchase history */}
        <div className="px-4 md:px-6 mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> Purchase History
            </h2>
            <span className="text-[10px] font-bold text-muted-foreground">
              {selected.bills.length} bill{selected.bills.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2.5">
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
              /* Left accent strip — instant visual scan of paid vs partial vs unpaid */
              const accent = status === "paid"
                ? "before:bg-emerald-400 dark:before:bg-emerald-500"
                : status === "partial"
                  ? "before:bg-amber-400 dark:before:bg-amber-500"
                  : "before:bg-rose-500";
              return (
                <div key={bill.id}
                  className={`relative overflow-hidden p-4 pl-5 bg-card border rounded-2xl space-y-3 transition-all hover:shadow-sm
                    before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full ${accent}
                    ${isCredit ? "border-rose-300/60 dark:border-rose-800/60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-lg leading-none tabular-nums">
                        ₹{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        <span className="opacity-50">·</span>
                        <Clock className="w-3 h-3" />
                        {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </p>
                      {isCredit && (
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                          Paid ₹{paid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          {refunded > 0 && (
                            <> · Returned ₹{refunded.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</>
                          )}
                          {" "}· Due ₹{billDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                      )}
                      {!isCredit && refunded > 0 && (
                        <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 mt-1.5">
                          Refunded ₹{refunded.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex gap-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusPill}`}>
                          {status}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${modePill}`}>
                          {bill.paymentMode?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
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
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCustomers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchCustomers(period); }, [period, fetchCustomers]);

  const openCustomer = useCallback(async (phone: string) => {
    setDetailLoading(true);
    try {
      const r    = await fetch(`${BASE_URL}/api/customers/${phone}`);
      // Parse defensively — a proxy/auth error can return a non-JSON HTML page,
      // which would otherwise throw and look like a crash.
      const data = await r.json().catch(() => null);
      // Don't render the detail view from an error payload — it would look
      // broken (no bills, no name, etc.). Surface the error to the user instead.
      if (!r.ok || !data || typeof data !== "object") {
        toast.error((data && data.error) || `No record for +91 ${phone}`);
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
      {/* ═══════════════════════════════════════════════════════════════
          HERO — dense, dark, modern. Sets the tone for the whole page.
          ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-slate-900 to-indigo-950 text-white border-b border-white/5">
        {/* Layered ambient depth */}
        <div aria-hidden className="absolute -top-20 -right-24 w-72 h-72 rounded-full bg-amber-500/20 blur-[100px]" />
        <div aria-hidden className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-violet-500/20 blur-[110px]" />
        <div aria-hidden className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-rose-500/10 blur-3xl" />
        {/* Fine grid for texture */}
        <div aria-hidden className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        <div className="relative px-4 md:px-8 pt-5 pb-5">
          {/* Title row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl blur-md opacity-60" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-1 ring-white/30 shadow-xl">
                  <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight">Customers</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
                  Leaderboard · {loading ? "Loading…" : `${customers.length} total`}
                </p>
              </div>
            </div>
            {/* Live "this period" pill — quiet but informative */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/15">
              <Calendar className="w-3 h-3 text-white/70" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{PERIOD_LABELS[period]}</span>
            </div>
          </div>

          {/* KPI strip — 3 columns, each with a distinct accent */}
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {/* Revenue */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-md ring-1 ring-white/10 px-3 py-2.5">
              <div aria-hidden className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-emerald-400/15 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-1 text-emerald-300/90">
                  <IndianRupee className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Revenue</span>
                </div>
                <p className="text-base md:text-xl font-black tabular-nums leading-none mt-1.5 truncate text-white">
                  ₹{fmt(stats.totalRevenue)}
                </p>
              </div>
            </div>
            {/* Visits */}
            <div className="relative overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-md ring-1 ring-white/10 px-3 py-2.5">
              <div aria-hidden className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-sky-400/15 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-1 text-sky-300/90">
                  <ShoppingBag className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Visits</span>
                </div>
                <p className="text-base md:text-xl font-black tabular-nums leading-none mt-1.5 truncate text-white">
                  {fmt(stats.totalVisits)}
                </p>
                <p className="text-[9px] font-bold text-white/50 leading-none mt-1">{customers.length} unique</p>
              </div>
            </div>
            {/* Owed — bright when > 0, muted when 0 */}
            <button
              type="button"
              onClick={() => setFilter(stats.totalOutstanding > 0 ? "dues" : "all")}
              disabled={stats.totalOutstanding === 0}
              className={`group relative overflow-hidden text-left rounded-2xl backdrop-blur-md ring-1 px-3 py-2.5 transition-all active:scale-95 disabled:active:scale-100 ${
                stats.totalOutstanding > 0
                  ? "bg-gradient-to-br from-rose-500/40 to-pink-500/30 ring-rose-300/40 shadow-lg shadow-rose-500/20 hover:from-rose-500/50 hover:to-pink-500/40 cursor-pointer"
                  : "bg-white/[0.06] ring-white/10 cursor-default"
              }`}
            >
              {stats.totalOutstanding > 0 && (
                <div aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-rose-300/40 blur-2xl animate-pulse" />
              )}
              <div className="relative">
                <div className="flex items-center gap-1 text-white/90">
                  <HandCoins className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Owed to you</span>
                </div>
                <p className="text-base md:text-xl font-black tabular-nums leading-none mt-1.5 truncate text-white">
                  ₹{fmt(stats.totalOutstanding)}
                </p>
                {stats.debtorCount > 0 ? (
                  <p className="text-[9px] font-bold text-white/90 leading-none mt-1 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-rose-200 animate-pulse" />
                    {stats.debtorCount} debtor{stats.debtorCount !== 1 ? "s" : ""} · tap to view
                  </p>
                ) : (
                  <p className="text-[9px] font-bold text-white/40 leading-none mt-1">all settled</p>
                )}
              </div>
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
            {/* ═══════════════════════════════════════════════════════════
                HALL OF FAME — Champion (#1) gets a big dramatic card,
                #2 and #3 share a row beneath it as silver/bronze.
                ═══════════════════════════════════════════════════════════ */}
            {podium.length > 0 && !search && (
              <div className="p-4 md:px-8 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Hall of Fame</p>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground">{PERIOD_LABELS[period]}</p>
                </div>

                {/* ━━ CHAMPION (#1) ━━ */}
                {podium[0] && (() => {
                  const c    = podium[0];
                  const tier = getLoyaltyTier(c.totalSpent);
                  const avg  = c.totalSpent / Math.max(1, c.visitCount);
                  const share = stats.totalRevenue > 0 ? (c.totalSpent / stats.totalRevenue) * 100 : 0;
                  return (
                    <button
                      onClick={() => openCustomer(c.phone)}
                      disabled={detailLoading}
                      className="relative w-full text-left rounded-3xl overflow-hidden border border-amber-300/60 dark:border-amber-500/30 shadow-2xl shadow-amber-500/15 hover:shadow-amber-500/25 hover:-translate-y-0.5 active:scale-[0.995] transition-all"
                    >
                      {/* Rich gold gradient backdrop */}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500" />
                      {/* Glossy highlight strip */}
                      <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
                      {/* Crown glow */}
                      <div aria-hidden className="absolute -top-10 left-10 w-32 h-32 rounded-full bg-yellow-300/40 blur-3xl" />
                      <div aria-hidden className="absolute -bottom-10 -right-8 w-40 h-40 rounded-full bg-rose-400/30 blur-3xl" />
                      {/* Dot grid texture */}
                      <div aria-hidden className="absolute inset-0 opacity-[0.07]"
                        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "12px 12px" }} />

                      <div className="relative p-5 text-white">
                        {/* MVP badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-sm ring-1 ring-white/40">
                            <Crown className="w-3 h-3" />
                            Champion · #1
                          </span>
                          {share > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/90 px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm">
                              {share.toFixed(0)}% of revenue
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Big avatar with floating crown */}
                          <div className="relative shrink-0">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl leading-none drop-shadow-lg z-10">👑</span>
                            <div className="w-16 h-16 rounded-3xl bg-white/25 backdrop-blur-md flex items-center justify-center font-black text-2xl ring-2 ring-white/50 shadow-xl">
                              {initials(c.phone)}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h2 className="text-xl md:text-2xl font-black tracking-tight truncate drop-shadow-sm">
                              {c.name || `+91 ${c.phone}`}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {c.name && (
                                <span className="text-[11px] font-mono font-bold text-white/85 tabular-nums">+91 {c.phone}</span>
                              )}
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${tier.pill}`}>
                                {tier.label}
                              </span>
                              {(c.outstanding ?? 0) > 0 && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-black/40 text-white ring-1 ring-rose-200/60 flex items-center gap-1">
                                  <HandCoins className="w-2.5 h-2.5" />
                                  Due ₹{fmt(c.outstanding!)}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronRight className="w-5 h-5 text-white/80 shrink-0 hidden md:block" />
                        </div>

                        {/* Big amount + inline stats */}
                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Total Spent</p>
                            <p className="text-3xl md:text-4xl font-black tabular-nums leading-none drop-shadow-md">
                              ₹{fmt(c.totalSpent)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-right">
                            <div className="rounded-xl bg-black/20 backdrop-blur-sm px-2.5 py-1.5 ring-1 ring-white/10">
                              <p className="text-[9px] font-black uppercase tracking-widest text-white/70">Visits</p>
                              <p className="text-sm font-black tabular-nums">{c.visitCount}</p>
                            </div>
                            <div className="rounded-xl bg-black/20 backdrop-blur-sm px-2.5 py-1.5 ring-1 ring-white/10">
                              <p className="text-[9px] font-black uppercase tracking-widest text-white/70">Avg</p>
                              <p className="text-sm font-black tabular-nums">₹{fmt(avg)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })()}

                {/* ━━ RUNNERS-UP (#2 + #3) — side by side ━━ */}
                {podium.length > 1 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {podium.slice(1, 3).map((c, idx) => {
                      const rank   = idx + 2;
                      const tier   = getLoyaltyTier(c.totalSpent);
                      const isSilver = rank === 2;
                      const grad   = isSilver
                        ? "from-slate-300 via-slate-400 to-zinc-500"
                        : "from-orange-400 via-amber-500 to-orange-600";
                      const emoji  = isSilver ? "🥈" : "🥉";
                      return (
                        <button
                          key={c.phone}
                          onClick={() => openCustomer(c.phone)}
                          disabled={detailLoading}
                          className={`relative text-left rounded-2xl overflow-hidden border ${isSilver ? "border-slate-300/60 dark:border-slate-500/30" : "border-orange-300/60 dark:border-orange-500/30"} shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all`}
                        >
                          <div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${grad}`} />
                          <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
                          <div aria-hidden className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/15 blur-2xl" />

                          <div className="relative p-3 text-white">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-white/90 px-2 py-0.5 rounded-full bg-black/20 backdrop-blur-sm">
                                #{rank}
                              </span>
                              <span className="text-base leading-none drop-shadow">{emoji}</span>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center font-black text-base ring-1 ring-white/40 shrink-0">
                                {initials(c.phone)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-sm truncate drop-shadow-sm">
                                  {c.name || `+91 ${c.phone}`}
                                </p>
                                <p className="text-[10px] font-bold text-white/80 flex items-center gap-1">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${tier.pill}`}>
                                    {tier.label}
                                  </span>
                                  · {c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>

                            <div className="mt-2.5 flex items-end justify-between">
                              <p className="text-xl font-black tabular-nums drop-shadow leading-none">
                                ₹{fmt(c.totalSpent)}
                              </p>
                              {(c.outstanding ?? 0) > 0 && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">
                                  ₹{fmt(c.outstanding!)} due
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                  const rank     = search || filter === "dues" ? idx + 1 : idx + 4;
                  const tier     = getLoyaltyTier(c.totalSpent);
                  const avg      = c.totalSpent / Math.max(1, c.visitCount);
                  const due      = c.outstanding ?? 0;
                  const isDebtor = due > 0;

                  /* Recency dot: how long since the last bill?
                   *   ≤ 7  days → emerald (active)
                   *   ≤ 30 days → amber (cooling off)
                   *   > 30 days → slate (dormant)
                   * Helps the owner spot lapsed customers at a glance. */
                  const daysSince = Math.floor((Date.now() - new Date(c.lastVisit).getTime()) / 86_400_000);
                  const dotClass  = daysSince <= 7
                    ? "bg-emerald-500 shadow-emerald-500/40 animate-pulse"
                    : daysSince <= 30
                      ? "bg-amber-500 shadow-amber-500/40"
                      : "bg-slate-400 shadow-slate-400/30";

                  return (
                    <button
                      key={c.phone}
                      onClick={() => openCustomer(c.phone)}
                      disabled={detailLoading}
                      className={`group w-full flex items-center gap-3 p-2.5 rounded-2xl border bg-card hover:shadow-md hover:-translate-y-px transition-all text-left ${
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

                      {/* Avatar with initials + recency dot */}
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 ring-1 ${tier.ring} flex items-center justify-center font-black text-sm text-violet-700 dark:text-violet-300 group-hover:scale-105 transition-transform`}>
                          {initials(c.phone)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-card shadow-sm ${dotClass}`}
                          title={daysSince === 0 ? "Visited today" : `Last visit ${daysSince} day${daysSince === 1 ? "" : "s"} ago`}
                        />
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
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
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
