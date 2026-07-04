import { useState, useEffect } from "react";
import { useListStockLogs, getListStockLogsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  Clock, ArrowDownToLine, ArrowUpToLine, Settings2,
  Receipt, ShoppingBag, ChevronRight, Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
        <span className="w-40 text-right">Date & Time</span>
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
                <Badge variant="outline" className="font-bold text-xs">
                  {bill.itemsCount} item{bill.itemsCount !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="w-36 text-right font-black text-lg text-primary">
                ₹{bill.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </div>
              <div className="w-40 text-right text-sm text-muted-foreground font-medium flex items-center justify-end gap-1">
                {format(new Date(bill.createdAt), "MMM d, h:mm a")}
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
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

export default function Logs() {
  const [tab, setTab]   = useState<Tab>("activity");
  const [type, setType] = useState<ListStockLogsType | "ALL">("ALL");

  const queryParams = type === "ALL" ? {} : { type: type as ListStockLogsType };

  const { data: logs, isLoading } = useListStockLogs(queryParams, {
    query: { queryKey: getListStockLogsQueryKey(queryParams) }
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
            {logs && tab === "activity" && (
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
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-0">

        {tab === "bills" ? (
          <BillsTab />
        ) : (
          <>
            {/* Activity tab */}
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
                <p className="font-bold text-lg">No activity yet</p>
                <p className="text-sm">Stock IN and OUT actions will appear here.</p>
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
