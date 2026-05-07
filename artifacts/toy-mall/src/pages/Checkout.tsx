import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useLocation } from "wouter";
import {
  ShoppingCart, Receipt, Loader2, X, CheckCircle2,
  Phone, Wallet, Banknote, Smartphone, Minus, Plus,
  Trash2, ScanLine, WifiOff, RefreshCw, QrCode, BadgeCheck, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { playCheckoutSuccess, playError, playTick } from "@/lib/sounds";
import { useCart } from "@/contexts/cart-context";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useOnline } from "@/hooks/use-online";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PaymentMode = "cash" | "upi";

async function postCheckout(payload: {
  items: { productId: string; quantity: number; price: number; mrp?: number }[];
  paymentMode: PaymentMode;
  customerPhone?: string;
  discount?: number;
  discountType?: "percent" | "amount";
}) {
  const res = await fetch(`${BASE_URL}/api/bills/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  return data;
}

/* ── Animated running total ─────────────────────────────────────── */
function AnimatedTotal({ value }: { value: number }) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [value]);
  return (
    <span
      className={`font-black tabular-nums transition-all duration-300 ${
        pulse
          ? "text-4xl text-green-600 dark:text-green-400 scale-110"
          : "text-3xl text-foreground scale-100"
      }`}
      style={{ display: "inline-block", transformOrigin: "left center" }}
    >
      ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

/* ── Sale complete overlay ──────────────────────────────────────── */
function SuccessOverlay({ billId }: { billId: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const t = setTimeout(() => setLocation(`/bill/${billId}`), 1600);
    return () => clearTimeout(t);
  }, [billId, setLocation]);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-40 h-40 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: "1s" }} />
        <div className="absolute w-28 h-28 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: "0.8s", animationDelay: "0.1s" }} />
        <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-2xl shadow-green-500/30 animate-in zoom-in duration-300">
          <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
        </div>
      </div>
      <p className="mt-8 text-2xl font-black text-foreground tracking-wide animate-in slide-in-from-bottom-4 duration-400 delay-200">
        Sale Complete!
      </p>
      <p className="mt-2 text-sm text-muted-foreground animate-in slide-in-from-bottom-4 duration-400 delay-300">
        Opening receipt…
      </p>
    </div>
  );
}

/* ── Memoized cart item row ─────────────────────────────────────── */
interface CartItemRowProps {
  item: { productId: string; name: string; sku: string; price: number; mrp?: number; quantity: number };
  onQtyChange: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}
const CartItemRow = memo(function CartItemRow({ item, onQtyChange, onRemove }: CartItemRowProps) {
  const onSale = item.mrp != null && item.mrp > item.price;
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border bg-card transition-all ${onSale ? "border-red-200 dark:border-red-800" : "border-border"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate text-foreground">{item.name}</p>
          {onSale && (
            <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 leading-none">
              SALE
            </span>
          )}
        </div>
        <p className="text-xs font-mono text-muted-foreground">{item.sku}</p>
        {onSale ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="line-through">MRP ₹{item.mrp!.toLocaleString("en-IN")}</span>
            {" → "}
            <span className="text-red-600 dark:text-red-400 font-bold">₹{item.price.toLocaleString("en-IN")}</span>
            {" × "}{item.quantity} ={" "}
            <span className="font-bold text-foreground">
              ₹{(item.price * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            ₹{item.price.toLocaleString("en-IN")} × {item.quantity} ={" "}
            <span className="font-bold text-foreground">
              ₹{(item.price * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onQtyChange(item.productId, item.quantity - 1)}
          className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 active:scale-90 flex items-center justify-center transition-all border"
        >
          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <span className="w-7 text-center font-black text-sm tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onQtyChange(item.productId, item.quantity + 1)}
          className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 active:scale-90 flex items-center justify-center transition-all border"
        >
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <button
        onClick={() => onRemove(item.productId)}
        className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-90 flex items-center justify-center transition-all shrink-0 border border-red-200 dark:border-red-800"
      >
        <X className="w-3.5 h-3.5 text-red-500" />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   Ongoing Checkout page
═══════════════════════════════════════════════════════════════════ */
export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, count, total, removeItem, updateQty, clearCart } = useCart();

  const totalSavings = items.reduce((sum, i) => {
    if (i.mrp != null && i.mrp > i.price) {
      return sum + (i.mrp - i.price) * i.quantity;
    }
    return sum;
  }, 0);
  const isOnline = useOnline();
  const { pendingCount, enqueue, syncAll } = useOfflineQueue();
  const { upiId, dynamicQrMode } = useStoreSettings();

  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const paymentModeRef = useRef<PaymentMode>("cash");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successBillId, setSuccessBillId] = useState<string | null>(null);

  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType]   = useState<"percent" | "amount">("percent");

  const discountNum    = parseFloat(discountValue) || 0;
  const discountAmount = discountNum > 0
    ? discountType === "percent"
      ? Math.min(total * discountNum / 100, total)
      : Math.min(discountNum, total)
    : 0;
  const finalTotal = Math.max(0, total - discountAmount);

  const qrActive = dynamicQrMode && !!upiId && paymentMode === "upi";

  const upiUrl = qrActive
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&am=${finalTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Toy Mall Sale")}`
    : "";

  const validatePhone = (v: string) =>
    !v || /^\d{10}$/.test(v) ? "" : "Enter a valid 10-digit number";

  const selectPaymentMode = (pm: PaymentMode) => {
    paymentModeRef.current = pm;
    setPaymentMode(pm);
  };

  const handleQtyChange = useCallback(
    (productId: string, qty: number) => {
      playTick();
      updateQty(productId, qty);
    },
    [updateQty],
  );

  const handleCheckout = async () => {
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    if (!items.length) return;

    if (!isOnline) {
      enqueue({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price, mrp: i.mrp })),
        paymentMode: paymentModeRef.current,
        customerPhone: phone || undefined,
        total,
        itemsCount: count,
      });
      playCheckoutSuccess();
      clearCart();
      return;
    }

    setLoading(true);
    try {
      const result = await postCheckout({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price, mrp: i.mrp })),
        paymentMode: paymentModeRef.current,
        customerPhone: phone || undefined,
        discount:     discountNum > 0 ? discountNum : undefined,
        discountType: discountNum > 0 ? discountType : undefined,
      });
      playCheckoutSuccess();
      clearCart();
      setSuccessBillId(result.bill.id);
    } catch (err: unknown) {
      playError();
      toast.error((err as Error).message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const hasItems = items.length > 0;

  return (
    <div className="relative flex flex-col h-full bg-background text-foreground">
      {successBillId && <SuccessOverlay billId={successBillId} />}

      {/* ── Offline / pending sync banner ── */}
      {(!isOnline || pendingCount > 0) && (
        <div
          className={`flex items-center justify-between gap-2 px-4 py-1.5 text-xs font-bold ${
            !isOnline ? "bg-red-600 text-white" : "bg-amber-500 text-white"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3" />
            {!isOnline
              ? "Offline — bills will be saved and synced when reconnected"
              : `${pendingCount} bill${pendingCount !== 1 ? "s" : ""} pending sync`}
          </div>
          {isOnline && pendingCount > 0 && (
            <button onClick={syncAll} className="flex items-center gap-1 underline underline-offset-2">
              <RefreshCw className="w-3 h-3" /> Sync now
            </button>
          )}
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/40">
            <ShoppingCart className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-black leading-none">Ongoing</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hasItems
                ? `${count} item${count !== 1 ? "s" : ""} · review and complete the sale`
                : "No items in cart yet"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/scan")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs transition-all active:scale-95"
        >
          <ScanLine className="w-3.5 h-3.5" />
          Scan More
        </button>
      </div>

      {/* ── Empty state ── */}
      {!hasItems && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 opacity-30" />
          </div>
          <div>
            <p className="font-black text-lg text-foreground">Cart is empty</p>
            <p className="text-sm mt-1 leading-relaxed">
              No items added yet. Go to the Scan page, scan products, and they'll appear here.
            </p>
          </div>
          <button
            onClick={() => setLocation("/scan")}
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg active:scale-95 transition-all"
          >
            <ScanLine className="w-4 h-4" />
            Start Scanning
          </button>
        </div>
      )}

      {/* ── Cart + payment (when items exist) ── */}
      {hasItems && (
        <>
          <div className="flex-1 overflow-y-auto">
            {/* Cart items */}
            <div className="px-4 pt-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Cart · {count} item{count !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
              </div>
              {items.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  onQtyChange={handleQtyChange}
                  onRemove={removeItem}
                />
              ))}
            </div>

            {/* Grand total card */}
            <div className="px-4 pt-4">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Grand Total</p>
                  <AnimatedTotal value={finalTotal} />
                  {discountAmount > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-through">
                      ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {items.length} product{items.length !== 1 ? "s" : ""} · {count} unit{count !== 1 ? "s" : ""}
                  </p>
                  {(totalSavings > 0 || discountAmount > 0) && (
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-0.5">
                      You save ₹{(totalSavings + discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 🎉
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Discount */}
            <div className="px-4 pt-3">
              <div className="bg-card border rounded-2xl px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Discount
                  <span className="normal-case font-medium text-muted-foreground/60">(optional)</span>
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      className={`px-3 py-1.5 text-xs font-black transition-colors ${discountType === "percent" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("amount")}
                      className={`px-3 py-1.5 text-xs font-black transition-colors ${discountType === "amount" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      ₹
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={discountType === "percent" ? 100 : total}
                    step="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50"}
                    className="flex-1 h-9 px-3 rounded-xl bg-muted border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                  {discountAmount > 0 && (
                    <span className="text-sm font-black text-green-600 dark:text-green-400 shrink-0 tabular-nums">
                      −₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Payment mode */}
            <div className="px-4 pt-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Payment Mode
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      value: "cash" as PaymentMode,
                      label: "Cash",
                      Icon: Banknote,
                      activeClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600",
                      iconClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
                      textClass: "text-amber-700 dark:text-amber-300",
                    },
                    {
                      value: "upi" as PaymentMode,
                      label: "UPI",
                      Icon: Smartphone,
                      activeClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600",
                      iconClass: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
                      textClass: "text-blue-700 dark:text-blue-300",
                    },
                  ] as const
                ).map(({ value, label, Icon, activeClass, iconClass, textClass }) => {
                  const active = paymentMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectPaymentMode(value)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-95 ${
                        active ? activeClass : "border-border bg-muted/40 hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          active ? iconClass : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className={`font-black text-sm ${active ? textClass : "text-muted-foreground"}`}>
                          {label}
                        </p>
                        {active && (
                          <p className={`text-[10px] font-bold ${textClass}`}>Selected ✓</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Dynamic UPI QR panel — auto-shows when UPI selected ── */}
            {qrActive && (
              <div className="px-4 pt-4">
                <div className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-black text-sm text-indigo-700 dark:text-indigo-300">Scan &amp; Pay via UPI</span>
                  </div>
                  <div className="flex flex-col items-center gap-3 py-5 px-4">
                    <div className="bg-white p-3 rounded-2xl shadow-md">
                      <QRCodeSVG
                        value={upiUrl}
                        size={210}
                        level="M"
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-black text-indigo-700 dark:text-indigo-300">
                        ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{upiId}</p>
                    </div>
                    <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                      Ask customer to scan with any UPI app.<br />
                      After they pay, tap <b>Payment Received</b> below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Customer phone */}
            <div className="px-4 pt-4 pb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Customer Mobile
                <span className="normal-case font-medium text-muted-foreground/60">(optional)</span>
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(v);
                    setPhoneError(v ? validatePhone(v) : "");
                  }}
                  placeholder="98765 43210"
                  className={`w-full h-12 pl-12 pr-4 rounded-xl bg-muted border text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all ${
                    phoneError
                      ? "border-red-500 focus:ring-red-500/30"
                      : "border-border focus:ring-primary/40 focus:border-primary"
                  }`}
                />
              </div>
              {phoneError && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{phoneError}</p>
              )}
            </div>
          </div>

          {/* ── Sticky checkout button ── */}
          <div className="shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 bg-card">
            <button
              onClick={handleCheckout}
              disabled={loading || (!!phone && !!validatePhone(phone))}
              className={`w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 ${
                qrActive
                  ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                  : "bg-green-600 hover:bg-green-500 shadow-green-500/20"
              }`}
              data-testid="btn-complete-sale"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing…
                </>
              ) : qrActive ? (
                <>
                  <BadgeCheck className="w-5 h-5" />
                  Payment Received · Complete Sale
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  Complete Sale · {count} item{count !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
