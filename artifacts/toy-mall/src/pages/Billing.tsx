import { useState, useEffect } from "react";
import { Link } from "wouter";
import { format, isToday, isThisWeek } from "date-fns";
import {
  Receipt, ChevronRight, IndianRupee, ShoppingBag,
  CalendarDays, TrendingUp, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ───────────────────────────────────────────────────────── */

interface Bill {
  id: string;
  totalAmount: number;
  itemsCount: number;
  createdAt: string;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Filter = "today" | "week" | "all";

/* ── Component ───────────────────────────────────────────────────── */

export default function Billing() {
  const [bills, setBills]     = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("all");

  useEffect(() => {
    fetch(`${BASE_URL}/api/bills`)
      .then((r) => r.json())
      .then(setBills)
      .finally(() => setLoading(false));
  }, []);

  /* ── Derived stats ── */
  const todayBills   = bills.filter((b) => isToday(new Date(b.createdAt)));
  const weekBills    = bills.filter((b) => isThisWeek(new Date(b.createdAt)));

  const todayRevenue = todayBills.reduce((s, b) => s + b.totalAmount, 0);
  const weekRevenue  = weekBills.reduce((s, b) => s + b.totalAmount, 0);
  const totalRevenue = bills.reduce((s, b) => s + b.totalAmount, 0);

  const filtered =
    filter === "today" ? todayBills :
    filter === "week"  ? weekBills  : bills;

  /* ── UI ── */
  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2 mb-1">
          <Receipt className="w-6 h-6 text-primary hidden md:block" />
          <h1 className="text-2xl font-black">Billing</h1>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">
          All checkout bills and revenue summary
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

        {/* ── Filter pills ── */}
        <div className="flex gap-2 px-4 md:px-6 mb-4">
          {(["all", "week", "today"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All Time" : f === "week" ? "This Week" : "Today"}
            </button>
          ))}
        </div>

        {/* ── Bills list ── */}
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
            <p className="font-bold text-lg">No bills {filter !== "all" ? `for ${filter === "today" ? "today" : "this week"}` : "yet"}</p>
            <p className="text-sm mt-1">Complete a checkout to generate a bill.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden px-4 space-y-3">
              {filtered.map((bill) => (
                <Link key={bill.id} href={`/bill/${bill.id}`}>
                  <div className="p-4 rounded-2xl border bg-card shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        #{bill.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(bill.createdAt), "d MMM, h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center shrink-0">
                          <Receipt className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {bill.itemsCount} item{bill.itemsCount !== 1 ? "s" : ""} sold
                          </p>
                          <span className="text-[10px] bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-black px-2 py-0.5 rounded-full">
                            PAID
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="font-black text-xl text-primary">
                          ₹{bill.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </p>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block px-6">
              <div className="rounded-2xl border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <span>Bill ID</span>
                  <span className="w-28 text-center">Items</span>
                  <span className="w-36 text-right">Total Amount</span>
                  <span className="w-44 text-right">Date & Time</span>
                  <span className="w-8"></span>
                </div>

                <div className="divide-y divide-border bg-card">
                  {filtered.map((bill) => (
                    <Link key={bill.id} href={`/bill/${bill.id}`}>
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-4 hover:bg-muted/30 transition-colors items-center cursor-pointer group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center shrink-0">
                            <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-bold font-mono text-sm">
                              #{bill.id.slice(0, 8).toUpperCase()}
                            </p>
                            <span className="text-[10px] bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-black px-1.5 py-0.5 rounded-full">
                              PAID
                            </span>
                          </div>
                        </div>
                        <div className="w-28 text-center">
                          <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs font-bold px-2.5 py-1 rounded-full">
                            <ShoppingBag className="w-3 h-3" />
                            {bill.itemsCount} item{bill.itemsCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="w-36 text-right font-black text-lg text-primary">
                          ₹{bill.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </div>
                        <div className="w-44 text-right text-sm text-muted-foreground font-medium">
                          {format(new Date(bill.createdAt), "d MMM yyyy, h:mm a")}
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
