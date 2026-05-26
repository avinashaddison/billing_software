import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { useUsbScanner } from "@/hooks/use-usb-scanner";
import { useCameraScanner } from "@/hooks/use-camera-scanner";
import { useScanFlash, ScanFlash } from "@/components/ui/ScanFlash";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductsQueryKey } from "@workspace/api-client-react";
import { playScanBeep, playCheckoutSuccess, playError, playCameraDetect } from "@/lib/sounds";
import {
  ScanLine, Tag, ArrowRight, Loader2, CheckCircle2, X,
  RotateCcw, Sparkles, Camera, CameraOff,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ScannedProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  salePrice?: number | null;
}

interface RecentEntry {
  id: string;
  name: string;
  sku: string;
  price: number;
  oldSalePrice: number | null;
  newSalePrice: number;
  at: number;
}

async function lookupByCode(code: string): Promise<ScannedProduct> {
  const r = await fetch(`${BASE_URL}/api/products/scan/${encodeURIComponent(code)}`);
  if (!r.ok) throw new Error("Product not found");
  return r.json();
}

async function patchSalePrice(id: string, salePrice: number): Promise<void> {
  const r = await fetch(`${BASE_URL}/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ salePrice, salePriceUntil: null }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error ?? "Failed to save");
  }
}

export default function BulkSalePrice() {
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { flash, triggerFlash } = useScanFlash();
  const qc = useQueryClient();

  const onScan = useCallback(async (code: string) => {
    if (saving || looking) return;
    setLooking(true);
    triggerFlash(code);
    playCameraDetect();
    try {
      const p = await lookupByCode(code);
      playScanBeep();
      setProduct(p);
      setPriceInput("");
      // Focus the price input on next tick so the user can type immediately
      setTimeout(() => priceRef.current?.focus(), 0);
    } catch (e) {
      playError();
      toast.error((e as Error).message || "Scan failed");
    } finally {
      setLooking(false);
    }
  }, [saving, looking, triggerFlash]);

  useUsbScanner(onScan, {
    enabled: !saving,
    allowedInput: { ref: priceRef, onClear: () => setPriceInput("") },
  });

  // Pause the camera when a product is being filled in so the camera doesn't
  // keep firing scans while the user types the sale price.
  useCameraScanner(cameraOn && !product && !saving, videoRef, onScan, (msg) => {
    setCameraError(msg);
    setCameraOn(false);
  });

  // Focus listener: if nothing is focused on mount, leave focus on document so
  // the scanner is captured. Once a product is shown, focus the price input.
  useEffect(() => {
    if (product) {
      priceRef.current?.focus();
    }
  }, [product]);

  const handleSave = async () => {
    if (!product) return;
    const sp = parseFloat(priceInput);
    if (!Number.isFinite(sp) || sp <= 0) {
      toast.error("Enter a valid sale price");
      return;
    }
    if (sp >= product.price) {
      toast.error(`Sale price must be less than ₹${product.price}`);
      return;
    }
    setSaving(true);
    try {
      await patchSalePrice(product.id, sp);
      playCheckoutSuccess();
      setRecent((prev) => [
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          oldSalePrice: product.salePrice ?? null,
          newSalePrice: sp,
          at: Date.now(),
        },
        ...prev,
      ].slice(0, 20));
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      // Reset for next scan
      setProduct(null);
      setPriceInput("");
    } catch (e) {
      playError();
      toast.error((e as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setProduct(null);
    setPriceInput("");
  };

  const handleUndo = async (entry: RecentEntry) => {
    try {
      // Restore the previous sale price (or clear it if there was none before)
      const r = await fetch(`${BASE_URL}/api/products/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salePrice: entry.oldSalePrice,
          salePriceUntil: null,
        }),
      });
      if (!r.ok) throw new Error("Undo failed");
      setRecent((prev) => prev.filter((e) => e !== entry));
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast.success(`Reverted ${entry.name}`);
    } catch (e) {
      toast.error((e as Error).message || "Undo failed");
    }
  };

  // Live margin %
  const margin = (() => {
    if (!product) return null;
    const sp = parseFloat(priceInput);
    if (!Number.isFinite(sp) || sp <= 0 || sp >= product.price) return null;
    return Math.round(((product.price - sp) / product.price) * 100);
  })();

  return (
    <div className="flex flex-col h-full">
      <ScanFlash flash={flash} />

      {/* Header */}
      <div className="p-4 md:p-6 bg-background border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              Bulk Set Sale Price
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Scan a label, type the sale price, press Enter
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-3xl font-black tabular-nums">{recent.length}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Set</p>
            </div>
            <Link href="/products"
              className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
              aria-label="Close">
              <X className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Active product card */}
        {!product ? (
          <div className="rounded-3xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden">
            {/* Camera viewport */}
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 w-full h-full object-cover ${cameraOn && !cameraError ? "" : "hidden"}`}
              />
              {/* Scanning frame overlay */}
              {cameraOn && !cameraError && (
                <>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-2/3 max-w-sm aspect-[2/1] border-2 border-amber-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                  </div>
                  {looking && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-bold text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Looking up…
                      </div>
                    </div>
                  )}
                </>
              )}
              {(!cameraOn || cameraError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  {cameraError ? (
                    <>
                      <CameraOff className="w-12 h-12 text-amber-300 mb-3" />
                      <p className="text-white font-black">{cameraError}</p>
                      <p className="text-xs text-white/70 mt-1">USB scanner still works — just scan a barcode.</p>
                    </>
                  ) : (
                    <>
                      <CameraOff className="w-12 h-12 text-amber-300 mb-3" />
                      <p className="text-white font-black">Camera off</p>
                      <p className="text-xs text-white/70 mt-1">USB scanner still works.</p>
                    </>
                  )}
                </div>
              )}
              {/* Camera toggle */}
              <button
                onClick={() => { setCameraError(null); setCameraOn((c) => !c); }}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              >
                {cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </button>
            </div>
            <div className="p-4 text-center">
              <p className="font-black flex items-center justify-center gap-2">
                <ScanLine className="w-4 h-4 text-amber-500" />
                Ready to scan
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Point the camera at a label barcode, or use your USB scanner
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border bg-card overflow-hidden shadow-md">
            <div className="p-5 border-b bg-gradient-to-br from-amber-50/60 via-card to-card dark:from-amber-950/20">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black truncate">{product.name}</h2>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{product.sku}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">MRP</p>
                  <p className="text-2xl font-black tabular-nums">₹{product.price.toLocaleString("en-IN")}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Sale Price</p>
                  <p className="text-2xl font-black tabular-nums text-red-600">
                    {product.salePrice != null ? `₹${product.salePrice.toLocaleString("en-IN")}` : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5" />
                New Sale Price
              </label>
              <form
                onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={priceRef}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0.01}
                  max={product.price - 0.01}
                  placeholder="e.g. 250"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="h-14 text-2xl font-black tabular-nums rounded-2xl"
                  disabled={saving}
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={saving || !priceInput.trim()}
                  className="h-14 px-6 rounded-2xl font-black text-base"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      Save
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>

              {margin != null && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                  {margin}% off · saving ₹{(product.price - parseFloat(priceInput)).toFixed(0)} per unit
                </p>
              )}

              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Enter</kbd> to save · or scan next to skip</span>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="font-bold text-muted-foreground hover:text-foreground"
                >Skip</button>
              </div>
            </div>
          </div>
        )}

        {/* Recent list */}
        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Recently set ({recent.length})
              </p>
              <button
                onClick={() => setRecent([])}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
              >Clear list</button>
            </div>
            <div className="space-y-1.5">
              {recent.map((e) => (
                <div key={`${e.id}-${e.at}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{e.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm">
                      <span className="line-through text-muted-foreground font-normal mr-1">₹{e.price.toLocaleString("en-IN")}</span>
                      <span className="text-red-600">₹{e.newSalePrice.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleUndo(e)}
                    className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Undo"
                    aria-label="Undo"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
