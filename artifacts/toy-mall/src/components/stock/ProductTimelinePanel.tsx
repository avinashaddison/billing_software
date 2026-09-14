/**
 * The pieces of a product's movement timeline that every host shares — the
 * fetch, the In / Out / Stock strip and the loading / error / list body — so
 * the dialog opened from the Stock Check sheet and the tracking card on the
 * Product page can never drift apart. Hosts own only their frame (dialog
 * chrome or page card) and pass the same query object to both parts.
 */
import { Loader2, RotateCcw } from "lucide-react";
import {
  useGetProductTimeline, getGetProductTimelineQueryKey, type ProductStockTotals,
} from "@workspace/api-client-react";
import { sheetFigures } from "@/lib/stock-check-pdf";
import { useAuth, usePermission } from "@/hooks/use-auth";
import { ProductTimeline } from "./ProductTimeline";

/**
 * One product's timeline, fetched only while `enabled` and the id is set.
 * Kept briefly fresh so re-opening the same product on the sheet is instant;
 * hosts that change stock themselves invalidate `getGetProductTimelineQueryKey`.
 */
export function useProductTimelineQuery(id: string, enabled = true) {
  return useGetProductTimeline(id, {
    query: {
      queryKey: getGetProductTimelineQueryKey(id),
      enabled: enabled && !!id,
      staleTime: 30_000,
    },
  });
}

export type ProductTimelineQuery = ReturnType<typeof useProductTimelineQuery>;

interface TimelineFiguresProps {
  /** Undefined while loading — the strip renders dashes so the layout holds. */
  totals: ProductStockTotals | undefined;
  className?: string;
}

/**
 * In / Out / Stock — the same three figures, by the same rule (`sheetFigures`),
 * as the Stock Check sheet prints for this product's row.
 */
export function TimelineFigures({ totals, className = "" }: TimelineFiguresProps) {
  const figures = totals ? sheetFigures(totals) : null;
  return (
    <div className={`grid grid-cols-3 overflow-hidden rounded-xl border bg-muted/20 text-center tabular-nums ${className}`}>
      <Figure label="In" value={figures?.inTotal} sub={figures ? `${figures.entries} ${figures.entries === 1 ? "entry" : "entries"}` : undefined} testId="figure-in" />
      <Figure label="Out" value={figures?.outNet} sub={figures && figures.returned > 0 ? `${figures.returned} returned` : undefined} className="border-x" testId="figure-out" />
      <Figure label="Stock" value={figures?.stock} sub={figures && figures.adj > 0 ? `−${figures.adj} adj` : undefined} strong testId="figure-stock" />
    </div>
  );
}

function Figure({ label, value, sub, className = "", strong = false, testId }: {
  label: string; value: number | undefined; sub?: string; className?: string; strong?: boolean; testId: string;
}) {
  return (
    <div className={`px-2 py-2 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl leading-tight ${strong ? "font-black" : "font-bold text-muted-foreground"}`} data-testid={testId}>
        {value ?? "–"}
      </p>
      <p className="h-4 text-[11px] font-semibold text-muted-foreground/80">{sub ?? ""}</p>
    </div>
  );
}

/**
 * Loading, failed (with retry) or the timeline itself. Cost is owner-only
 * and bill links appear only for staff who can open the Bill page — the
 * same rules as everywhere else in the app.
 */
export function TimelineBody({ query }: { query: ProductTimelineQuery }) {
  const { role } = useAuth();
  const canOpenBills = usePermission("billing") !== "none";
  const { data, isLoading, isError, refetch, isFetching } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-muted-foreground" data-testid="timeline-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading movements…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground" data-testid="timeline-error">
        <p className="font-semibold">Could not load this product's history.</p>
        <button
          type="button"
          onClick={() => { void refetch(); }}
          disabled={isFetching}
          className="mt-2 inline-flex items-center gap-1.5 font-bold text-primary hover:underline disabled:opacity-50"
          data-testid="button-retry-timeline"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Try again
        </button>
      </div>
    );
  }
  return <ProductTimeline data={data} showCost={role === "owner"} canOpenBills={canOpenBills} />;
}
