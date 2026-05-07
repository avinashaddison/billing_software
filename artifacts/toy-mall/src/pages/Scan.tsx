import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useLocation } from "wouter";
import { useUsbScanner } from "@/hooks/use-usb-scanner";
import { useScanFlash, ScanFlash, useLowStockFlash, LowStockFlash } from "@/components/ui/ScanFlash";
import {
  ScanLine, ArrowRight, Trash2, Plus, Minus,
  ShoppingCart, Receipt, Loader2, X, CheckCircle2,
  Phone, Wallet, Banknote, Smartphone,
  PackagePlus, ShoppingBag, ArrowUpCircle, RotateCcw, Camera, CameraOff,
  Volume2, VolumeX, QrCode, BadgeCheck, Usb,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { playScanBeep, playCameraDetect, playError, playCheckoutSuccess, playTick, playStockIn, isSoundMuted, toggleSoundMute } from "@/lib/sounds";
import { useCart } from "@/contexts/cart-context";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useOnline }       from "@/hooks/use-online";
import { WifiOff, RefreshCw } from "lucide-react";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PageMode    = "billing" | "stockin";
type PaymentMode = "cash" | "upi";

interface ScannedProduct {
  id: string; name: string; sku: string; price: number; salePrice?: number | null; stock: number; lowStockThreshold: number;
}

/* ── API helpers ─────────────────────────────────────────────────── */
async function lookupBySku(sku: string): Promise<ScannedProduct> {
  const res = await fetch(`${BASE_URL}/api/products/scan/${encodeURIComponent(sku)}`);
  if (!res.ok) throw new Error("Product not found");
  return res.json();
}

