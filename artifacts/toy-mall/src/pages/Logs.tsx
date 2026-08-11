import { useState, useEffect, useMemo } from "react";
import {
  useListStockLogs,
  getListStockLogsQueryKey,
  useListStockEntrySummary,
  getListStockEntrySummaryQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  Clock, ArrowDownToLine, ArrowUpToLine, Settings2,
  Receipt, ShoppingBag, ChevronRight, Undo2, Package, LayoutList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListStockLogsType } from "@workspace/api-client-react";
import { Link } from "wouter";

/* ── Types ───────────────────────────────────────────────────────── */

interface Bill {
  id: string;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── IST date helpers ────────────────────────────────────────────────
   The shop's business day is an Asia/Kolkata calendar day and the API
   compares IST calendar dates, so the range must be built in IST too —
   not from the device clock, which may sit in another timezone.        */

const istToday = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function shiftDay(day: string, { days = 0, months = 0 }): string {
  const [y, m, d] = day.split("-").map(Number);
  let dt: Date;

  if (months) {
    /* Calendar-month arithmetic has to clamp to the target month's last day.
       Naive setUTCMonth() overflows instead: 31 Mar minus 1 month becomes
       3 Mar (February is short), which would silently chop most of the
       range off the "1 Month" preset on month-end days. */
    const anchor    = new Date(Date.UTC(y, m - 1 - months, 1));
    const lastOfMon = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
    ).getUTCDate();
    dt = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(d, lastOfMon)),
    );
  } else {
    dt = new Date(Date.UTC(y, m - 1, d));
  }

  if (days) dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/* Timestamps come back as UTC but the whole feature filters on IST calendar
   days, so they must be rendered in IST too — otherwise a device in another
   timezone shows a "last entry" date that disagrees with the range filter. */
const IST = "Asia/Kolkata";

const istDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST, day: "numeric", month: "short", year: "numeric",
  });

const istDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: IST, day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

type RangeKey = "today" | "7d" | "1m" | "2m" | "3m" | "all" | "custom";

const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today",  label: "Today" },
  { key: "7d",     label: "7 Days" },
  { key: "1m",     label: "1 Month" },
  { key: "2m",     label: "2 Months" },
  { key: "3m",     label: "3 Months" },
  { key: "all",    label: "All Time" },
  { key: "custom", label: "Custom" },
];

function resolveRange(
  key: RangeKey,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  const today = istToday();
  switch (key) {
    case "today":  return { from: today, to: today };
    case "7d":     return { from: shiftDay(today, { days: 6 }),  to: today };
    case "1m":     return { from: shiftDay(today, { months: 1 }), to: today };
    case "2m":     return { from: shiftDay(today, { months: 2 }), to: today };
    case "3m":     return { from: shiftDay(today, { months: 3 }), to: today };
    case "all":    return {};
    case "custom": return { from: customFrom || undefined, to: customTo || undefined };
  }
}

const prettyDay = (day: string) => format(new Date(`${day}T00:00:00`), "d MMM yyyy");

/* ── Sub-component: Bills tab ────────────────────────────────────── */

