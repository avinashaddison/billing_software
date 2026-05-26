import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ScanLine, Printer, RotateCcw, X, Minus, Plus, Check, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useStoreSettings } from "@/lib/store-info";

interface BillItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  mrp: number | null;
  preDiscountPrice?: number | null;
  discountType?:    "percent" | "amount" | null;
  discountValue?:   number | null;
  subtotal: number;
  /** True for MANUAL / non-inventory lines (gift wrap, customer's own
   *  item, ad-hoc service charge). The server returns this flag so the
   *  return modal can exclude them — there's no stock to put back. */
  isManual?: boolean;
}

interface BillData {
  bill: {
    id: string;
    billNumber?: number;
    totalAmount: number;
    itemsCount: number;
    createdAt: string;
    paymentMode?: string;
    customerName?: string | null;
    customerPhone?: string | null;
    discount?: number | null;
    discountType?: string | null;
  };
  items: BillItem[];
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ─── Number → Indian English words (paise rounded) ───────────────── */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigitWords(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = "";
  if (h) out += ONES[h] + " Hundred";
  if (r) out += (out ? " " : "") + twoDigitWords(r);
  return out;
}

function numberToIndianWords(num: number): string {
  if (!Number.isFinite(num)) return "";
  const rupees = Math.floor(num);
  const paise  = Math.round((num - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh  = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const remainder = rupees % 1000;

  const parts: string[] = [];
  if (crore)    parts.push(twoDigitWords(crore)    + " Crore");
  if (lakh)     parts.push(twoDigitWords(lakh)     + " Lakh");
  if (thousand) parts.push(twoDigitWords(thousand) + " Thousand");
  if (remainder) parts.push(threeDigitWords(remainder));

  let words = parts.join(" ").trim();
  if (paise > 0) words += " and " + twoDigitWords(paise) + " Paise";
  return words + " Only";
}

/* ─── Return modal ───────────────────────────────────────────────── */
function ReturnModal({ billId, items, onClose }: { billId: string; items: BillItem[]; onClose: (restocked: boolean) => void }) {
  // Manual / non-inventory lines have no stock to restock. We exclude them
  // from the return UI entirely — refunding cash on a gift-wrap charge is
  // a different workflow (cashier hands back cash, no backend action).
  const returnableItems = items.filter((i) => !i.isManual);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qtys, setQtys]         = useState<Record<string, number>>(() =>
    Object.fromEntries(returnableItems.map((i) => [i.id, i.quantity]))
  );
  const [processing, setProcessing] = useState(false);
  const [reason, setReason]         = useState("Customer return");

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleReturn = async () => {
    if (selected.size === 0) { toast.error("Select at least one item to return"); return; }
    setProcessing(true);
    try {
      /* Build items using productId (not the sale-item id) */
      const returnItems = Array.from(selected).map((saleItemId) => {
        const item = returnableItems.find((i) => i.id === saleItemId)!;
        return { productId: item.productId, quantity: qtys[saleItemId] };
      });
      const r = await fetch(`${BASE_URL}/api/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, items: returnItems, reason }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      const data = await r.json();
      const refundStr = data.totalRefund != null
        ? `₹${data.totalRefund.toLocaleString("en-IN", { maximumFractionDigits: 0 })} refunded, `
        : "";
      toast.success(`Return processed — ${refundStr}stock restocked`);
      onClose(true);
    } catch (e: any) { toast.error(e.message || "Return failed"); }
    finally { setProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="relative w-full md:max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-black text-lg flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-500" /> Process Return
          </h2>
          <button onClick={() => onClose(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">Select items to return. Stock will be automatically restocked.</p>
          {returnableItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-3 py-3 text-xs text-amber-700 dark:text-amber-300 leading-snug">
              This bill only contains <b>manual</b> line items (no SKU, no stock).
              Manual lines can't be returned through this flow — refund the cash
              directly to the customer.
            </div>
          )}
          {items.some((i) => i.isManual) && returnableItems.length > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
              Manual items on this bill are not shown — they have no stock to restock.
            </p>
          )}
          {returnableItems.map((item) => {
            const isSel = selected.has(item.id);
            return (
              <div key={item.id} className={`p-3 rounded-xl border transition-all ${isSel ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggle(item.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSel ? "bg-orange-500 border-orange-500" : "border-muted-foreground/40"}`}>
                    {isSel && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.productSku} · ₹{item.price.toLocaleString("en-IN")} each</p>
                  </div>
                  {isSel && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setQtys((q) => ({ ...q, [item.id]: Math.max(1, (q[item.id] ?? 1) - 1) }))}
                        className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-black">{qtys[item.id]}</span>
                      <button onClick={() => setQtys((q) => ({ ...q, [item.id]: Math.min(item.quantity, (q[item.id] ?? 1) + 1) }))}
                        className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-muted-foreground">/ {item.quantity}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">Reason</p>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div className="p-4 border-t">
          <button onClick={handleReturn} disabled={processing || selected.size === 0}
            className="w-full h-12 bg-orange-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50">
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><RotateCcw className="w-4 h-4" /> Process Return ({selected.size} item{selected.size !== 1 ? "s" : ""})</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function Bill() {
  const { id: billId } = useParams<{ id: string }>();
  const store = useStoreSettings();
  const [data, setData]       = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showReturn, setShowReturn] = useState(false);

  const loadBill = () => {
    if (!billId) return;
    setLoading(true);
    fetch(`${BASE_URL}/api/bills/${billId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Could not load bill"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBill(); }, [billId]);

  /* ── loading / error ── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-black border-t-transparent animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="font-mono text-red-600">{error ?? "Bill not found"}</p>
      </div>
    );
  }

  const { bill, items } = data;

  if (showReturn) {
    return (
      <ReturnModal
        billId={bill.id}
        items={items}
        onClose={(restocked) => {
          setShowReturn(false);
          if (restocked) loadBill();
        }}
      />
    );
  }

  const dt = new Date(bill.createdAt);
  const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const billNo  = bill.billNumber ? String(bill.billNumber) : bill.id.slice(0, 8).toUpperCase();

  const buildShareText = () => {
    const itemLines = items
      .map((it) => `  • ${it.productName} × ${it.quantity} — ₹${it.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .join("\n");
    return [
      `🛍️ ${store.name} — Receipt`,
      `Bill #${billNo}  |  ${dateStr} ${timeStr}`,
      ``,
      itemLines,
      ``,
      `Total: ₹${bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Payment: ${(bill.paymentMode ?? "CASH").toUpperCase()}`,
      ``,
      `Thank you for shopping with us! 🎉`,
      ``,
      `Ref: ${bill.id}`,
    ].join("\n");
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Receipt #${billNo}`, text });
        toast.success("Receipt shared!");
      } catch {
        /* user dismissed — do nothing */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Receipt copied to clipboard!");
      } catch {
        toast.error("Could not copy receipt");
      }
    }
  };

  return (
    <>
      {/* ── Print CSS ── */}
      {(() => {
        const paperWidth = store.receiptPaperWidth ?? "80mm";
        // Thermal printers have a hardware non-printable margin (~3–4mm per
        // side on 80mm rolls, ~2mm on 58mm). We shrink the rendered content
        // to a safe inner width so nothing gets clipped, and zero out the
        // CSS @page margin so the safe area itself isn't squeezed further.
        const contentWidth = paperWidth === "58mm" ? "54mm" : "72mm";

        // ── Why a giant fixed page height instead of `auto` ──
        // `size: 80mm auto` is the spec-compliant way to ask the browser
        // for "one page, as tall as the content". In practice, many
        // Windows thermal drivers (incl. the generic "80mm Series Printer")
        // report a FIXED default paper length (often ~297mm), and Chrome
        // paginates against that — so any receipt taller than ~297mm is
        // split into 2 sheets in the print preview, which becomes 2 cut
        // receipts on a continuous roll.
        //
        // Declaring a very tall page height (3276mm is Chromium's max)
        // forces the receipt onto a single logical page. The thermal
        // printer only feeds paper for actual ink marks, so no blank
        // tape is wasted.
        return (
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&display=swap');

            @page {
              size: ${paperWidth} 3276mm;
              margin: 0;
            }

            @media print {
              /* Hard-hide the screen-only chrome (top bar, etc.). Using
                 display:none (not visibility:hidden) so the elements no
                 longer reserve layout space and the receipt can sit at
                 the top of the page. */
              .no-print, .no-print * { display: none !important; }

              /* Turn every ancestor of the receipt into a transparent
                 passthrough: no background, no shadow, no max-height, no
                 scrolling. This is critical for long receipts — the screen
                 'overflow-y-auto' on .receipt-shell would otherwise clip
                 the print to the visible viewport height. */
              html, body, .receipt-shell, .receipt-shell > div {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow: visible !important;
              }

              /* The receipt flows in NORMAL document order (not fixed) so
                 a long bill paginates across the continuous thermal roll
                 instead of being clipped to a single 'page' by the browser
                 print engine. */
              .receipt-print-only {
                position: static !important;
                display: block !important;
                margin: 0 auto !important;
                width: ${contentWidth} !important;
                max-width: ${contentWidth} !important;
                box-sizing: border-box !important;
                padding: 0 !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                overflow: visible !important;
              }

              /* Force every descendant to honour border-box so a stray
                 padding never bumps the outer width past ${contentWidth}. */
              .receipt-print-only * {
                box-sizing: border-box !important;
              }

              /* Kill the screen-only my-6 + py-4 padding above the store
                 logo so the print starts right at the top of the paper. */
              .receipt-print-only > div:first-child {
                padding-top: 1mm !important;
                padding-bottom: 1mm !important;
                padding-left: 1.5mm !important;
                padding-right: 1.5mm !important;
              }

              /* Don't split an item row across a page break. Browsers
                 paginate based on @page; this hint keeps each line item
                 intact. */
              .receipt-print-only tr,
              .receipt-print-only tbody,
              .receipt-print-only thead {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }

              /* Force black-fill GRAND TOTAL bar to render solid in browser print */
              .receipt-print-only .receipt-grand-total {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `}</style>
        );
      })()}

      <div className="receipt-shell flex flex-col h-full bg-gray-100 dark:bg-neutral-900 overflow-y-auto">

        {/* ── Top bar (screen only) ── */}
        <div className="no-print sticky top-0 z-10 bg-white dark:bg-neutral-800 border-b flex items-center gap-3 px-4 py-3 shadow-sm">
          <Link href="/billing" className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-base flex-1">Receipt</h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>

        {/* ── Receipt wrapper ── */}
        {(() => {
          const itemsSubtotal  = items.reduce((s, i) => s + i.subtotal, 0);
          const mrpTotal       = items.reduce((s, i) => s + (i.mrp ?? i.price) * i.quantity, 0);
          const saleSavings    = items.reduce((sum, i) =>
            i.mrp != null && i.mrp > i.price ? sum + (i.mrp - i.price) * i.quantity : sum, 0);
          const manualDiscount = Math.max(0, itemsSubtotal - bill.totalAmount);
          const totalSavings   = saleSavings + manualDiscount;
          const totalQty       = items.reduce((s, i) => s + i.quantity, 0);
          const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return (
        <div className="receipt-print-only receipt-card mx-auto my-6 w-full max-w-sm bg-white shadow-2xl overflow-hidden text-black"
             style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

          <div className="px-4 py-4 text-[12px] leading-snug">

            {/* ── STORE HEADER ── */}
            {store.logoUrl ? (
              /* Centered logo above large elegant store name */
              <div className="text-center">
                <img src={store.logoUrl} alt={store.name}
                     className="mx-auto h-16 w-auto max-w-[80px] object-contain mb-2"
                     style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as any} />
                <div
                  style={{
                    fontFamily: "'Cinzel', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
                    fontWeight: 900,
                    fontSize: store.name.length > 20 ? "24px" : "30px",
                    lineHeight: 1.1,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#000",
                  } as any}
                >
                  {store.name}
                </div>
                {store.tagline && (
                  <div
                    style={{
                      fontFamily: "'Cinzel', Georgia, serif",
                      fontSize: "10px",
                      fontStyle: "italic",
                      letterSpacing: "0.1em",
                      color: "#444",
                      marginTop: "5px",
                    } as any}
                  >
                    ✦ {store.tagline} ✦
                  </div>
                )}
              </div>
            ) : (
              /* Elegant centered header with decorative ornament frame */
              <div className="text-center" style={{ padding: '4px 0' }}>
                <div style={{ fontSize: '9px', letterSpacing: '0.4em', color: '#999', marginBottom: '5px' }}>
                  ✦ ─────── ✦
                </div>
                <div
                  style={{
                    fontFamily: "'Cinzel', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
                    fontWeight: 900,
                    fontSize: store.name.length > 22 ? "26px" : "32px",
                    lineHeight: 1.05,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#000",
                  } as any}
                >
                  {store.name}
                </div>
                {store.tagline && (
                  <div
                    style={{
                      fontFamily: "'Cinzel', Georgia, serif",
                      fontSize: "11px",
                      fontStyle: "italic",
                      letterSpacing: "0.08em",
                      color: "#444",
                      marginTop: "5px",
                    } as any}
                  >
                    ─ {store.tagline} ─
                  </div>
                )}
                <div style={{ fontSize: '9px', letterSpacing: '0.4em', color: '#999', marginTop: '5px' }}>
                  ✦ ─────── ✦
                </div>
              </div>
            )}

            <div className="text-center text-[10.5px] leading-tight mt-2.5 space-y-px">
              <div>{store.address}</div>
              <div>Phone : <span className="font-semibold">{store.phone}</span></div>
              {store.email && <div>E-Mail : {store.email}</div>}
              {store.gst && <div>GSTIN : <span className="font-semibold">{store.gst}</span></div>}
            </div>

            <div className="text-center font-black text-[11px] tracking-[0.25em] mt-2.5 mb-1.5 border-y border-black py-0.5 uppercase">Invoice</div>

            {/* ── CUSTOMER + BILL META ── */}
            <div className="border border-black grid grid-cols-2 text-[10.5px] leading-[1.55]">
              <div className="p-1.5 border-r border-black space-y-0.5 flex flex-col justify-center min-w-0">
                <div className="flex min-w-0">
                  <span className="w-[44px] shrink-0">Name</span>
                  <span className="shrink-0">:&nbsp;</span>
                  <span className="flex-1 min-w-0 border-b border-dotted border-black/40 font-semibold break-words">
                    {bill.customerName ? bill.customerName : <span className="text-black/30">—</span>}
                  </span>
                </div>
                <div className="flex min-w-0">
                  <span className="w-[44px] shrink-0">Mobile</span>
                  <span className="shrink-0">:&nbsp;</span>
                  <span className="flex-1 min-w-0 border-b border-dotted border-black/40 font-semibold break-words">
                    {bill.customerPhone ? `+91 ${bill.customerPhone}` : <span className="text-black/30">—</span>}
                  </span>
                </div>
              </div>
              <div className="p-1.5 space-y-0.5">
                <div className="flex justify-between"><span>Bill&nbsp;No</span><span className="font-bold tabular-nums">#{billNo}</span></div>
                <div className="flex justify-between"><span>Date</span><span className="tabular-nums">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></div>
                <div className="flex justify-between"><span>Time</span><span className="tabular-nums">{timeStr}</span></div>
              </div>
            </div>

            {/* ── ITEM TABLE ── */}
            <table className="w-full border border-black border-collapse text-[10px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "7%"  }} />
                <col style={{ width: "33%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-black bg-black/[0.05]">
                  <th className="text-left  px-1.5 py-1 font-bold border-r border-black/40">Sn.</th>
                  <th className="text-left  px-1.5 py-1 font-bold border-r border-black/40">Item</th>
                  <th className="text-right px-1.5 py-1 font-bold border-r border-black/40">Qty</th>
                  <th className="text-right px-1.5 py-1 font-bold border-r border-black/40">MRP</th>
                  <th className="text-right px-1.5 py-1 font-bold border-r border-black/40">Rate</th>
                  <th className="text-right px-1.5 py-1 font-bold">Amt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const mrp           = item.mrp ?? item.price;
                  const hasAnySaving  = mrp > item.price + 0.001;
                  const totalSavedPct = hasAnySaving ? Math.round(((mrp - item.price) / mrp) * 100) : 0;
                  const lineSavings   = hasAnySaving ? (mrp - item.price) * item.quantity : 0;

                  /* Break the savings into "Sale" (auto MRP→preDiscountPrice)
                     and "Extra" (cashier-applied preDiscountPrice→price). */
                  const preDisc       = item.preDiscountPrice ?? null;
                  const hasExtra      = preDisc != null && preDisc > item.price + 0.001;
                  const saleFrom      = preDisc != null ? preDisc : mrp;
                  const hasSale       = mrp > saleFrom + 0.001;
                  const salePct       = hasSale  ? Math.round(((mrp - saleFrom) / mrp) * 100) : 0;
                  const extraDisplay  = hasExtra
                    ? (item.discountType === "amount"
                        ? `-₹${(item.discountValue ?? (preDisc - item.price)).toFixed(2)}`
                        : `${item.discountValue ?? Math.round(((preDisc - item.price) / preDisc) * 100)}% extra`)
                    : "";

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-1.5 py-1 tabular-nums border-r border-black/15">{idx + 1}.</td>
                      <td className="px-1.5 py-1 break-words leading-tight border-r border-black/15">
                        {item.productName}
                        {hasAnySaving && (
                          <div className="text-[9px] font-bold mt-0.5 leading-tight flex flex-wrap items-center gap-1">
                            {hasSale && (
                              <span className="bg-black text-white px-1 py-px rounded-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as any}>
                                {salePct}% SALE
                              </span>
                            )}
                            {hasExtra && (
                              <span className="bg-amber-600 text-white px-1 py-px rounded-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", backgroundColor: "#b45309" } as any}>
                                {extraDisplay}
                              </span>
                            )}
                            {!hasSale && !hasExtra && (
                              <span className="bg-black text-white px-1 py-px rounded-sm" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as any}>
                                {totalSavedPct}% OFF
                              </span>
                            )}
                            <span className="text-black/60">saved ₹{lineSavings.toFixed(2)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-1.5 py-1 text-right tabular-nums border-r border-black/15">{item.quantity}</td>
                      <td className="px-1.5 py-1 text-right tabular-nums border-r border-black/15 whitespace-nowrap">{mrp.toFixed(2)}</td>
                      <td className="px-1.5 py-1 text-right tabular-nums border-r border-black/15 whitespace-nowrap">{item.price.toFixed(2)}</td>
                      <td className="px-1.5 py-1 text-right tabular-nums font-bold whitespace-nowrap">{item.subtotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {/* Spacer rows for tiny bills */}
                {items.length < 3 && Array.from({ length: 3 - items.length }).map((_, i) => (
                  <tr key={`pad-${i}`}>
                    <td className="px-1.5 py-1 border-r border-black/15">&nbsp;</td>
                    <td className="border-r border-black/15"/>
                    <td className="border-r border-black/15"/>
                    <td className="border-r border-black/15"/>
                    <td className="border-r border-black/15"/>
                    <td/>
                  </tr>
                ))}
                <tr className="border-t border-black bg-black/[0.05]">
                  <td colSpan={3} className="px-1.5 py-1 font-bold border-r border-black/40">
                    Items&nbsp;:&nbsp;{items.length}&nbsp;·&nbsp;Qty&nbsp;:&nbsp;{totalQty}
                  </td>
                  <td colSpan={2} className="px-1.5 py-1 text-right font-bold border-r border-black/40">TOTAL</td>
                  <td className="px-1.5 py-1 text-right font-black tabular-nums whitespace-nowrap">{fmt(itemsSubtotal)}</td>
                </tr>
              </tbody>
            </table>

            {/* ── AMOUNT IN WORDS ── */}
            <div className="text-[10.5px] italic mt-1 mb-1.5 leading-tight">
              <span className="font-bold not-italic">Rs. </span>
              {numberToIndianWords(bill.totalAmount)}
            </div>

            {/* ── GRAND TOTAL bar ── */}
            <div className="receipt-grand-total bg-black text-white px-3 py-2 flex items-baseline justify-between mt-1"
                 style={{ backgroundColor: "#000", color: "#fff" }}>
              <span className="font-black tracking-[0.15em] text-[13px]">GRAND&nbsp;TOTAL</span>
              <span className="font-black text-[18px] tabular-nums leading-none">₹{fmt(bill.totalAmount)}</span>
            </div>

            {/* ── SAVINGS / NET BOX (double border) ──
                The MRP / Sub Total / You Saved breakdown is rendered only
                when the customer actually saved money (sale price or manual
                discount). For a plain bill at MRP we skip the redundant
                "−₹0.00" line and let NET TOTAL speak for itself. */}
            <div className="mt-2.5 border border-black p-[2px]">
              <div className="border border-black px-2.5 py-2 text-[10.5px]">
                {totalSavings > 0.001 && (
                  <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 leading-tight">
                    <span className="text-black/80">MRP Total</span>
                    <span className="text-right tabular-nums">₹{fmt(mrpTotal)}</span>
                    <span className="text-black/80">Sub Total</span>
                    <span className="text-right tabular-nums">₹{fmt(itemsSubtotal)}</span>
                    {manualDiscount > 0.001 && (
                      <>
                        <span className="text-black/80">
                          Bill Discount
                          {bill.discount != null && bill.discountType === "percent"
                            ? ` (${bill.discount}%)`
                            : ""}
                        </span>
                        <span className="text-right tabular-nums text-green-700">−₹{fmt(manualDiscount)}</span>
                      </>
                    )}
                    <span className="text-black font-bold">You Saved (Total)</span>
                    <span className="text-right tabular-nums font-bold text-green-700">−₹{fmt(totalSavings)}</span>
                  </div>
                )}

                <div className={`grid grid-cols-[1fr_auto] gap-x-2 leading-tight text-[12px] font-black ${totalSavings > 0.001 ? "border-t border-dashed border-black/60 mt-1.5 pt-1.5" : ""}`}>
                  <span>NET TOTAL</span>
                  <span className="text-right tabular-nums">₹{fmt(bill.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* ── PAYMENT META ── */}
            <div className="mt-2.5 flex justify-between items-center text-[10.5px]">
              <span>Payment&nbsp;: <span className="font-bold">{(bill.paymentMode ?? "cash").toUpperCase()}</span></span>
              <span className="inline-flex items-center gap-1 font-bold border border-black px-2 py-0.5 rounded-sm">
                ✓ PAID
              </span>
            </div>

            {/* ── TERMS & CONDITIONS ── */}
            {store.termsAndConditions && store.termsAndConditions.length > 0 && (
              <div className="mt-2 text-[9.5px] leading-tight">
                <div className="font-bold underline mb-0.5">Terms &amp; Conditions :-</div>
                <ol className="list-decimal pl-4 space-y-px">
                  {store.termsAndConditions.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div className="text-center text-[10px] mt-3 pt-2 border-t border-dashed border-black/40">
              <div className="font-black tracking-[0.18em] mb-0.5">— THANK YOU · VISIT AGAIN —</div>
              <div className="text-[9px] text-black/60">Powered by {store.appSubtitle}</div>
              <div className="font-mono text-[8px] text-black/40 mt-0.5">Ref: {bill.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>
        );
        })()}

        {/* ── Action buttons (screen only) ── */}
        <div className="no-print flex flex-col gap-3 px-4 pb-8 max-w-sm mx-auto w-full">
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 h-12 flex items-center justify-center gap-2 bg-black text-white font-bold rounded-2xl hover:bg-neutral-800 active:scale-95 transition-all text-sm"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <Link href="/scan" className="flex-1">
              <button className="w-full h-12 flex items-center justify-center gap-2 border-2 border-black text-black font-bold rounded-2xl hover:bg-gray-50 active:scale-95 transition-all text-sm dark:border-white dark:text-white dark:hover:bg-neutral-800">
                <ScanLine className="w-4 h-4" />
                New Sale
              </button>
            </Link>
          </div>
          <button
            onClick={handleShare}
            className="w-full h-10 flex items-center justify-center gap-2 border border-green-400 text-green-700 dark:text-green-400 font-bold rounded-2xl hover:bg-green-50 dark:hover:bg-green-950/20 active:scale-95 transition-all text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share Receipt
          </button>
          <button
            onClick={() => setShowReturn(true)}
            className="w-full h-10 flex items-center justify-center gap-2 border border-orange-400 text-orange-600 font-bold rounded-2xl hover:bg-orange-50 dark:hover:bg-orange-950/20 active:scale-95 transition-all text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Process Return / Refund
          </button>
        </div>

      </div>
    </>
  );
}