async function postCheckout(payload: {
  items: { productId: string; quantity: number; price: number }[];
  paymentMode: PaymentMode;
  customerPhone?: string;
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

async function postStockIn(productId: string, quantity: number) {
  const res = await fetch(`${BASE_URL}/api/products/${productId}/stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "IN", quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Stock update failed");
  return data;
}

/* ── Animated total ─────────────────────────────────────────────── */
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
        pulse ? "text-4xl text-green-600 dark:text-green-400 scale-110" : "text-3xl text-foreground scale-100"
      }`}
      style={{ display: "inline-block", transformOrigin: "left center" }}
    >
      ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

/* ── Checkout success overlay ───────────────────────────────────── */
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
      <p className="mt-8 text-2xl font-black text-foreground tracking-wide animate-in slide-in-from-bottom-4 duration-400 delay-200">Sale Complete!</p>
      <p className="mt-2 text-sm text-muted-foreground animate-in slide-in-from-bottom-4 duration-400 delay-300">Opening receipt…</p>
    </div>
  );
}

/* ── Checkout modal ─────────────────────────────────────────────── */
interface CheckoutModalProps {
  total: number; count: number;
  onCancel: () => void;
  onConfirm: (pm: PaymentMode, phone: string) => void;
  loading: boolean;
}
function CheckoutModal({ total, count, onCancel, onConfirm, loading }: CheckoutModalProps) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  /* Ref mirrors state so handleSubmit always reads the *latest* value
     even when the UPI button and Confirm are tapped almost simultaneously
     (React 18 batches those events; the closure would capture the old state) */
  const paymentModeRef = useRef<PaymentMode>("cash");

  const [phone, setPhone]             = useState("");
  const [phoneError, setPhoneError]   = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => { phoneRef.current?.focus(); }, []);

  const { upiId, dynamicQrMode } = useStoreSettings();
  const qrActive = dynamicQrMode && !!upiId && paymentMode === "upi";
  const upiUrl   = qrActive
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Toy Mall Sale")}`
    : "";

  const validatePhone = (v: string) => (!v || /^\d{10}$/.test(v)) ? "" : "Enter a valid 10-digit number";

  const selectPaymentMode = (pm: PaymentMode) => {
    paymentModeRef.current = pm;   // synchronous — safe to read immediately
    setPaymentMode(pm);            // triggers visual re-render
  };

  const handleSubmit = () => {
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    onConfirm(paymentModeRef.current, phone);  // use ref, not state
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full md:max-w-sm bg-card rounded-t-3xl md:rounded-3xl border shadow-2xl animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-250 overflow-hidden">
        {/* Drag handle (mobile) */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground">Confirm Checkout</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{count} item{count !== 1 ? "s" : ""} in cart</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Grand total */}
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Grand Total</p>
              <p className="text-3xl font-black text-green-700 dark:text-green-400 tabular-nums">
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Payment Mode
            </p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "cash", label: "Cash",  Icon: Banknote,   activeClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600", iconClass: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400", textClass: "text-amber-700 dark:text-amber-300" },
                { value: "upi",  label: "UPI",   Icon: Smartphone, activeClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600",   iconClass: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",   textClass: "text-blue-700 dark:text-blue-300" },
              ] as const).map(({ value, label, Icon, activeClass, iconClass, textClass }) => {
                const active = paymentMode === value;
                return (
                  <button key={value} type="button" onClick={() => selectPaymentMode(value)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-95 ${active ? activeClass : "border-border bg-muted/40 hover:bg-muted"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? iconClass : "bg-muted text-muted-foreground"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className={`font-black text-sm ${active ? textClass : "text-muted-foreground"}`}>{label}</p>
                      {active && <p className={`text-[10px] font-bold ${textClass}`}>Selected ✓</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Dynamic UPI QR — auto-shows when UPI selected ── */}
          {qrActive && (
            <div className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-black text-xs text-indigo-700 dark:text-indigo-300">Scan &amp; Pay via UPI</span>
              </div>
              <div className="flex flex-col items-center gap-2 py-4 px-3">
                <div className="bg-white p-2.5 rounded-xl shadow-md">
                  <QRCodeSVG value={upiUrl} size={180} level="M" fgColor="#000000" bgColor="#ffffff" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                    ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{upiId}</p>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  After customer pays, tap <b>Payment Received</b>.
                </p>
              </div>
            </div>
          )}

          {/* Customer phone */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Customer Mobile
              <span className="normal-case text-muted-foreground/60 font-medium">(optional)</span>
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">+91</span>
              <input ref={phoneRef} type="tel" maxLength={10} inputMode="numeric" value={phone}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setPhone(v); setPhoneError(v ? validatePhone(v) : ""); }}
                placeholder="98765 43210"
                className={`w-full h-12 pl-12 pr-4 rounded-xl bg-muted border text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all ${phoneError ? "border-red-500 focus:ring-red-500/30" : "border-border focus:ring-primary/40 focus:border-primary"}`}
              />
            </div>
            {phoneError && <p className="text-xs text-red-500 mt-1.5 font-medium">{phoneError}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="py-3.5 rounded-2xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted active:scale-95 transition-all disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading || !!validatePhone(phone)}
            className={`py-3.5 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50 ${qrActive ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20" : "bg-green-600 hover:bg-green-500 shadow-green-500/20"}`}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : qrActive
                ? <><BadgeCheck className="w-4 h-4" /> Payment Received</>
                : <><Receipt className="w-4 h-4" /> Confirm &amp; Print</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stock IN panel ──────────────────────────────────────────────── */
interface StockInPanelProps {
  product: ScannedProduct;
  onConfirm: (qty: number) => void;
  onDismiss: () => void;
  loading: boolean;
}
function StockInPanel({ product, onConfirm, onDismiss, loading }: StockInPanelProps) {
  const [qty, setQty] = useState(1);
  return (
    <div className="mx-4 rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 overflow-hidden animate-in slide-in-from-bottom-2 duration-250">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Product Scanned</span>
            </div>
            <p className="font-black text-base text-foreground leading-tight">{product.name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{product.sku}</p>
          </div>
          <button onClick={onDismiss} className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/50 flex items-center justify-center shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Current stock:</span>
          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
            product.stock <= 5 ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"
          }`}>
            {product.stock} units
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="text-xs font-black text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
            {product.stock + qty} units
          </span>
        </div>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Quantity to Add</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/50 active:scale-90 flex items-center justify-center transition-all text-blue-700 dark:text-blue-300">
            <Minus className="w-4 h-4" />
          </button>
          <input type="number" min={1} max={9999} value={qty}
            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setQty(v); }}
            className="flex-1 h-10 text-center font-black text-2xl bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 tabular-nums"
          />
          <button onClick={() => setQty((q) => Math.min(9999, q + 1))}
            className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/50 active:scale-90 flex items-center justify-center transition-all text-blue-700 dark:text-blue-300">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mt-2 flex-wrap">
          {[5, 10, 25, 50, 100].map((n) => (
            <button key={n} onClick={() => setQty(n)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${qty === n ? "bg-blue-600 text-white" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50"}`}>
              +{n}
            </button>
          ))}
        </div>

        <button onClick={() => onConfirm(qty)} disabled={loading}
          className="mt-3 w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</>
            : <><ArrowUpCircle className="w-4 h-4" /> Add {qty} to Stock</>
          }
        </button>
      </div>
    </div>
  );
}