function BillsTab() {
  const [bills, setBills]       = useState<Bill[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/bills`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBills(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 md:px-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border bg-card space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Receipt className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="font-bold text-lg">No bills yet</p>
        <p className="text-sm">Checkout bills will appear here after scanning and billing.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table header */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
        <span>Bill ID</span>
        <span className="w-24 text-center">Items</span>
        <span className="w-36 text-right">Total</span>
        <span className="w-40 text-right">Date &amp; Time</span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-4 space-y-3">
        {bills.map((bill) => (
          <Link key={bill.id} href={`/bill/${bill.id}`}>
            <div className="p-4 rounded-2xl border bg-card shadow-sm hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer active:scale-[0.99]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-muted-foreground">
                  #{bill.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(bill.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{bill.itemsCount} item{bill.itemsCount !== 1 ? "s" : ""} sold</p>
                    <span className="text-xs bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-bold px-1.5 py-0.5 rounded-full">PAID</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <p className="font-black text-lg text-primary">
                    ₹{bill.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table rows */}
      <div className="hidden md:block divide-y divide-border">
        {bills.map((bill) => (
          <Link key={bill.id} href={`/bill/${bill.id}`}>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors items-center cursor-pointer group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold font-mono text-sm">#{bill.id.slice(0, 8).toUpperCase()}</p>
                  <span className="text-xs bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-bold px-1.5 py-0.5 rounded-full">PAID</span>
                </div>
              </div>
              <div className="w-24 text-center">
                <span className="font-bold">{bill.itemsCount}</span>
              </div>
              <div className="w-36 text-right font-black text-lg text-primary">
                ₹{bill.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </div>
              <div className="w-40 text-right text-sm text-muted-foreground font-medium">
                {format(new Date(bill.createdAt), "MMM d, h:mm a")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ── Sub-component: per-product entry summary ────────────────────── */

function EntrySummaryView({
  range,
  type,
  search,
}: {
  range: { from?: string; to?: string };
  type: Exclude<ListStockLogsType, undefined>;
  search: string;
}) {
  const params = useMemo(
    () => ({ ...range, type, ...(search.trim() ? { search: search.trim() } : {}), limit: 200 }),
    [range.from, range.to, type, search],
  );

  const { data, isLoading } = useListStockEntrySummary(params, {
    query: { queryKey: getListStockEntrySummaryQueryKey(params) },
  });

  /* Totals come from the server and cover the whole range. They are NOT summed
     from `rows`, which is capped by `limit` and would under-report the period
     for a shop with more matching products than the cap. */
  const rows   = data?.products;
  const totals = data?.totals;

  if (isLoading) {
    return (
      <div className="p-4 md:px-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border bg-card space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
        <p className="font-bold text-lg">No {type === "IN" ? "stock entry" : type.toLowerCase()} in this period</p>
        <p className="text-sm">Try a longer date range, or clear the product search.</p>
      </div>
    );
  }

  return (
    <>
      {/* Period totals */}
      {totals && (
        <div className="grid grid-cols-3 gap-2 p-4 md:px-6 border-b bg-muted/20">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Products</p>
            <p className="font-black text-xl">{totals.productCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Qty</p>
            <p className="font-black text-xl text-green-600 dark:text-green-400">{totals.totalQuantity}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Entries</p>
            <p className="font-black text-xl">{totals.entryCount}</p>
          </div>
        </div>
      )}

      {data?.truncated && (
        <p className="px-4 md:px-6 py-2 text-xs font-medium text-muted-foreground bg-muted/10 border-b">
          Showing the {rows.length} most recently entered products. The totals above
          still cover all {totals?.productCount} — use search to find a specific one.
        </p>
      )}

      {/* Desktop table header */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
        <span>Product</span>
        <span className="w-28 text-right">Total Qty</span>
        <span className="w-24 text-center">Entries</span>
        <span className="w-44 text-right">Last Entry</span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-4 space-y-3">
        {rows.map((r) => (
          <Link key={r.productId} href={`/product?sku=${encodeURIComponent(r.productSku)}`}>
            <div className="p-4 rounded-2xl border bg-card shadow-sm hover:border-primary/40 transition-colors active:scale-[0.99]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{r.productName}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{r.productSku}</p>
                </div>
                <span className="font-black text-lg text-green-600 dark:text-green-400 shrink-0">
                  +{r.totalQuantity}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
                <span className="font-bold text-muted-foreground">
                  {r.entryCount} {r.entryCount === 1 ? "entry" : "entries"}
                </span>
                <span className="font-bold">
                  Last: {istDate(r.lastEntryAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table rows */}
      <div className="hidden md:block divide-y divide-border">
        {rows.map((r) => (
          <Link key={r.productId} href={`/product?sku=${encodeURIComponent(r.productSku)}`}>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors items-center cursor-pointer">
              <div className="min-w-0">
                <p className="font-bold truncate">{r.productName}</p>
                <p className="text-xs font-mono text-muted-foreground">{r.productSku}</p>
              </div>
              <div className="w-28 text-right font-black text-lg text-green-600 dark:text-green-400">
                +{r.totalQuantity}
              </div>
              <div className="w-24 text-center font-bold text-muted-foreground">
                {r.entryCount}
              </div>
              <div className="w-44 text-right text-sm font-medium">
                {istDateTime(r.lastEntryAt)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */

type Tab = "activity" | "bills";
type View = "list" | "product";

export default function Logs() {
  const [tab, setTab]     = useState<Tab>("activity");
  const [view, setView]   = useState<View>("list");
  const [type, setType]   = useState<ListStockLogsType | "ALL">("ALL");
  const [rangeKey, setRangeKey]     = useState<RangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [search, setSearch]         = useState("");

  const range = useMemo(
    () => resolveRange(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );

  // The per-product roll-up summarises one movement type at a time, so "All
  // Activity" has no meaning there — default it to stock entry (IN).
  const summaryType: Exclude<ListStockLogsType, undefined> =
    type === "ALL" ? "IN" : type;

  const queryParams = useMemo(
    () => ({
      ...range,
      ...(type === "ALL" ? {} : { type: type as ListStockLogsType }),
      limit: 200,
    }),
    [range.from, range.to, type],
  );

  const { data: logs, isLoading } = useListStockLogs(queryParams, {
    query: { queryKey: getListStockLogsQueryKey(queryParams), enabled: view === "list" },
  });

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case "IN":     return <ArrowDownToLine className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "OUT":    return <ArrowUpToLine className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "RETURN": return <Undo2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:       return <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getBadgeClass = (logType: string) => {
    switch (logType) {
      case "IN":     return "text-green-700 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-800";
      case "OUT":    return "text-red-700 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800";
      case "RETURN": return "text-amber-700 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800";
      default:       return "text-blue-700 bg-blue-100 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800";
    }
  };

  const getQtyColor = (logType: string) => {
    switch (logType) {
      case "IN":     return "text-green-600 dark:text-green-400";
      case "OUT":    return "text-red-600 dark:text-red-400";
      case "RETURN": return "text-amber-600 dark:text-amber-400";
      default:       return "text-blue-600 dark:text-blue-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ── */}
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary hidden md:block" />
            <h1 className="text-2xl font-black">
              {tab === "activity" ? "Activity Logs" : "Billing History"}
            </h1>
          </div>
          {tab === "activity" && (
            <Select value={type} onValueChange={(val: any) => setType(val)}>
              <SelectTrigger className="w-40 md:w-48 h-10 rounded-xl bg-muted/50 border-transparent font-bold">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Activity</SelectItem>
                <SelectItem value="IN">Stock IN</SelectItem>
                <SelectItem value="OUT">Stock OUT</SelectItem>
                <SelectItem value="RETURN">Returns</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab("activity")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === "activity"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            Activity
            {logs && tab === "activity" && view === "list" && (
              <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">
                {logs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("bills")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === "bills"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Bills
          </button>
        </div>

        {/* ── Date range + view controls (Activity only) ── */}
        {tab === "activity" && (
          <div className="mt-3 space-y-3">
            {/* Range presets */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setRangeKey(p.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    rangeKey === p.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range inputs */}
            {rangeKey === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo || istToday()}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-xl font-semibold text-sm"
                  aria-label="From date"
                />
                <span className="text-xs font-bold text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={istToday()}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-xl font-semibold text-sm"
                  aria-label="To date"
                />
              </div>
            )}

            {/* Active range caption + view toggle */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-muted-foreground truncate">
                {range.from && range.to
                  ? range.from === range.to
                    ? prettyDay(range.from)
                    : `${prettyDay(range.from)} – ${prettyDay(range.to)}`
                  : rangeKey === "custom"
                    ? "Pick a start and end date"
                    : "All time"}
              </p>
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === "list"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  Timeline
                </button>
                <button
                  onClick={() => setView("product")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    view === "product"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  By Product
                </button>
              </div>
            </div>

            {/* Product search (summary view only) */}
            {view === "product" && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name or SKU…"
                className="h-9 rounded-xl font-semibold text-sm"
              />
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-0">

        {tab === "bills" ? (
          <BillsTab />
        ) : view === "product" ? (
          <EntrySummaryView range={range} type={summaryType} search={search} />
        ) : (
          <>
            {/* Activity timeline */}
            {isLoading ? (
              <div className="p-4 md:p-0 space-y-3 md:divide-y md:divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="md:px-6 md:py-4 p-4 rounded-2xl md:rounded-none border md:border-0 bg-card md:bg-transparent">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            ) : logs?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-bold text-lg">No activity in this period</p>
                <p className="text-sm">Try a longer date range, or switch the filter to All Activity.</p>
              </div>
            ) : (
              <>
                {/* Desktop table header */}
                <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-2 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                  <span className="w-8"></span>
                  <span>Product</span>
                  <span className="w-24 text-center">Type</span>
                  <span className="w-24 text-right">Quantity</span>
                  <span className="w-36 text-right">Time</span>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden p-4 space-y-3">
                  {logs?.map((log) => (
                    <div key={log.id} className="p-4 rounded-2xl border bg-card shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, h:mm a")}
                        </span>
                        <Badge variant="outline" className={`font-bold text-[10px] ${getBadgeClass(log.type)}`}>
                          {log.type}
                        </Badge>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-sm truncate">{log.productName}</p>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">{log.productSku}</p>
                        </div>
                        <div className={`flex items-center gap-1 font-black text-lg ${getQtyColor(log.type)}`}>
                          {log.type === "IN" || log.type === "RETURN" ? "+" : log.type === "OUT" ? "-" : ""}{log.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table rows */}
                <div className="hidden md:block divide-y divide-border">
                  {logs?.map((log) => (
                    <div key={log.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors items-center">
                      <div className="w-8 flex justify-center">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {getLogIcon(log.type)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{log.productName}</p>
                        <p className="text-xs font-mono text-muted-foreground">{log.productSku}</p>
                      </div>
                      <div className="w-24 text-center">
                        <Badge variant="outline" className={`font-bold text-xs ${getBadgeClass(log.type)}`}>
                          {log.type}
                        </Badge>
                      </div>
                      <div className={`w-24 text-right font-black text-lg ${getQtyColor(log.type)}`}>
                        {log.type === "IN" || log.type === "RETURN" ? "+" : log.type === "OUT" ? "-" : ""}{log.quantity}
                      </div>
                      <div className="w-36 text-right text-sm text-muted-foreground font-medium">
                        {format(new Date(log.createdAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
