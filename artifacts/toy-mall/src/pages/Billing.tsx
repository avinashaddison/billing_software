import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { format, isThisWeek } from "date-fns";
import {
  ChevronRight, IndianRupee, ShoppingBag,
  CalendarDays, TrendingUp, Search, X, FileText, User, Truck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/use-auth";
import { isIstToday, istToday, isWithinIstDateRange } from "@/lib/ist-date";
import { PaymentTypeBadge } from "@/components/billing/PaymentTypeBadge";

/* ── Types ───────────────────────────────────────────────────────── */

interface Bill {
  id: string;
  billNumber?: number;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMode?: string | null;
}
interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  method: string;
  paidAt: string;
  createdAt: string;
}

/* Unified row the list renders — a customer sale or a supplier payment. */
interface Row {
  key: string;
  kind: "customer" | "supplier";
  name: string;
  amount: number;
  date: string;
  href: string;
  billNumber?: number;
  shortId?: string;
  itemsCount?: number;
  method?: string | null;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type DateFilter = "today" | "week" | "all" | "custom";
type Party = "all" | "customer" | "supplier";

/* ── Component ───────────────────────────────────────────────────── */

export default function Billing() {
  const canToday = usePermission("todayBilling") === "write";
  const canHistory = usePermission("billing") !== "none";
  const [bills, setBills]       = useState<Bill[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>(canHistory ? "all" : "today");
  const [dateFrom, setDateFrom] = useState(() => istToday());
  const [dateTo, setDateTo] = useState(() => istToday());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [customResult, setCustomResult] = useState<{ key: string; bills: Bill[]; payments: SupplierPayment[]; loading: boolean; error: string }>({
    key: "", bills: [], payments: [], loading: false, error: "",
  });
  const [party, setParty]       = useState<Party>("all");
  const [search, setSearch]     = useState("");
  const [error, setError] = useState("");
  const [todaySummary, setTodaySummary] = useState<{ billCount: number; totalAmount: number } | null>(null);
  const generation = useRef(0);

  const load = useCallback(() => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    setBills([]);
    setPayments([]);
    setTodaySummary(null);
    const read = async (response: Response) => {
      if (!response.ok) throw new Error(response.status === 403 ? "Owner permission required" : "Could not load billing data");
      return response.json();
    };
    return Promise.all([
      fetch(`${BASE_URL}/api/bills${canHistory ? "" : "?scope=today"}`).then(read),
      canHistory ? fetch(`${BASE_URL}/api/supplier-payments`).then(read) : Promise.resolve([]),
      canToday ? fetch(`${BASE_URL}/api/bills/today-summary`).then(read) : Promise.resolve(null),
    ])
      .then(([b, p, summary]) => {
        if (request !== generation.current) return;
        setBills(Array.isArray(b) ? b : []);
        setPayments(Array.isArray(p) ? p : []);
        setTodaySummary(summary);
        setRefreshVersion((value) => value + 1);
      })
      .catch((err) => { if (request === generation.current) setError((err as Error).message); })
      .finally(() => { if (request === generation.current) setLoading(false); });
  }, [canToday, canHistory]);

  useEffect(() => {
    setDateFilter(canHistory ? "all" : "today");
    void load();
    return () => { generation.current++; };
  }, [load, canHistory]);

  /* Live refresh: a sale, payment, return, or supplier payment elsewhere in
     the app broadcasts an SSE event that use-realtime bridges to these window
     events. Without this the history would stay stale until a manual reload. */
  useEffect(() => {
    const onChange = () => { void load(); };
    window.addEventListener("addison:bills-changed", onChange);
    window.addEventListener("addison:suppliers-changed", onChange);
    return () => {
      window.removeEventListener("addison:bills-changed", onChange);
      window.removeEventListener("addison:suppliers-changed", onChange);
    };
  }, [load]);

  const rangeError = !dateFrom || !dateTo
    ? "Select both From and To dates."
    : dateFrom > dateTo ? "From date must be on or before To date." : "";
  const customKey = `${dateFrom}:${dateTo}:${refreshVersion}`;
  const customActive = dateFilter === "custom";
  const customMatches = customResult.key === customKey;
  const customError = customActive && customMatches ? customResult.error : "";
  const listLoading = loading || (customActive && !rangeError && (!customMatches || customResult.loading));

  useEffect(() => {
    if (!customActive || !canHistory || rangeError) return;
    const controller = new AbortController();
    setCustomResult({ key: customKey, bills: [], payments: [], loading: true, error: "" });
    const query = new URLSearchParams({ from: dateFrom, to: dateTo });
    const readRange = async (path: string) => {
        const response = await fetch(`${BASE_URL}/api/${path}?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? "Owner permission required" : "Could not load bills for these dates");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid billing response");
        return data;
    };
    void Promise.all([readRange("bills"), readRange("supplier-payments")])
      .then(([rangeBills, rangePayments]) => {
        if (!controller.signal.aborted) setCustomResult({ key: customKey, bills: rangeBills, payments: rangePayments, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setCustomResult({
          key: customKey, bills: [], payments: [], loading: false,
          error: error instanceof Error ? error.message : "Could not load bills for these dates",
        });
      });
    return () => controller.abort();
  }, [customActive, canHistory, rangeError, customKey, dateFrom, dateTo]);

  /* ── Stats (customer sales = revenue only; supplier payments are money out) ── */
  const weekBills    = bills.filter((b) => isThisWeek(new Date(b.createdAt)));
  const todayRevenue = todaySummary?.totalAmount ?? 0;
  const weekRevenue  = weekBills.reduce((s, b) => s + b.totalAmount, 0);
  const totalRevenue = bills.reduce((s, b) => s + b.totalAmount, 0);

  /* ── Build the unified row list ── */
  // Custom requests do not replace the data behind fixed Today/Week/All cards.
  const listBills = customActive
    ? !rangeError && customMatches && !customResult.loading ? customResult.bills : []
    : bills;
  const customerRows: Row[] = listBills.map((b) => ({
    key: `b-${b.id}`,
    kind: "customer",
    name: b.customerName?.trim() || (b.customerPhone ? `+91 ${b.customerPhone}` : "Walk-in customer"),
    amount: b.totalAmount,
    date: b.createdAt,
    href: `/bill/${b.id}`,
    billNumber: b.billNumber,
    shortId: b.id.slice(0, 8).toUpperCase(),
    itemsCount: b.itemsCount,
    method: b.paymentMode,
  }));
  const listPayments = customActive
    ? !rangeError && customMatches && !customResult.loading ? customResult.payments : []
    : payments;
  const supplierRows: Row[] = listPayments.map((p) => ({
    key: `s-${p.id}`,
    kind: "supplier",
    name: p.supplierName,
    amount: p.amount,
    date: p.paidAt,
    href: "/suppliers",
    method: p.method,
  }));

  const allRows = [...customerRows, ...supplierRows].filter(row => canToday || !isIstToday(row.date)).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  /* ── Filter + search pipeline ── */
  const partyFiltered = party === "all" ? allRows : allRows.filter((r) => r.kind === party);
  const timeFiltered =
    dateFilter === "today" ? partyFiltered.filter((r) => isIstToday(r.date))
    : dateFilter === "week" ? partyFiltered.filter((r) => isThisWeek(new Date(r.date)))
    : dateFilter === "custom" ? partyFiltered.filter((r) => !rangeError && isWithinIstDateRange(r.date, dateFrom, dateTo))
    : partyFiltered;

  const q = search.trim().toLowerCase().replace(/^#/, "");
  const filtered = q
    ? timeFiltered.filter((r) =>
        (r.billNumber != null && String(r.billNumber).includes(q)) ||
        r.key.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.amount.toFixed(2).includes(q)
      )
    : timeFiltered;

  /* ── UI ── */
  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2 mb-1">
          <IndianRupee className="w-6 h-6 text-primary hidden md:block" />
          <h1 className="text-2xl font-black">Billing</h1>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">
          Customer sales and supplier payments
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {error && <div role="alert" className="p-4 text-destructive">
          {error} <button onClick={() => void load()} className="underline font-bold">Retry</button>
        </div>}
        {!canToday && <p data-testid="today-billing-restricted" className="px-4 pt-4 text-sm text-muted-foreground">
          Today's bills and totals are hidden. Ask the owner to enable Today's Bills & Totals in Staff Permissions.
        </p>}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3 p-4 md:px-6">
          {[
            {
              label: "Today's Bills",
              value: loading ? null : todaySummary?.billCount ?? 0,
              sub:   loading ? null : `₹${todayRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
              icon:  CalendarDays,
              color: "text-blue-600 dark:text-blue-400",
              bg:    "bg-blue-50 dark:bg-blue-950/40",
            },
            {
              label: "This Week",
              value: loading ? null : weekBills.length,
              sub:   loading ? null : `₹${weekRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
              icon:  TrendingUp,
              color: "text-purple-600 dark:text-purple-400",
              bg:    "bg-purple-50 dark:bg-purple-950/40",
            },
            {
              label: "All Time",
              value: loading ? null : bills.length,
              sub:   loading ? null : `₹${totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
              icon:  IndianRupee,
              color: "text-green-600 dark:text-green-400",
              bg:    "bg-green-50 dark:bg-green-950/40",
            },
          ].filter(stat => stat.label === "Today's Bills" ? canToday : canHistory).map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`${stat.bg} rounded-2xl p-3 flex flex-col gap-1`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
                {loading ? (
                  <>
                    <Skeleton className="h-6 w-8 mt-1" />
                    <Skeleton className="h-3 w-14 mt-1" />
                  </>
                ) : (
                  <>
                    <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground leading-tight">{stat.label}</p>
                    <p className={`text-xs font-bold ${stat.color}`}>{stat.sub}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Party type tabs (All / Customer / Supplier) ── */}
        <div className="flex gap-2 px-4 md:px-6 mb-3">
          {([
            { id: "all",      label: "All",      Icon: FileText },
            { id: "customer", label: "Customer", Icon: User },
            { id: "supplier", label: "Supplier", Icon: Truck },
          ] as { id: Party; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setParty(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                party === id
                  ? "bg-foreground text-background shadow-md"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Date filter pills ── */}
        <div className="flex flex-wrap gap-2 px-4 md:px-6 mb-3">
          {(["all", "week", "today", "custom"] as DateFilter[]).filter(f => f === "today" ? canToday : canHistory).map((f) => (
            <button
              key={f}
              aria-pressed={dateFilter === f}
              onClick={() => setDateFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                dateFilter === f
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All Time" : f === "week" ? "This Week" : f === "custom" ? "Custom Date" : "Today"}
            </button>
          ))}
        </div>

        {customActive && canHistory && (
          <div className="mx-4 md:mx-6 mb-4 rounded-2xl border bg-card p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 min-w-0 text-xs font-bold text-muted-foreground">
                From date
                <input
                  type="date" value={dateFrom} max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="mt-1.5 block h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <label className="flex-1 min-w-0 text-xs font-bold text-muted-foreground">
                To date
                <input
                  type="date" value={dateTo} min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="mt-1.5 block h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
            <p className={`mt-2 text-xs ${rangeError ? "text-destructive" : "text-muted-foreground"}`} role={rangeError ? "alert" : undefined}>
              {rangeError || "Both dates are included. Dates follow India time (IST)."}
            </p>
            {customError && <p role="alert" className="mt-2 text-sm text-destructive">
              {customError} <button className="underline font-bold" onClick={() => setRefreshVersion((value) => value + 1)}>Retry</button>
            </p>}
            {!listLoading && !rangeError && !customError && party !== "supplier" && listBills.length >= 50 && (
              <p className="mt-2 text-xs text-muted-foreground">Showing the latest 50 customer bills in this range. Select a shorter range to see older entries.</p>
            )}
            {!listLoading && !rangeError && !customError && party !== "customer" && listPayments.length >= 100 && (
              <p className="mt-2 text-xs text-muted-foreground">Showing the latest 100 supplier payments in this range. Select a shorter range to see older entries.</p>
            )}
          </div>
        )}

        {/* ── Search bar ── */}
        <div className="px-4 md:px-6 mb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, Bill No, ID or amount…"
              className="w-full h-10 pl-9 pr-10 rounded-xl border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {search && (
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              {filtered.length === 0
                ? "No entries match your search"
                : `${filtered.length} entr${filtered.length !== 1 ? "ies" : "y"} found`}
            </p>
          )}
        </div>

        {/* ── List ── */}
        {listLoading ? (
          <div className="px-4 md:px-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl border bg-card space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg">
              {rangeError && customActive ? "Choose a valid date range" : customError ? "Could not load these bills" : search ? `No results for "${search}"` : customActive ? "No entries in this date range" : "Nothing here yet"}
            </p>
            <p className="text-sm mt-1">
              {customActive ? "Adjust the dates above or choose All Time." : search ? "Try a different name, bill number or amount." : "Complete a checkout to generate an entry."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden px-4 space-y-3">
              {filtered.map((row) => {
                const isSup = row.kind === "supplier";
                return (
                  <Link key={row.key} href={row.href}>
                    <div className="p-4 rounded-2xl border bg-card shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-black truncate">
                            {isSup ? "Bill to Supplier" : "Bill to Customer"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(row.date), "d MMM, h:mm a")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isSup ? "bg-amber-100 dark:bg-amber-950/50" : "bg-green-100 dark:bg-green-950/50"
                          }`}>
                            {isSup
                              ? <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                              : <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm">
                              {row.name}{!isSup
                                ? ` · #${row.billNumber ?? row.shortId} · ${row.itemsCount} item${row.itemsCount !== 1 ? "s" : ""}`
                                : ""}
                            </p>
                            <div className="mt-1.5"><PaymentTypeBadge method={row.method} /></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <p className={`font-black text-xl ${isSup ? "text-amber-600 dark:text-amber-400" : "text-primary"}`}>
                            {isSup ? "−" : ""}₹{row.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block px-6">
              <div className="rounded-2xl border overflow-x-auto">
                <div className="min-w-[850px] grid grid-cols-[minmax(180px,1fr)_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <span>Entry</span>
                  <span className="w-28 text-center">Type</span>
                  <span className="w-32 text-center">Payment Type</span>
                  <span className="w-36 text-right">Amount</span>
                  <span className="w-44 text-right">Date &amp; Time</span>
                  <span className="w-8"></span>
                </div>

                <div className="divide-y divide-border bg-card">
                  {filtered.map((row) => {
                    const isSup = row.kind === "supplier";
                    return (
                      <Link key={row.key} href={row.href}>
                        <div className="min-w-[850px] grid grid-cols-[minmax(180px,1fr)_auto_auto_auto_auto_auto] gap-4 px-5 py-4 hover:bg-muted/30 transition-colors items-center cursor-pointer group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              isSup ? "bg-amber-100 dark:bg-amber-950/50" : "bg-green-100 dark:bg-green-950/50"
                            }`}>
                              {isSup
                                ? <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                : <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-sm text-foreground truncate">{isSup ? "Bill to Supplier" : "Bill to Customer"}</p>
                              <p className="font-mono text-[10px] text-muted-foreground truncate">
                                {row.name}{!isSup
                                  ? ` · #${row.billNumber ?? row.shortId} · ${row.itemsCount} item${row.itemsCount !== 1 ? "s" : ""}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <div className="w-28 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              isSup
                                ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                                : "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
                            }`}>
                              {isSup ? <Truck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              {isSup ? "Supplier" : "Customer"}
                            </span>
                          </div>
                          <div className="w-32 text-center">
                            <PaymentTypeBadge method={row.method} />
                          </div>
                          <div className={`w-36 text-right font-black text-lg ${isSup ? "text-amber-600 dark:text-amber-400" : "text-primary"}`}>
                            {isSup ? "−" : ""}₹{row.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </div>
                          <div className="w-44 text-right text-sm text-muted-foreground font-medium">
                            {format(new Date(row.date), "d MMM yyyy, h:mm a")}
                          </div>
                          <div className="w-8 flex justify-end">
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
