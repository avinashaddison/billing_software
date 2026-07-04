import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { format, isToday, isThisWeek } from "date-fns";
import {
  ChevronRight, IndianRupee, ShoppingBag,
  CalendarDays, TrendingUp, Search, X, FileText, User, Truck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ───────────────────────────────────────────────────────── */

interface Bill {
  id: string;
  billNumber?: number;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
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
  method?: string;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type DateFilter = "today" | "week" | "all";
type Party = "all" | "customer" | "supplier";

/* ── Component ───────────────────────────────────────────────────── */

export default function Billing() {
  const [bills, setBills]       = useState<Bill[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [party, setParty]       = useState<Party>("all");
  const [search, setSearch]     = useState("");

  const load = useCallback(() => {
    return Promise.all([
      fetch(`${BASE_URL}/api/bills`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${BASE_URL}/api/supplier-payments`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([b, p]) => {
        setBills(Array.isArray(b) ? b : []);
        setPayments(Array.isArray(p) ? p : []);
      })
      .catch(() => { setBills([]); setPayments([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void load(); }, [load]);

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

  /* ── Stats (customer sales = revenue only; supplier payments are money out) ── */
  const todayBills   = bills.filter((b) => isToday(new Date(b.createdAt)));
  const weekBills    = bills.filter((b) => isThisWeek(new Date(b.createdAt)));
  const todayRevenue = todayBills.reduce((s, b) => s + b.totalAmount, 0);
  const weekRevenue  = weekBills.reduce((s, b) => s + b.totalAmount, 0);
  const totalRevenue = bills.reduce((s, b) => s + b.totalAmount, 0);

  /* ── Build the unified row list ── */
  const customerRows: Row[] = bills.map((b) => ({
    key: `b-${b.id}`,
    kind: "customer",
    name: b.customerName?.trim() || (b.customerPhone ? `+91 ${b.customerPhone}` : "Walk-in customer"),
    amount: b.totalAmount,
    date: b.createdAt,
    href: `/bill/${b.id}`,
    billNumber: b.billNumber,
    shortId: b.id.slice(0, 8).toUpperCase(),
    itemsCount: b.itemsCount,
  }));
  const supplierRows: Row[] = payments.map((p) => ({
    key: `s-${p.id}`,
    kind: "supplier",
    name: p.supplierName,
    amount: p.amount,
    date: p.paidAt,
    href: "/suppliers",
    method: p.method,
  }));

  const allRows = [...customerRows, ...supplierRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  /* ── Filter + search pipeline ── */
  const partyFiltered = party === "all" ? allRows : allRows.filter((r) => r.kind === party);
  const timeFiltered =
    dateFilter === "today" ? partyFiltered.filter((r) => isToday(new Date(r.date)))
    : dateFilter === "week" ? partyFiltered.filter((r) => isThisWeek(new Date(r.date)))
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

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3 p-4 md:px-6">
          {[
            {
              label: "Today's Bills",
              value: loading ? null : todayBills.length,
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
          ].map((stat) => {
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
        <div className="flex gap-2 px-4 md:px-6 mb-3">
          {(["all", "week", "today"] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                dateFilter === f
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All Time" : f === "week" ? "This Week" : "Today"}
            </button>
          ))}
        </div>

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
        {loading ? (
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
              {search ? `No results for "${search}"` : "Nothing here yet"}
            </p>
            <p className="text-sm mt-1">
              {search ? "Try a different name, bill number or amount." : "Complete a checkout to generate an entry."}
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
                              {row.name}{isSup
                                ? ` · ${(row.method ?? "cash").toUpperCase()}`
                                : ` · #${row.billNumber ?? row.shortId} · ${row.itemsCount} item${row.itemsCount !== 1 ? "s" : ""}`}
                            </p>
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
              <div className="rounded-2xl border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <span>Entry</span>
                  <span className="w-28 text-center">Type</span>
                  <span className="w-36 text-right">Amount</span>
                  <span className="w-44 text-right">Date &amp; Time</span>
                  <span className="w-8"></span>
                </div>

                <div className="divide-y divide-border bg-card">
                  {filtered.map((row) => {
                    const isSup = row.kind === "supplier";
                    return (
                      <Link key={row.key} href={row.href}>
                        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-4 hover:bg-muted/30 transition-colors items-center cursor-pointer group">
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
                                {row.name}{isSup
                                  ? ` · ${(row.method ?? "cash").toUpperCase()}`
                                  : ` · #${row.billNumber ?? row.shortId} · ${row.itemsCount} item${row.itemsCount !== 1 ? "s" : ""}`}
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
