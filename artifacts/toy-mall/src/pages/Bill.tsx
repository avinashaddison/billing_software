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
}

interface BillData {
  bill: {
    id: string;
    billNumber?: number;
    totalAmount: number;
    itemsCount: number;
    createdAt: string;
    paymentMode?: string;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qtys, setQtys]         = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity]))
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
        const item = items.find((i) => i.id === saleItemId)!;
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
          {items.map((item) => {
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
      <style>{`
        @page {
          size: ${store.receiptPaperWidth ?? "80mm"} auto;
          margin: 2mm;
        }

        @media print {
          body * { visibility: hidden !important; }

          .receipt-print-only,
          .receipt-print-only * { visibility: visible !important; }

          .receipt-print-only {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: ${store.receiptPaperWidth ?? "80mm"} !important;
            max-width: ${store.receiptPaperWidth ?? "80mm"} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            z-index: 99999 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Hide screen-only chrome inside the receipt */
          .receipt-print-only .no-print { display: none !important; }

          /* Force black-fill GRAND TOTAL bar to render solid in browser print */
          .receipt-print-only .receipt-grand-total {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

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
              /* Custom logo + name on the right */
              <div className="flex items-center gap-3">
                <img src={store.logoUrl} alt={store.name}
                     className="shrink-0 h-14 w-auto max-w-[80px] object-contain"
                     style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as any} />
                <div className="flex-1 text-center pr-1">
                  <div className="font-black uppercase leading-[1.05]"
                       style={{
                         fontSize: store.name.length > 18 ? "15px" : "18px",
                         letterSpacing: "0.02em",
                         textWrap: "balance",
                       } as any}>
                    {store.name}
                  </div>
                  {store.tagline && (
                    <div className="text-[10.5px] italic mt-1 text-black/70">{store.tagline}</div>
                  )}
                </div>
              </div>
            ) : (
              /* Clean centered header — no illustration */
              <div className="text-center">
                <div className="font-black uppercase leading-[1.05] mx-auto"
                     style={{
                       fontSize: store.name.length > 22 ? "16px" : "20px",
                       letterSpacing: "0.04em",
                       textWrap: "balance",
                     } as any}>
                  {store.name}
                </div>
                {store.tagline && (
                  <div className="text-[11px] italic mt-1 text-black/70">{store.tagline}</div>
                )}
              </div>
            )}

            <div className="text-center text-[10.5px] leading-tight mt-2.5 space-y-px">
              <div>{store.address}</div>
              <div>Phone : <span className="font-semibold">{store.phone}</span></div>
              {store.email && <div>E-Mail : {store.email}</div>}
              {store.gst && <div>GSTIN : <span className="font-semibold">{store.gst}</span></div>}
            </div>

            <div className="text-center font-black text-[13px] tracking-[0.2em] mt-2.5 mb-1.5 border-y border-black py-0.5">GST INVOICE</div>

            {/* ── CUSTOMER + BILL META ── */}
            <div className="border border-black grid grid-cols-2 text-[10.5px] leading-[1.55]">
              <div className="p-1.5 border-r border-black space-y-0.5 flex flex-col justify-center">
                <div className="flex">
                  <span className="w-[58px] shrink-0">Mobile</span>
                  <span>:&nbsp;</span>
                  <span className="flex-1 border-b border-dotted border-black/40 font-semibold">
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

            {/* ── SAVINGS / NET BOX (double border) ── */}
            <div className="mt-2.5 border border-black p-[2px]">
              <div className="border border-black px-2.5 py-2 text-[10.5px]">
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
                <div className="border-t border-dashed border-black/60 mt-1.5 pt-1.5 grid grid-cols-[1fr_auto] gap-x-2 leading-tight text-[12px] font-black">
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
