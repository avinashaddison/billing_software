import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ScanLine, Printer, RotateCcw, X, Minus, Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BillItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface BillData {
  bill: {
    id: string;
    totalAmount: number;
    itemsCount: number;
    createdAt: string;
    paymentMode?: string;
    customerPhone?: string | null;
  };
  items: BillItem[];
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ─── tiny helpers ───────────────────────────────────────────────── */
function pad(s: string, len: number, right = false) {
  const str = String(s);
  if (str.length >= len) return str.slice(0, len);
  const spaces = " ".repeat(len - str.length);
  return right ? spaces + str : str + spaces;
}

const LINE = "─".repeat(36);
const DASH = "- ".repeat(18).trimEnd();

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
  const billNo  = bill.id.slice(0, 8).toUpperCase();

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          /* 1. Hide EVERYTHING on the page — including sidebar, bottom nav, app shell */
          body * { visibility: hidden !important; }

          /* 2. Make ONLY the receipt card and its children visible */
          .receipt-print-only,
          .receipt-print-only * { visibility: visible !important; }

          /* 3. Pin the receipt to the top-left so it fills the print page cleanly */
          .receipt-print-only {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            z-index: 99999 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* 4. Strip zigzag SVG decorations — they add blank space when printed */
          .receipt-print-only svg { display: none !important; }
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
        <div className="receipt-print-only receipt-card mx-auto my-6 w-full max-w-sm bg-white shadow-2xl rounded-sm overflow-hidden"
             style={{ fontFamily: "'Courier New', Courier, monospace" }}>

          {/* Zigzag top edge */}
          <div className="no-print w-full overflow-hidden leading-none" style={{ marginBottom: "-1px" }}>
            <svg viewBox="0 0 300 12" preserveAspectRatio="none" className="w-full" height="12">
              <path d="M0,0 L10,12 L20,0 L30,12 L40,0 L50,12 L60,0 L70,12 L80,0 L90,12 L100,0 L110,12 L120,0 L130,12 L140,0 L150,12 L160,0 L170,12 L180,0 L190,12 L200,0 L210,12 L220,0 L230,12 L240,0 L250,12 L260,0 L270,12 L280,0 L290,12 L300,0 L300,0 L0,0 Z"
                    fill="#f3f4f6"/>
            </svg>
          </div>

          <div className="px-5 py-4 text-black text-[13px] leading-relaxed">

            {/* ── STORE HEADER ── */}
            <div className="text-center mb-2">
              <div className="text-xl font-black tracking-widest uppercase">ToyMall</div>
              <div className="text-[11px] tracking-wide mt-0.5">The Complete Toy Store</div>
              <div className="text-[11px] mt-0.5">📞 +91 98765 43210</div>
              <div className="text-[11px]">123, Mall Road, New Delhi - 110001</div>
            </div>

            <div className="text-center text-[11px] my-2 tracking-widest">{LINE}</div>

            {/* ── BILL INFO ── */}
            <div className="text-[12px] space-y-0.5">
              <div className="flex justify-between">
                <span>Bill No :</span>
                <span className="font-bold">#{billNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date    :</span>
                <span>{dateStr}</span>
              </div>
              <div className="flex justify-between">
                <span>Time    :</span>
                <span>{timeStr}</span>
              </div>
            </div>

            <div className="text-center text-[11px] my-2 tracking-widest">{LINE}</div>

            {/* ── ITEMS HEADER ── */}
            <div className="text-[11px] font-bold flex justify-between mb-1">
              <span className="flex-1">ITEM</span>
              <span className="w-8 text-center">QTY</span>
              <span className="w-20 text-right">AMOUNT</span>
            </div>
            <div className="text-[11px] text-gray-400">{DASH}</div>

            {/* ── ITEMS ── */}
            <div className="space-y-2 my-2">
              {items.map((item, i) => {
                const name    = item.productName.length > 22
                  ? item.productName.slice(0, 20) + ".."
                  : item.productName;
                const subtotal = `Rs.${item.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const rate     = `@ Rs.${item.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })} each`;

                return (
                  <div key={item.id}>
                    <div className="flex justify-between items-start text-[12px]">
                      <span className="flex-1 font-semibold">{name}</span>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <span className="w-20 text-right font-bold">{subtotal}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 pl-0">{rate}</div>
                    {i < items.length - 1 && (
                      <div className="text-[10px] text-gray-200 mt-1">{"· ".repeat(18).trimEnd()}</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-gray-400">{DASH}</div>

            {/* ── SUMMARY ── */}
            <div className="text-[12px] space-y-0.5 my-2">
              <div className="flex justify-between">
                <span>Total Items :</span>
                <span>{bill.itemsCount}</span>
              </div>
              <div className="flex justify-between font-bold text-[13px]">
                <span>Sub Total   :</span>
                <span>Rs.{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>Tax (GST)   :</span>
                <span>Incl.</span>
              </div>
            </div>

            <div className="text-center text-[11px] my-2 tracking-widest">{LINE}</div>

            {/* ── GRAND TOTAL ── */}
            <div className="flex justify-between items-center my-2">
              <span className="text-base font-black tracking-wide">TOTAL</span>
              <span className="text-xl font-black">
                Rs.{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* ── PAYMENT ── */}
            {bill.customerPhone && (
              <div className="text-[11px] flex justify-between text-gray-600">
                <span>Customer Ph :</span>
                <span className="font-bold">+91 {bill.customerPhone}</span>
              </div>
            )}
            <div className="text-[11px] flex justify-between text-gray-600">
              <span>Payment Mode :</span>
              <span className="font-bold">{(bill.paymentMode ?? "cash").toUpperCase()}</span>
            </div>
            <div className="text-[11px] flex justify-between text-gray-600 mb-2">
              <span>Status       :</span>
              <span className="font-black">✓ PAID</span>
            </div>

            <div className="text-center text-[11px] my-2 tracking-widest">{LINE}</div>

            {/* ── FOOTER ── */}
            <div className="text-center text-[11px] space-y-1 mt-2">
              <div className="font-black text-sm tracking-wide">** THANK YOU! **</div>
              <div>Please Visit Again!</div>
              <div className="text-gray-500 text-[10px] mt-1">
                Goods once sold will not be<br />returned or exchanged.
              </div>
              <div className="text-gray-400 text-[10px] mt-2">
                — Powered by ToyMall POS —
              </div>
              <div className="font-mono text-[10px] text-gray-400 mt-1">
                #{bill.id.slice(0, 16).toUpperCase()}
              </div>
            </div>

            <div className="text-center text-[11px] mt-3 tracking-widest">{LINE}</div>
          </div>

          {/* Zigzag bottom edge */}
          <div className="no-print w-full overflow-hidden leading-none" style={{ marginTop: "-1px" }}>
            <svg viewBox="0 0 300 12" preserveAspectRatio="none" className="w-full" height="12">
              <path d="M0,12 L10,0 L20,12 L30,0 L40,12 L50,0 L60,12 L70,0 L80,12 L90,0 L100,12 L110,0 L120,12 L130,0 L140,12 L150,0 L160,12 L170,0 L180,12 L190,0 L200,12 L210,0 L220,12 L230,0 L240,12 L250,0 L260,12 L270,0 L280,12 L290,0 L300,12 L300,12 L0,12 Z"
                    fill="#f3f4f6"/>
            </svg>
          </div>
        </div>

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