/* ── Native camera scanner hook ──────────────────────────────────
   Uses getUserMedia for reliable video rendering, then BarcodeDetector
   (Chrome Android 83+, Safari 17+) for decoding. No external lib needed.
────────────────────────────────────────────────────────────────── */
const CAMERA_SCAN_COOLDOWN_MS = 1500;

function useScanner(
  active: boolean,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onScan: (sku: string) => void,
  onCameraError?: (msg: string) => void,
) {
  const detectingRef   = useRef(false);   // async re-entry guard for detector.detect()
  const lastSkuRef     = useRef("");       // last successfully dispatched SKU
  const lastScanTimeRef = useRef(0);      // timestamp of last dispatched scan
  const onScanRef      = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!active) return;

    let mounted = true;
    let stream: MediaStream | null = null;
    let rafId   = 0;

    const stopStream = () => {
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      const v = videoRef.current;
      if (v) { v.srcObject = null; }
    };

    async function startCamera() {
      /* ── 1. Request camera ── */
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = ((err as Error)?.message ?? String(err)).toLowerCase();
        if (msg.includes("permission") || msg.includes("denied") || msg.includes("notallowed")) {
          onCameraError?.("Camera permission denied. Please allow camera access and try again.");
        } else {
          onCameraError?.("Camera unavailable. Use manual SKU entry below.");
        }
        return;
      }

      if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

      /* ── 2. Attach stream to <video> ── */
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay blocked — still shows */ }

      if (!mounted) return;

      /* ── 3. Check BarcodeDetector support ── */
      type BD = { detect(src: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BDClass = (window as any).BarcodeDetector as (new (o: object) => BD) | undefined;
      if (!BDClass) {
        onCameraError?.("Barcode detection not supported on this browser. Please type SKU manually.");
        return;
      }

      const detector: BD = new BDClass({
        formats: ["qr_code", "code_128", "ean_13", "code_39", "ean_8", "upc_a", "upc_e"],
      });

      /* ── 4. Scan loop ~10 fps ── */
      const tick = async () => {
        if (!mounted) return;
        if (!detectingRef.current && video.readyState >= 2) {
          detectingRef.current = true;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              const raw = codes[0].rawValue;
              let sku = raw;
              try {
                if (raw.includes("product?sku=")) {
                  const u = new URL(raw.startsWith("http") ? raw : `http://x${raw}`);
                  sku = u.searchParams.get("sku") ?? raw;
                }
              } catch { /* use raw */ }
              sku = sku.toUpperCase();

              /* Per-SKU cooldown: ignore if the same code fires again within
                 CAMERA_SCAN_COOLDOWN_MS. A different SKU is always accepted. */
              const now = Date.now();
              const isSameSku       = sku === lastSkuRef.current;
              const isWithinCooldown = (now - lastScanTimeRef.current) < CAMERA_SCAN_COOLDOWN_MS;

              if (!isSameSku || !isWithinCooldown) {
                lastSkuRef.current      = sku;
                lastScanTimeRef.current = now;
                onScanRef.current(sku);
              }
            }
          } catch { /* per-frame errors — ignore */ }
          detectingRef.current = false;
        }
        rafId = window.setTimeout(() => { rafId = requestAnimationFrame(tick); }, 100);
      };
      rafId = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [active, videoRef]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ── Memoized cart item row — only re-renders when its own props change ── */
interface CartItemRowProps {
  item: { productId: string; name: string; sku: string; price: number; quantity: number };
  isNew: boolean;
  onQtyChange: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}
