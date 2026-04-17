import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  ScanLine, ArrowRight, Trash2, Plus, Minus,
  ShoppingCart, Receipt, Loader2, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { playScanBeep, playError } from "@/lib/sounds";
import { useCart } from "@/contexts/cart-context";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function lookupBySku(sku: string) {
  const res = await fetch(`${BASE_URL}/api/products/sku/${encodeURIComponent(sku)}`);
  if (!res.ok) throw new Error("Product not found");
  return res.json() as Promise<{
    id: string; name: string; sku: string; price: number; stock: number;
  }>;
}

async function postCheckout(items: { productId: string; quantity: number; price: number }[]) {
  const res = await fetch(`${BASE_URL}/api/bills/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  return data;
}

export default function Scan() {
  const [, setLocation] = useLocation();
  const { items, count, total, addItem, removeItem, updateQty, clearCart } = useCart();

  const [manualSku, setManualSku]     = useState("");
  const [scannerOn, setScannerOn]     = useState(true);
  const [checking, setChecking]       = useState(false);
  const [lookupSku, setLookupSku]     = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const processingRef = useRef(false);

  /* ── Scanner ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!scannerOn || !showScanner) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1,
        videoConstraints: { facingMode: "environment" },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
      },
      false
    );

    scanner.render(
      (raw) => {
        if (processingRef.current) return;
        processingRef.current = true;

        let sku = raw;
        try {
          if (raw.includes("product?sku=")) {
            const u = new URL(raw.startsWith("http") ? raw : `http://x${raw}`);
            sku = u.searchParams.get("sku") ?? raw;
          }
        } catch { /* use raw */ }

        setLookupSku(sku.toUpperCase());
        setTimeout(() => { processingRef.current = false; }, 1500);
      },
      () => { /* ignore no-match frames */ }
    );

    return () => { scanner.clear().catch(() => {}); };
  }, [scannerOn, showScanner]);

  /* ── Resolve scanned SKU ──────────────────────────────────────── */
  useEffect(() => {
    if (!lookupSku) return;
    playScanBeep();

    lookupBySku(lookupSku)
      .then((product) => {
        addItem({ productId: product.id, sku: product.sku, name: product.name, price: product.price });
        toast.success(`Added: ${product.name}`, { duration: 1500 });
      })
      .catch(() => {
        playError();
        toast.error(`SKU "${lookupSku}" not found`);
      })
      .finally(() => setLookupSku(null));
  }, [lookupSku, addItem]);

  /* ── Manual submit ────────────────────────────────────────────── */
  const handleManual = (e: React.FormEvent) => {
    e.preventDefault();
    const sku = manualSku.trim().toUpperCase();
    if (!sku) return;
    setManualSku("");
    setLookupSku(sku);
  };

  /* ── Checkout ─────────────────────────────────────────────────── */
  const handleCheckout = async () => {
    if (!items.length) return;
    setChecking(true);
    try {
      const result = await postCheckout(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
      );
      clearCart();
      setLocation(`/bill/${result.bill.id}`);
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setChecking(false);
    }
  };

  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 backdrop-blur-sm border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-black">Scan & Cart</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScanner((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors font-semibold"
          >
            {showScanner ? "Hide Camera" : "Show Camera"}
          </button>
          {hasItems && (
            <div className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-1.5 rounded-full text-sm font-bold">
              <ShoppingCart className="w-4 h-4" />
              {count}
            </div>
          )}
        </div>
      </div>

      {/* ── Scanner (collapsible) ──────────────────────────────── */}
      {showScanner && (
        <div className="shrink-0 flex flex-col items-center px-4 pt-3 pb-2">
          <div className="w-full max-w-xs aspect-square bg-black rounded-2xl overflow-hidden border border-white/10 shadow-xl relative">
            {scannerOn ? (
              <div
                id="reader"
                className="w-full h-full [&>div]:border-none [&>div>video]:object-cover [&>div>video]:w-full [&>div>video]:h-full"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/40">
                <ScanLine className="w-10 h-10 mb-2" />
                <p className="text-sm">Scanner paused</p>
                <Button variant="outline" size="sm" className="mt-3 text-black text-xs" onClick={() => setScannerOn(true)}>
                  Resume
                </Button>
              </div>
            )}

            {/* Corner brackets only — no overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-36 h-36 relative">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-lg" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/80 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>

          {/* Status bar below camera */}
          <div className="h-6 mt-2 flex items-center justify-center">
            {lookupSku ? (
              <span className="flex items-center gap-1.5 text-xs text-primary font-mono font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                Looking up {lookupSku}…
              </span>
            ) : (
              <span className="text-xs text-white/30 font-medium">Point camera at QR code or barcode</span>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Entry ──────────────────────────────────────── */}
      <div className="px-4 pb-3 shrink-0">
        <form onSubmit={handleManual} className="flex gap-2">
          <Input
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            placeholder="Type SKU manually…"
            className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl font-mono uppercase text-sm"
            data-testid="input-sku-manual"
          />
          <Button type="submit" size="sm" className="h-11 px-4 rounded-xl font-bold" disabled={!manualSku.trim()}>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* ── Cart Items ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-2">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 py-8">
            <ShoppingCart className="w-12 h-12 mb-3" />
            <p className="font-semibold">Cart is empty</p>
            <p className="text-xs mt-1">Scan a product to add it</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Cart</p>
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{item.name}</p>
                  <p className="text-xs font-mono text-white/50">{item.sku}</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    ₹{item.price.toLocaleString("en-IN")} × {item.quantity}
                    {" "}= <span className="font-bold text-white">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                  </p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQty(item.productId, item.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.productId, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => removeItem(item.productId)}
                  className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Checkout Bar ──────────────────────────────────────── */}
      {hasItems && (
        <div className="shrink-0 bg-zinc-900 border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-white/50 font-medium">{count} item{count !== 1 ? "s" : ""}</p>
              <p className="text-2xl font-black text-white">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
            </div>
            <button
              onClick={clearCart}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          <Button
            onClick={handleCheckout}
            disabled={checking}
            className="w-full h-14 text-base font-black rounded-2xl bg-green-600 hover:bg-green-500 text-white shadow-xl active:scale-[0.98] transition-all"
          >
            {checking ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing…</>
            ) : (
              <><Receipt className="w-5 h-5 mr-2" /> Checkout & Print Bill</>
            )}
          </Button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0%   { transform: translateY(-90px); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(90px); opacity: 0; }
        }
        #reader button { background: white; color: black; border: none; padding: 6px 12px; border-radius: 8px; font-weight: bold; margin-top: 8px; }
        #reader a { color: white; display: none; }
        #reader__dashboard_section_csr { padding: 12px 0; }
        #reader video { object-fit: cover; width: 100%; height: 100%; }
      ` }} />
    </div>
  );
}
