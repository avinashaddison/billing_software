import {
  useListStockLogs, getListStockLogsQueryKey,
  useGetTodayActivity, getGetTodayActivityQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  ArrowLeft, ArrowUpToLine, Clock, Package, Receipt, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const LOG_PARAMS = { type: "OUT", today: true, limit: 1000 } as const;

/* ── Summary tile ────────────────────────────────────────────────── */
function SummaryTile({
  label, value, icon: Icon, loading,
}: {
  label: string; value: number; icon: React.ElementType; loading?: boolean;
}) {
  return (
    <div className="relative bg-card border rounded-2xl overflow-hidden shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/8 via-transparent to-transparent pointer-events-none" />
      <div className="relative p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest leading-tight">{label}</p>
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-black leading-none tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function TodayOut() {
  const { data: activity, isLoading: loadingActivity } = useGetTodayActivity({
    query: { queryKey: getGetTodayActivityQueryKey() },
  });
  const { data: logs, isLoading: loadingLogs } = useListStockLogs(LOG_PARAMS, {
    query: { queryKey: getListStockLogsQueryKey(LOG_PARAMS) },
  });

  const distinctProducts = new Set(logs?.map((l) => l.productId)).size;

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Sticky header ── */}
      <div className="px-4 md:px-6 py-3 border-b sticky top-0 bg-background/85 backdrop-blur z-10 flex items-center gap-3">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-lg flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-rose-500 flex items-center justify-center shadow-sm">
              <ArrowUpToLine className="w-3.5 h-3.5 text-white" />
            </div>
            Today OUT
          </h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            {format(new Date(), "EEEE, MMM d")}
          </p>
        </div>
        <Link href="/logs"
          className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors">
          All Logs <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">

        {/* ── Summary tiles ── */}
        <div className="grid grid-cols-3 gap-3 p-4 md:px-6">
          <SummaryTile label="Units Out" value={activity?.outQuantity ?? 0} icon={ArrowUpToLine} loading={loadingActivity} />
          <SummaryTile label="Transactions" value={activity?.outCount ?? 0} icon={Receipt} loading={loadingActivity} />
          <SummaryTile label="Products" value={distinctProducts} icon={Package} loading={loadingLogs} />
        </div>

        {/* ── Transaction list ── */}
        {loadingLogs ? (
          <div className="p-4 md:px-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl border bg-card space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ArrowUpToLine className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg">No stock OUT today</p>
            <p className="text-sm">Sales and stock-out entries will appear here as they happen.</p>
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-2 border-y text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
              <span className="w-8"></span>
              <span>Product</span>
              <span className="w-24 text-right">Quantity</span>
              <span className="w-28 text-right">Time</span>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden px-4 pb-4 space-y-3">
              {logs.map((log) => (
                <Link key={log.id} href={`/product?sku=${encodeURIComponent(log.productSku)}`}>
                  <div className="p-4 rounded-2xl border bg-card shadow-sm hover:border-rose-300/60 active:scale-[0.99] transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(log.createdAt), "h:mm a")}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30">
                        OUT
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-sm truncate">{log.productName}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{log.productSku}</p>
                      </div>
                      <div className="font-black text-lg text-red-600 dark:text-red-400 shrink-0">
                        -{log.quantity}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table rows */}
            <div className="hidden md:block divide-y divide-border">
              {logs.map((log) => (
                <Link key={log.id} href={`/product?sku=${encodeURIComponent(log.productSku)}`}>
                  <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors items-center cursor-pointer group">
                    <div className="w-8 flex justify-center">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <ArrowUpToLine className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{log.productName}</p>
                      <p className="text-xs font-mono text-muted-foreground">{log.productSku}</p>
                    </div>
                    <div className="w-24 text-right font-black text-lg text-red-600 dark:text-red-400">
                      -{log.quantity}
                    </div>
                    <div className="w-28 text-right text-sm text-muted-foreground font-medium flex items-center justify-end gap-1">
                      {format(new Date(log.createdAt), "h:mm a")}
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
