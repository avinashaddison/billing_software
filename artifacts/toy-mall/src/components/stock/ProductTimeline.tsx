/**
 * Clean movement history for one product: every stock-in, sale, return and
 * correction in date order with the exact IST time, who recorded it and, for
 * sales and returns, the bill and customer. Presentational only — the dialog
 * in ProductTimelineDialog.tsx owns the fetch.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  PackagePlus, ShoppingCart, RotateCcw, SlidersHorizontal, Receipt, User, Phone,
  Truck, FileText, ChevronRight, Info,
} from "lucide-react";
import type { ProductTimeline as ProductTimelineData, ProductTimelineEvent } from "@workspace/api-client-react";
import { formatIstDay, formatIstTime, istDayKey } from "@/lib/ist-time";

type Filter = "all" | "IN" | "OUT" | "RETURN";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);

const pcs = (n: number) => `${n} pc`;

const PAYMENT_LABEL: Record<string, string> = { cash: "Cash", upi: "UPI", credit: "Credit" };
const paymentLabel = (mode: string) => PAYMENT_LABEL[mode] ?? mode;

/** Visual identity of each movement type — colour, icon and the verb a shop owner would use. */
const KIND = {
  IN: {
    icon: PackagePlus,
    ring: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    title: (e: ProductTimelineEvent) => `Stock in · ${pcs(e.quantity)}`,
    sign: (e: ProductTimelineEvent) => `+${e.quantity}`,
  },
  OUT: {
    icon: ShoppingCart,
    ring: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    title: (e: ProductTimelineEvent) => `Sold · ${pcs(e.quantity)}`,
    sign: (e: ProductTimelineEvent) => `−${e.quantity}`,
  },
  RETURN: {
    icon: RotateCcw,
    ring: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    title: (e: ProductTimelineEvent) => `Returned by customer · ${pcs(e.quantity)}`,
    sign: (e: ProductTimelineEvent) => `+${e.quantity}`,
  },
  ADJUSTMENT: {
    icon: SlidersHorizontal,
    ring: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    chip: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    title: (e: ProductTimelineEvent) =>
      e.setsLevel
        ? `Stock corrected to ${e.quantity}`
        : `Stock adjusted · ${e.quantity > 0 ? "+" : ""}${e.quantity}`,
    sign: (e: ProductTimelineEvent) =>
      e.setsLevel ? `= ${e.quantity}` : `${e.quantity > 0 ? "+" : ""}${e.quantity}`,
  },
} as const;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "IN", label: "In" },
  { key: "OUT", label: "Out" },
  { key: "RETURN", label: "Returns" },
];

interface ProductTimelineProps {
  data: ProductTimelineData;
  /** Purchase cost is owner-only, like everywhere else in the app. */
  showCost: boolean;
  /** Bill links are only useful to staff who can open the Bill page. */
  canOpenBills: boolean;
}

