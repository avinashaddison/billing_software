/**
 * "Where did every piece go?" — tap a product on a stock sheet and get its
 * full movement history: each stock-in, sale (with bill and customer), return
 * and correction, with date, time and who did it.
 *
 * The header figures follow the Stock Check sheet's rule (opening stock counts
 * as "in", returns are netted out of "out") so the dialog never disagrees with
 * the row that opened it. The Product page shows the same history inline
 * (ProductTrackingCard); both are built from ProductTimelinePanel.
 */
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-auth";
import { useProductTimelineQuery, TimelineFigures, TimelineBody } from "./ProductTimelinePanel";

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

export function ProductTimelineDialog({ subject, onClose }: ProductTimelineDialogProps) {
  const canOpenProduct = usePermission("products") !== "none";
  const id = subject?.id ?? "";
  const query = useProductTimelineQuery(id);
  const product = query.data?.product;

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

          {/* Figures — the same three the sheet prints for this row */}
          <TimelineFigures totals={query.data?.totals} className="mt-3" />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          <TimelineBody query={query} />
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
