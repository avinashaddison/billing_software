/**
 * "Tracking" card on the Product page — the same movement history the Stock
 * Check sheet opens in a dialog, shown inline where the owner is already
 * looking at the item: every stock-in, sale and return with date, time, who
 * recorded it and, for sales, which bill and customer.
 *
 * The Product page opens with `products: read` alone, which does not cover
 * the timeline endpoint (Suppliers or Stock Logs read); staff without either
 * see a notice naming the permission instead of a card that fails to load.
 */
import { History, RotateCcw } from "lucide-react";
import { useCanViewTimeline } from "@/hooks/use-auth";
import { useProductTimelineQuery, TimelineFigures, TimelineBody } from "./ProductTimelinePanel";

interface ProductTrackingCardProps {
  productId: string;
}

export function ProductTrackingCard({ productId }: ProductTrackingCardProps) {
  const canView = useCanViewTimeline();
  const query = useProductTimelineQuery(productId, canView);
  const count = query.data?.events.length;

  return (
    <section
      className="overflow-hidden rounded-3xl border bg-card shadow-sm"
      aria-labelledby="tracking-heading"
      data-testid="card-product-tracking"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 id="tracking-heading" className="flex items-center gap-2 text-lg font-bold">
            <History className="h-5 w-5 text-muted-foreground" aria-hidden />
            Tracking
            {count != null && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-black tabular-nums text-muted-foreground" data-testid="text-tracking-count">
                {count}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every stock-in, sale and return — with date, time, who did it and which bill.
          </p>
        </div>
        {canView && (
          <button
            type="button"
            onClick={() => { void query.refetch(); }}
            disabled={query.isFetching}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            aria-label="Refresh tracking"
            data-testid="button-refresh-tracking"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>

      {canView ? (
        <>
          <div className="px-5 pt-4">
            <TimelineFigures totals={query.data?.totals} className="sm:max-w-md" />
          </div>
          <div className="px-5 pb-5 pt-3">
            <TimelineBody query={query} />
          </div>
        </>
      ) : (
        <div className="px-5 pb-5 pt-4" data-testid="tracking-restricted">
          <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            <div className="text-3xl" aria-hidden>🔒</div>
            <p className="mt-1">
              Seeing this product's movements needs{" "}
              <span className="font-semibold text-foreground">Stock Logs</span> or{" "}
              <span className="font-semibold text-foreground">Suppliers</span> access.
              <br />Ask the owner to grant it.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
