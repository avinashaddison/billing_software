import type { ProductStockHistory } from "@workspace/api-client-react";
import { Boxes, Loader2, PackagePlus, RotateCcw, ShoppingCart, SlidersHorizontal } from "lucide-react";

const IST = "Asia/Kolkata";

const istDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });

const todayIst = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: IST });

const shiftDay = (day: string, deltaDays: number) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + deltaDays))
    .toISOString()
    .slice(0, 10);
};

const dateLabel = (iso: string) => {
  const day = istDay(iso);
  const today = todayIst();
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const exactDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

interface StockBatchHistoryProps {
  history?: ProductStockHistory;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  limit?: number;
  compact?: boolean;
}

export function StockBatchHistory({
  history,
  isLoading,
  isError = false,
  onRetry,
  limit,
  compact = false,
}: StockBatchHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading stock history…
      </div>
    );
  }

  if (isError || !history) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <p>Could not load stock history.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
            data-testid="button-retry-stock-history"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </button>
        )}
      </div>
    );
  }

  const batches = limit == null ? history.batches : history.batches.slice(0, limit);

  return (
    <div className="space-y-3" data-testid="section-stock-batch-history">
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-muted/20">
        <div className="px-2 py-3 text-center sm:px-3">
          <PackagePlus className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Added</p>
          <p className="text-lg font-bold tabular-nums text-emerald-700" data-testid="text-total-stocked">
            {history.summary.stockedQuantity}
          </p>
        </div>
        <div className="border-x px-2 py-3 text-center sm:px-3">
          <ShoppingCart className="mx-auto mb-1 h-4 w-4 text-amber-600" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sold</p>
          <p className="text-lg font-bold tabular-nums text-amber-700" data-testid="text-total-sold">
            {history.summary.soldQuantity}
          </p>
        </div>
        <div className="px-2 py-3 text-center sm:px-3">
          <Boxes className="mx-auto mb-1 h-4 w-4 text-blue-600" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">In stock</p>
          <p className="text-lg font-bold tabular-nums text-blue-700" data-testid="text-current-stock">
            {history.currentStock}
          </p>
        </div>
      </div>

      {history.summary.unattributedRemaining > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300"
          data-testid="note-unattributed-stock"
        >
          <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {history.summary.unattributedRemaining} current{" "}
            {history.summary.unattributedRemaining === 1 ? "unit is" : "units are"} opening,
            returned, or adjusted stock and not tied to a dated restock.
          </span>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          No dated stock addition recorded yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="rounded-xl border bg-card p-3"
              data-testid={`card-stock-batch-${batch.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{dateLabel(batch.addedAt)}</p>
                  <p className="text-xs text-muted-foreground">{exactDateTime(batch.addedAt)} IST</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  +{batch.addedQuantity}
                </span>
              </div>

              <div className={`mt-3 grid grid-cols-3 gap-2 ${compact ? "text-xs" : "text-sm"}`}>
                <div className="rounded-lg bg-emerald-50 px-2 py-2 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">Added</p>
                  <p className="font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                    {batch.addedQuantity}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-2 dark:bg-amber-950/30">
                  <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">Sold</p>
                  <p
                    className="font-bold tabular-nums text-amber-800 dark:text-amber-300"
                    data-testid={`text-batch-sold-${batch.id}`}
                  >
                    {batch.soldQuantity}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 px-2 py-2 dark:bg-blue-950/30">
                  <p className="text-[10px] font-semibold uppercase text-blue-700 dark:text-blue-400">Remaining</p>
                  <p
                    className="font-bold tabular-nums text-blue-800 dark:text-blue-300"
                    data-testid={`text-batch-remaining-${batch.id}`}
                  >
                    {batch.remainingQuantity}
                  </p>
                </div>
              </div>

              {batch.adjustedQuantity > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {batch.adjustedQuantity}{" "}
                  {batch.adjustedQuantity === 1 ? "unit was" : "units were"} no longer tied
                  to this batch after a stock correction (not counted as sold)
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}