/**
 * "Where did every piece go?" — tap a product on a stock sheet and get its
 * full movement history: each stock-in, sale (with bill and customer), return
 * and correction, with date, time and who did it.
 *
 * The header figures follow the Stock Check sheet's rule (opening stock counts
 * as "in", returns are netted out of "out") so the dialog never disagrees with
 * the row that opened it.
 */
import { Link } from "wouter";
import { Loader2, RotateCcw, ExternalLink } from "lucide-react";
import {
  useGetProductTimeline, getGetProductTimelineQueryKey, type ProductStockTotals,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, usePermission } from "@/hooks/use-auth";
import { ProductTimeline } from "./ProductTimeline";

export interface TimelineSubject {
  id: string;
  name: string;
  sku: string;
  category?: string;
}

interface ProductTimelineDialogProps {
  /** The product to show, or null when closed. */
  subject: TimelineSubject | null;
  onClose: () => void;
}

/** Same arithmetic as the Stock Check sheet row (see StockCheck.tsx toSheetItem). */
const sheetFigures = (t: ProductStockTotals) => ({
  inTotal: t.unloggedInQuantity + t.inQuantity,
  entries: t.inCount + (t.unloggedInQuantity > 0 ? 1 : 0),
  outNet: t.outQuantity - t.returnedQuantity,
  returned: t.returnedQuantity,
  adj: t.unloggedOutQuantity,
  stock: t.currentStock,
});

export function ProductTimelineDialog({ subject, onClose }: ProductTimelineDialogProps) {
  const { role } = useAuth();
  const canOpenBills = usePermission("billing") !== "none";
  const canOpenProduct = usePermission("products") !== "none";
  const id = subject?.id ?? "";

  const { data, isLoading, isError, refetch, isFetching } = useGetProductTimeline(id, {
    query: {
      queryKey: getGetProductTimelineQueryKey(id),
      enabled: !!id,
      staleTime: 30_000,
    },
  });

  const product = data?.product;
  const figures = data ? sheetFigures(data.totals) : null;

  return (
    <Dialog open={!!subject} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="flex max-h-[92svh] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-full"
        data-testid="dialog-product-timeline"
      >
        <DialogHeader className="space-y-0 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5">
          <DialogTitle className="truncate text-base font-black leading-tight sm:text-lg" data-testid="text-timeline-product">
            {product?.name ?? subject?.name ?? "Product"}
            {product?.deleted && (
              <span className="ml-2 align-middle rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Deleted
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-[11px] font-semibold">
            {product?.sku ?? subject?.sku}
            {(product?.category ?? subject?.category) ? ` · ${product?.category ?? subject?.category}` : ""}
            {product?.supplierName ? ` · ${product.supplierName}` : ""}
          </DialogDescription>

          {/* Figures — the same four the sheet prints for this row */}
          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border bg-muted/20 text-center tabular-nums">
            <Figure label="In" value={figures?.inTotal} sub={figures ? `${figures.entries} ${figures.entries === 1 ? "entry" : "entries"}` : undefined} testId="figure-in" />
            <Figure label="Out" value={figures?.outNet} sub={figures && figures.returned > 0 ? `${figures.returned} returned` : undefined} className="border-x" testId="figure-out" />
            <Figure label="Stock" value={figures?.stock} sub={figures && figures.adj > 0 ? `−${figures.adj} adj` : undefined} strong testId="figure-stock" />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-muted-foreground" data-testid="timeline-loading">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading movements…
            </div>
          ) : isError || !data ? (
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
          ) : (
            <ProductTimeline data={data} showCost={role === "owner"} canOpenBills={canOpenBills} />
          )}
        </div>

        {product && !product.deleted && canOpenProduct && (
          <div className="border-t px-4 py-2.5 sm:px-5">
            <Link
              href={`/product?sku=${encodeURIComponent(product.sku)}`}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              data-testid="link-open-product"
            >
              Open product page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