export function ProductTimeline({ data, showCost, canOpenBills }: ProductTimelineProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c = { all: data.events.length, IN: 0, OUT: 0, RETURN: 0 };
    for (const e of data.events) if (e.type in c) c[e.type as keyof typeof c] += 1;
    return c;
  }, [data.events]);

  const visible = useMemo(
    () => (filter === "all" ? data.events : data.events.filter((e) => e.type === filter)),
    [data.events, filter],
  );

  /* Group by IST calendar day, newest day first (events already arrive newest first). */
  const days = useMemo(() => {
    const out: { key: string; label: string; events: ProductTimelineEvent[] }[] = [];
    for (const e of visible) {
      const key = istDayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.events.push(e);
      else out.push({ key, label: formatIstDay(e.at), events: [e] });
    }
    return out;
  }, [visible]);

  const { totals } = data;

  return (
    <div className="space-y-3" data-testid="product-timeline">
      {data.events.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Filter movements">
          {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tabular-nums transition-colors ${
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"
                }`}
                data-testid={`filter-${f.key.toLowerCase()}`}
              >
                {f.label} <span className={on ? "opacity-80" : "opacity-70"}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm font-semibold text-muted-foreground" data-testid="timeline-empty">
          {data.events.length === 0 ? "No movements recorded yet." : "Nothing of this type yet."}
        </div>
      ) : (
        <ol className="space-y-4">
          {days.map((day) => (
            <li key={day.key} data-testid={`timeline-day-${day.key}`}>
              <p className="sticky top-0 z-[1] -mx-1 mb-1.5 bg-background/95 px-1 py-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground backdrop-blur">
                {day.label}
              </p>
              <ol className="overflow-hidden rounded-2xl border bg-card divide-y divide-border">
                {day.events.map((e) => (
                  <EventRow key={e.id} event={e} showCost={showCost} canOpenBills={canOpenBills} />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}

      {(totals.unloggedInQuantity > 0 || totals.unloggedOutQuantity > 0) && (
        <div
          className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600 dark:bg-slate-900/40 dark:text-slate-300"
          data-testid="timeline-unlogged-note"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {totals.unloggedInQuantity > 0 && (
              <>
                {pcs(totals.unloggedInQuantity)} came in without a stock entry — opening stock typed when the
                product was created, an edit, or an import — so it has no date or entry above.
              </>
            )}
            {totals.unloggedOutQuantity > 0 && (
              <>
                {pcs(totals.unloggedOutQuantity)} left without a sale or return — a stock edit or write-off —
                so it has no date above.
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function EventRow({ event: e, showCost, canOpenBills }: { event: ProductTimelineEvent; showCost: boolean; canOpenBills: boolean }) {
  const k = KIND[e.type];
  const Icon = k.icon;
  const bill = e.bill;

  return (
    <li className="flex items-start gap-3 px-3 py-2.5 sm:px-4" data-testid={`timeline-event-${e.id}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${k.ring}`} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{k.title(e)}</p>

        {/* Who bought it */}
        {(e.type === "OUT" || e.type === "RETURN") && (
          bill ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {canOpenBills ? (
                <Link
                  href={`/bill/${bill.id}`}
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  data-testid={`link-bill-${e.id}`}
                >
                  <Receipt className="h-3.5 w-3.5" /> Bill #{bill.number}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-foreground">
                  <Receipt className="h-3.5 w-3.5" /> Bill #{bill.number}
                </span>
              )}
              {bill.customerName && (
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  <User className="h-3.5 w-3.5" /> {bill.customerName}
                </span>
              )}
              {bill.customerPhone && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Phone className="h-3 w-3" /> {bill.customerPhone}
                </span>
              )}
              {/* The staff view omits the phone field altogether (undefined, not
                  null), so only an explicit null means the bill truly had no
                  customer — never call a phone-only customer a walk-in. */}
              {!bill.customerName && bill.customerPhone === null && <span>Walk-in customer</span>}
              {e.type === "OUT" && (
                <span>
                  {paymentLabel(bill.paymentMode)}
                  {bill.lineTotal != null && <> · {money(bill.lineTotal)}</>}
                  {bill.unitPrice != null && e.quantity > 1 && <> ({money(bill.unitPrice)}/pc)</>}
                </span>
              )}
              {e.type === "RETURN" && (
                <span>
                  {e.refundAmount != null && <>Refund {money(e.refundAmount)}</>}
                  {e.returnReason && <> · {e.returnReason}</>}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {e.type === "OUT" ? "Counter sale · no bill" : "Return · no bill on record"}
              {e.type === "RETURN" && e.refundAmount != null && <> · Refund {money(e.refundAmount)}</>}
            </p>
          )
        )}

        {/* Where it came from */}
        {e.type === "IN" && (e.supplierName || e.invoiceNumber || (showCost && e.purchasePrice != null)) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {e.supplierName && (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Truck className="h-3.5 w-3.5" /> {e.supplierName}
              </span>
            )}
            {e.invoiceNumber && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> Inv {e.invoiceNumber}
              </span>
            )}
            {showCost && e.purchasePrice != null && (
              <span data-testid={`text-cost-${e.id}`}>Cost {money(e.purchasePrice)}/pc</span>
            )}
          </div>
        )}

        {e.note && <p className="mt-1 text-xs italic text-muted-foreground">“{e.note}”</p>}

        <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
          {formatIstTime(e.at)}{e.by ? ` · by ${e.by}` : ""}
        </p>
      </div>

      <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-black tabular-nums ${k.chip}`} data-testid={`chip-${e.id}`}>
        {k.sign(e)}
      </span>
    </li>
  );
}