const CartItemRow = memo(function CartItemRow({ item, isNew, onQtyChange, onRemove }: CartItemRowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all duration-300 ${
        isNew
          ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 shadow-sm scale-[1.01]"
          : "bg-card border-border scale-100"
      }`}>
      <div className={`shrink-0 w-2 h-2 rounded-full transition-all duration-300 ${isNew ? "bg-green-500" : "bg-muted-foreground/20"}`} />
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm truncate ${isNew ? "text-green-700 dark:text-green-300" : "text-foreground"}`}>{item.name}</p>
        <p className="text-xs font-mono text-muted-foreground">{item.sku}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          ₹{item.price.toLocaleString("en-IN")} × {item.quantity} ={" "}
          <span className={`font-bold ${isNew ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
            ₹{(item.price * item.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onQtyChange(item.productId, item.quantity - 1)}
          className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 active:scale-90 flex items-center justify-center transition-all border">
          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <span className="w-7 text-center font-black text-sm tabular-nums">{item.quantity}</span>
        <button onClick={() => onQtyChange(item.productId, item.quantity + 1)}
          className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 active:scale-90 flex items-center justify-center transition-all border">
          <Plus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <button onClick={() => onRemove(item.productId)}
        className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-90 flex items-center justify-center transition-all shrink-0 border border-red-200 dark:border-red-800">
        <X className="w-3.5 h-3.5 text-red-500" />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════════ */
export default function Scan() {
  const [, setLocation] = useLocation();
  const { items, count, total, addItem, removeItem, updateQty, clearCart } = useCart();

  const isOnline = useOnline();
  const { pendingCount, enqueue, syncAll } = useOfflineQueue();

  /* ── Pre-load ALL products into memory for instant SKU lookup ── */
  const { data: allProducts } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 15 } }
  );
  const skuCache = useMemo<Map<string, ScannedProduct>>(() => {
    const map = new Map<string, ScannedProduct>();
    (allProducts ?? []).forEach((p) => {
      map.set(p.sku.toLowerCase(), {
        id: p.id, name: p.name, sku: p.sku,
        price: Number(p.price),
        salePrice: "salePrice" in p ? (p.salePrice as number | null | undefined) : null,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold ?? 5,
      });
    });
    return map;
  }, [allProducts]);

  const [muted, setMuted]             = useState(() => isSoundMuted());
  const [mode, setMode]               = useState<PageMode>("billing");
  const [manualSku, setManualSku]     = useState("");
  const [checking, setChecking]       = useState(false);
  const [lookupSku, setLookupSku]     = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [successBillId, setSuccessBillId] = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);

  const [stockProduct, setStockProduct]   = useState<ScannedProduct | null>(null);
  const [stockAdding, setStockAdding]     = useState(false);
  const [stockSuccess, setStockSuccess]   = useState<{ name: string; added: number; newStock: number } | null>(null);
  const [cameraError, setCameraError]     = useState<string | null>(null);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  /* Auto-focus the SKU input so the USB scanner can type into it directly */
  useEffect(() => { manualInputRef.current?.focus(); }, []);

  const isBilling = mode === "billing";
  const isStockIn = mode === "stockin";

  const { flash, triggerFlash } = useScanFlash();
  const { lowStockFlash, triggerLowStockFlash } = useLowStockFlash();

  /* Track whether the pending lookup came from camera or USB so the
     lookupSku effect can skip the duplicate playScanBeep for camera scans
     (camera scans play playCameraDetect immediately instead).              */
  const scanSourceRef = useRef<"camera" | "usb">("usb");

  const handleScan = useCallback((sku: string) => {
    triggerFlash(sku);
    setLookupSku(sku);
  }, [triggerFlash]);

  /* Camera path — plays an immediate distinct blip at decode time */
  const handleCameraScan = useCallback((sku: string) => {
    scanSourceRef.current = "camera";
    playCameraDetect();
    handleScan(sku);
  }, [handleScan]);

  const handleCameraError = useCallback((msg: string) => { setCameraError(msg); }, []);
  useScanner(showScanner, videoRef, handleCameraScan, handleCameraError);

  /* USB scanner: parse URL-format QR values the same way the camera does,
     then forward the clean SKU. The flash is triggered inside handleScan so
     both camera and USB scans show the same visual feedback.                */
  const handleUsbScan = useCallback((raw: string) => {
    let sku = raw;
    try {
      if (raw.includes("product?sku=")) {
        const u = new URL(raw.startsWith("http") ? raw : `http://x${raw}`);
        sku = u.searchParams.get("sku") ?? raw;
      }
    } catch { /* use raw */ }

    scanSourceRef.current = "usb";
    handleScan(sku);
  }, [handleScan]);
  useUsbScanner(handleUsbScan, {
    allowedInput: { ref: manualInputRef, onClear: () => setManualSku("") },
  });

  useEffect(() => {
    if (!lookupSku) return;
    /* Camera scans already played playCameraDetect() immediately at decode
       time — only play the USB double-beep for USB/manual entries.         */
    if (scanSourceRef.current === "usb") playScanBeep();

    /* Try in-memory cache first (instant ~0ms), fall back to API */
    const cached = skuCache.get(lookupSku.toLowerCase());
    if (cached) {
      if (isBilling) {
        addItem({ productId: cached.id, sku: cached.sku, name: cached.name, price: cached.salePrice != null ? cached.salePrice : cached.price, mrp: cached.salePrice != null ? cached.price : undefined });
        setLastAddedId(cached.id);
        setTimeout(() => setLastAddedId(null), 700);
        toast.success(`Added: ${cached.name}`, { duration: 1500 });
      } else {
        setStockProduct(cached);
        setStockSuccess(null);
      }
      if (cached.stock <= cached.lowStockThreshold) {
        triggerLowStockFlash(cached.name, cached.stock);
      }
      setLookupSku(null);
      return;
    }

    /* Cache miss — fetch from API (new product added after page load) */
    lookupBySku(lookupSku)
      .then((product) => {
        if (isBilling) {
          addItem({ productId: product.id, sku: product.sku, name: product.name, price: product.salePrice != null ? product.salePrice : product.price, mrp: product.salePrice != null ? product.price : undefined });
          setLastAddedId(product.id);
          setTimeout(() => setLastAddedId(null), 700);
          toast.success(`Added: ${product.name}`, { duration: 1500 });
        } else {
          setStockProduct(product);
          setStockSuccess(null);
        }
        if (product.stock <= product.lowStockThreshold) {
          triggerLowStockFlash(product.name, product.stock);
        }
      })
      .catch(() => { playError(); toast.error(`SKU "${lookupSku}" not found`); })
      .finally(() => setLookupSku(null));
  }, [lookupSku, isBilling, addItem, skuCache, triggerLowStockFlash]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "Enter" && isBilling && items.length > 0 && !showModal) { e.preventDefault(); setShowModal(true); return; }
      if (e.key === "Escape" && showModal) { setShowModal(false); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setMode((m) => m === "billing" ? "stockin" : "billing"); return; }
      if (e.key === "b" || e.key === "B") { setMode("billing"); return; }
      if (e.key === "s" || e.key === "S") { setMode("stockin"); return; }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isBilling, items.length, showModal]);

  const handleManual = (e: React.FormEvent) => {
    e.preventDefault();
    const sku = manualSku.trim().toUpperCase();
    if (!sku) return;
    setManualSku("");
    scanSourceRef.current = "usb";
    setLookupSku(sku);
  };

  const handleQtyChange = useCallback((productId: string, newQty: number) => {
    playTick(); updateQty(productId, newQty);
  }, [updateQty]);

  const handleConfirmCheckout = async (paymentMode: PaymentMode, customerPhone: string) => {
    if (!items.length) return;

    /* ── Offline: queue the bill locally, sync later ── */
    if (!isOnline) {
      enqueue({
        items:         items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        paymentMode,
        customerPhone: customerPhone || undefined,
        total,
        itemsCount:    count,
      });
      playCheckoutSuccess();
      clearCart();
      setShowModal(false);
      return;
    }

    setChecking(true);
    try {
      const result = await postCheckout({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
        paymentMode, customerPhone: customerPhone || undefined,
      });
      playCheckoutSuccess(); clearCart(); setShowModal(false);
      setSuccessBillId(result.bill.id);
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setChecking(false);
    }
  };

  const handleStockInConfirm = async (qty: number) => {
    if (!stockProduct) return;
    setStockAdding(true);
    try {
      const result = await postStockIn(stockProduct.id, qty);
      playStockIn();
      const newStock = result.product?.stock ?? stockProduct.stock + qty;
      setStockSuccess({ name: stockProduct.name, added: qty, newStock });
      setStockProduct(null);
      toast.success(`Stock updated: +${qty} added`, { duration: 2000 });
    } catch (err: any) {
      playError(); toast.error(err.message || "Stock update failed");
    } finally {
      setStockAdding(false);
    }
  };

  const switchMode = (newMode: PageMode) => {
    setMode(newMode); setStockProduct(null); setStockSuccess(null); setLookupSku(null); setManualSku("");
  };

  const hasItems = items.length > 0;

  return (
    <div className="relative flex flex-col h-full bg-background text-foreground overflow-hidden">

      {/* ── Scan confirmation flash ── */}
      <ScanFlash flash={flash} />
      <LowStockFlash lowStockFlash={lowStockFlash} />

      {/* ── Overlays ── */}
      {successBillId && <SuccessOverlay billId={successBillId} />}
      {showModal && (
        <CheckoutModal total={total} count={count}
          onCancel={() => setShowModal(false)}
          onConfirm={handleConfirmCheckout}
          loading={checking}
        />
      )}

      {/* ── Offline / pending sync banner ── */}
      {(!isOnline || pendingCount > 0) && (
        <div className={`flex items-center justify-between gap-2 px-4 py-1.5 text-xs font-bold ${!isOnline ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3" />
            {!isOnline
              ? "Offline — bills will be saved and synced when reconnected"
              : `${pendingCount} bill${pendingCount !== 1 ? "s" : ""} pending sync`
            }
          </div>
          {isOnline && pendingCount > 0 && (
            <button onClick={syncAll} className="flex items-center gap-1 underline underline-offset-2">
              <RefreshCw className="w-3 h-3" /> Sync now
            </button>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBilling ? "bg-green-100 dark:bg-green-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
            <ScanLine className={`w-4 h-4 ${isBilling ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`} />
          </div>
          <div>
            <h1 className="text-base font-black leading-none">{isBilling ? "Scan & Bill" : "Stock IN"}</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isBilling ? "Scan → add to cart → checkout" : "Scan → confirm quantity → update stock"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBilling && hasItems && (
            <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-sm font-bold border border-green-200 dark:border-green-800">
              <ShoppingCart className="w-3.5 h-3.5" />
              {count}
            </div>
          )}
          <button
            onClick={() => { const next = toggleSoundMute(); setMuted(next); }}
            title={muted ? "Sound off — tap to enable" : "Sound on — tap to mute"}
            className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors border">
            {muted
              ? <VolumeX className="w-4 h-4 text-muted-foreground" />
              : <Volume2 className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button onClick={() => { setShowScanner((v) => !v); setCameraError(null); }}
            className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors border">
            {showScanner ? <CameraOff className="w-4 h-4 text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex rounded-xl bg-muted border p-1 gap-1">
          <button onClick={() => switchMode("billing")}
            className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg font-bold text-sm transition-all ${
              isBilling
                ? "bg-green-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <ShoppingBag className="w-4 h-4" />
            Billing
          </button>
          <button onClick={() => switchMode("stockin")}
            className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg font-bold text-sm transition-all ${
              isStockIn
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <PackagePlus className="w-4 h-4" />
            Stock IN
          </button>
        </div>
      </div>

      {/* ── Scanner ── */}
      {showScanner && (
        <div className="shrink-0 flex flex-col items-center px-4 pb-2">
          <div className={`w-full max-w-xs aspect-square bg-zinc-900 rounded-2xl overflow-hidden shadow-lg relative border-2 ${
            isBilling ? "border-green-500/40" : "border-blue-500/40"
          }`}>
            {/* Camera error state */}
            {cameraError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-5 text-center">
                <CameraOff className="w-10 h-10 text-zinc-400" />
                <p className="text-zinc-300 text-sm font-medium leading-snug">{cameraError}</p>
                <button
                  onClick={() => { setCameraError(null); setShowScanner(false); setTimeout(() => setShowScanner(true), 100); }}
                  className="mt-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors">
                  Retry Camera
                </button>
              </div>
            ) : (
              <>
                {/* Native video element — sized by CSS, never 0×0 */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Corner brackets overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-36 h-36 relative">
                    {(["top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg",
                       "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg",
                       "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg",
                       "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg",
                    ] as const).map((cls, i) => (
                      <div key={i} className={`absolute w-6 h-6 ${cls} ${isBilling ? "border-green-400" : "border-blue-400"}`} />
                    ))}
                    <div className={`absolute top-1/2 left-0 right-0 h-0.5 animate-[scan_2s_ease-in-out_infinite] ${isBilling ? "bg-green-400/80" : "bg-blue-400/80"}`} />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="h-6 mt-1.5 flex items-center justify-center">
            {lookupSku ? (
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${isBilling ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Looking up {lookupSku}…
              </span>
            ) : cameraError ? null : (
              <span className="text-xs text-muted-foreground">Point camera at QR code or barcode</span>
            )}
          </div>
        </div>
      )}

      {/* ── Manual SKU Entry ── */}
      <div className="px-4 pb-3 shrink-0">
        <form onSubmit={handleManual} className="flex gap-2">
          <Input ref={manualInputRef} value={manualSku} onChange={(e) => setManualSku(e.target.value)}
            placeholder="Type SKU or scan barcode…"
            className={`h-11 font-mono uppercase text-sm rounded-xl ${isStockIn ? "focus:border-blue-500" : "focus:border-green-500"}`}
            data-testid="input-sku-manual"
          />
          <Button type="submit" size="sm"
            className={`h-11 px-4 rounded-xl font-bold shrink-0 ${isStockIn ? "bg-blue-600 hover:bg-blue-500" : "bg-green-600 hover:bg-green-500"}`}
            disabled={!manualSku.trim()}>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Usb className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60 font-medium">USB barcode scanner active — scan anytime</span>
        </div>
      </div>

      {/* ══════════════════════════════════
          BILLING MODE content
      ══════════════════════════════════ */}
      {isBilling && (
        <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <ShoppingCart className="w-8 h-8 opacity-40" />
              </div>
              <p className="font-bold text-base text-foreground">Cart is empty</p>
              <p className="text-sm mt-1 text-muted-foreground">Scan a product to get started</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Cart · {count} item{count !== 1 ? "s" : ""}
              </p>
              {items.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  isNew={item.productId === lastAddedId}
                  onQtyChange={handleQtyChange}
                  onRemove={removeItem}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          STOCK IN MODE content
      ══════════════════════════════════ */}
      {isStockIn && (
        <div className="flex-1 overflow-y-auto pb-4 space-y-3">
          {stockSuccess && (
            <div className="mx-4 flex items-center gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 animate-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-700 dark:text-green-300 truncate">+{stockSuccess.added} added · {stockSuccess.name}</p>
                <p className="text-xs text-muted-foreground">New stock: <span className="font-bold text-foreground">{stockSuccess.newStock} units</span></p>
              </div>
              <button onClick={() => setStockSuccess(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {stockProduct ? (
            <StockInPanel product={stockProduct} onConfirm={handleStockInConfirm} onDismiss={() => setStockProduct(null)} loading={stockAdding} />
          ) : (
            !stockSuccess && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                  <PackagePlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="font-bold text-base text-foreground">Stock IN Mode</p>
                <p className="text-sm mt-1">Scan a product barcode or enter SKU to add stock</p>
              </div>
            )
          )}

          {stockSuccess && !stockProduct && (
            <div className="mx-4 flex">
              <button onClick={() => { setStockSuccess(null); }}
                className="flex-1 h-11 flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-sm rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-95 transition-all">
                <RotateCcw className="w-4 h-4" />
                Scan Another Product
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Billing bottom bar ── */}
      {isBilling && (
        <div className={`shrink-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 transition-all duration-300 bg-card`}>
          {hasItems ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Grand Total</p>
                  <AnimatedTotal value={total} />
                </div>
                <div className="text-right">
                  <button onClick={clearCart}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold transition-colors">
                    <Trash2 className="w-3 h-3" /> Clear cart
                  </button>
                </div>
              </div>
              <button onClick={() => setShowModal(true)}
                className="w-full h-13 py-3.5 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all"
                data-testid="btn-checkout">
                <Receipt className="w-5 h-5" />
                Checkout · {count} item{count !== 1 ? "s" : ""}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-12 text-sm text-muted-foreground font-medium">
              Add items to start billing
            </div>
          )}
        </div>
      )}
    </div>
  );
}
