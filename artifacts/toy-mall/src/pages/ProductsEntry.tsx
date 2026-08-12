/**
 * Entry Data — the stock-in workstation.
 *
 * Deliberately separate from /scan (billing-first, stock-in hidden behind a
 * mode toggle) and from /logs (read-only history). This page does one job:
 * put stock IN, with the product's own history visible at the moment you
 * decide the quantity.
 *
 * Two INPUTS, not one. The USB scanner hook listens on document keydown, so a
 * single shared box fires a lookup mid-word while a human types a product
 * name. Scan mode owns the scanner; Manual mode disables it and searches the
 * in-memory product list instead.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  PackagePlus, ScanLine, Camera, CameraOff, Loader2, Search, X,
  Volume2, VolumeX, Plus, Minus, Boxes, AlertTriangle, Keyboard,
  CheckCircle2, Clock, Barcode, Layers, PackageSearch, TrendingUp, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUsbScanner } from "@/hooks/use-usb-scanner";
import { useCameraScanner } from "@/hooks/use-camera-scanner";
import { useScanFlash, ScanFlash } from "@/components/ui/ScanFlash";
import {
  playScanBeep, playCameraDetect, playError, playStockIn,
  isSoundMuted, toggleSoundMute,
} from "@/lib/sounds";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useAuth, usePermission } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const IST = "Asia/Kolkata";

/* ── Types ──────────────────────────────────────────────────────── */
interface EntryProduct {
  id:                string;
  name:              string;
  sku:               string;
  barcode?:          string | null;
  category?:         string | null;
  price:             number;
  salePrice?:        number | null;
  purchasePrice?:    number | null;
  stock:             number;
  lowStockThreshold: number;
  imageUrl?:         string | null;
}

interface StockLog {
  id:          string;
  productId:   string;
  productName: string;
  productSku:  string;
  type:        "IN" | "OUT" | "ADJUSTMENT" | "RETURN";
  quantity:    number;
  userId:      string | null;
  createdAt:   string;
}

type InputMode = "scan" | "manual";

/* ── API helpers ────────────────────────────────────────────────── */
/* Every helper checks res.ok BEFORE res.json(): an HTML error page thrown by
   a proxy would otherwise blow up in the JSON parser with a useless message. */
async function lookupByCode(code: string): Promise<EntryProduct> {
  const res = await fetch(`${BASE_URL}/api/products/scan/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(res.status === 404 ? "not_found" : "lookup_failed");
  return res.json();
}

async function fetchStockLogs(params: Record<string, string>): Promise<StockLog[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/api/stock-logs?${qs}`);
  if (!res.ok) throw new Error("Could not load stock history");
  return res.json();
}

/* The route replies with the row it actually wrote — use it rather than
   guessing the new level client-side. */
interface StockInResponse { error?: string; product?: EntryProduct }

async function postStockIn(productId: string, quantity: number, userId?: string): Promise<StockInResponse> {
  const res = await fetch(`${BASE_URL}/api/products/${productId}/stock`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ type: "IN", quantity, ...(userId ? { userId } : {}) }),
  });
  let data: StockInResponse = {};
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw new Error(data.error || "Stock update failed");
  return data;
}

/* ── Date helpers (shop's business day is an IST calendar day) ──── */
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });

const fmtDayLabel = (day: string) => {
  const today = todayIst();
  if (day === today) return "Today";
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  });
};

/** "3 days ago" — reads faster than a date when judging if stock is stale. */
function relativeDays(iso: string): string {
  const then = istDay(iso);
  const today = todayIst();
  if (then === today) return "today";
  const diff = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${then}T00:00:00Z`)) / 86_400_000,
  );
  if (diff === 1) return "yesterday";
  if (diff < 30) return `${diff} days ago`;
  if (diff < 60) return "last month";
  return `${Math.floor(diff / 30)} months ago`;
}

const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/* ═══════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════ */
export default function ProductsEntry() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  /* The server gates POST /products/:id/stock with requireWrite("scan"), so
     `scan` is the single source of truth — mirror it exactly and the button's
     state can never disagree with the server's answer. Gating on `products`
     instead breaks both ways: default staff are products:read + scan:write
     (locked out of a page they're meant to live in), while a catalog-only
     manager would get an enabled button and a 403. */
  const canAddStock = usePermission("scan") === "write";

  const [mode, setMode]           = useState<InputMode>("scan");
  const [muted, setMuted]         = useState(() => isSoundMuted());
  const [cameraOn, setCameraOn]   = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [scanValue, setScanValue] = useState("");
  const [search, setSearch]       = useState("");
  const [lookupCode, setLookupCode] = useState<string | null>(null);
  const [looking, setLooking]     = useState(false);

  const [product, setProduct]     = useState<EntryProduct | null>(null);
  const [history, setHistory]     = useState<StockLog[] | null>(null);
  const [qty, setQty]             = useState(1);
  const [adding, setAdding]       = useState(false);
  const [justAdded, setJustAdded] = useState<{ added: number; newStock: number } | null>(null);

  const [recent, setRecent]         = useState<StockLog[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const scanInputRef   = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef       = useRef<HTMLVideoElement>(null);
  const addingRef      = useRef(false);   // synchronous double-submit guard

  const { flash, triggerFlash } = useScanFlash();

  /* ── Product list, preloaded for instant manual search ── */
  const { data: allProducts } = useListProducts(
    {},
    { query: { queryKey: getListProductsQueryKey({}), staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 15 } },
  );

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    const list = (allProducts ?? []) as unknown as EntryProduct[];
    const scored = list
      .map((p) => {
        const name = p.name.toLowerCase();
        const sku  = p.sku.toLowerCase();
        if (sku === q || name === q) return { p, rank: 0 };
        if (sku.startsWith(q) || name.startsWith(q)) return { p, rank: 1 };
        if (sku.includes(q) || name.includes(q)) return { p, rank: 2 };
        return null;
      })
      .filter((x): x is { p: EntryProduct; rank: number } => x !== null)
      .sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name));
    return scored.slice(0, 8).map((x) => x.p);
  }, [search, allProducts]);

  /* ── Recent entries feed ── */
  const loadRecent = useCallback(async () => {
    try {
      const rows = await fetchStockLogs({ type: "IN", limit: "60" });
      setRecent(rows);
    } catch {
      /* Non-fatal: the feed is context, not the job. Keep whatever we had. */
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  /* ── Scanner wiring ───────────────────────────────────────────── */
  /* THE one way to select a product. Clearing the old selection before the
     async lookup is the safety-critical part: until it resolves the panel
     would otherwise still show — and the Add button would still act on — the
     PREVIOUS product, so an operator who picks B and immediately hits Add
     would put B's quantity onto A. Every path routes through here (USB gun,
     camera, typed code, manual search result) so none can skip it. */
  const beginLookup = useCallback((code: string) => {
    setProduct(null);
    setHistory(null);
    setJustAdded(null);
    setLookupCode(code);
  }, []);

  const handleScan = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return;
    triggerFlash(clean);
    beginLookup(clean);
  }, [triggerFlash, beginLookup]);

  const handleUsbScan = useCallback((code: string) => {
    /* A QR label encodes a product URL, not a bare SKU. */
    const m = code.match(/product\?sku=([^&\s]+)/i);
    handleScan(m?.[1] ? decodeURIComponent(m[1]) : code);
  }, [handleScan]);

  useUsbScanner(handleUsbScan, {
    enabled: mode === "scan",
    allowedInput: { ref: scanInputRef, onClear: () => setScanValue("") },
  });

  const handleCameraScan = useCallback((code: string) => {
    playCameraDetect();
    handleScan(code);
  }, [handleScan]);

  useCameraScanner(
    mode === "scan" && cameraOn,
    videoRef,
    handleCameraScan,
    (msg) => { setCameraError(msg); setCameraOn(false); },
  );

  /* ── Lookup → load product + its own stock-in history ─────────── */
  useEffect(() => {
    if (!lookupCode) return;
    let cancelled = false;
    setLooking(true);
    setJustAdded(null);

    lookupByCode(lookupCode)
      .then(async (p) => {
        if (cancelled) return;
        playScanBeep();
        setProduct(p);
        setQty(1);
        setHistory(null);
        try {
          const logs = await fetchStockLogs({ productId: p.id, type: "IN", limit: "6" });
          if (!cancelled) setHistory(logs);
        } catch {
          if (!cancelled) setHistory([]);   // history is optional context
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        playError();
        if (err.message === "not_found") {
          toast.error(`No product with code "${lookupCode}"`, {
            description: "Check the code, search by name, or add it as a new product.",
          });
        } else {
          toast.error("Lookup failed — check your connection and try again.");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLooking(false);
        setLookupCode(null);
        setScanValue("");
        if (mode === "scan") scanInputRef.current?.focus();
      });

    return () => { cancelled = true; };
  }, [lookupCode, mode]);

  /* Keep the scan box focused so the gun always has a target. */
  useEffect(() => {
    if (mode === "scan") scanInputRef.current?.focus();
    else searchInputRef.current?.focus();
  }, [mode]);

  /* ── Add stock ────────────────────────────────────────────────── */
  const addStock = useCallback(async () => {
    if (!product || addingRef.current) return;
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Enter a whole quantity of 1 or more");
      return;
    }
    addingRef.current = true;
    setAdding(true);
    try {
      const result = await postStockIn(product.id, qty, userId);
      playStockIn();
      /* Trust the row the server wrote over local arithmetic: a sale at the
         till, or an entry from another device, between the lookup and this
         write would make `product.stock + qty` quietly wrong. */
      const fresh = result.product;
      const newStock = typeof fresh?.stock === "number" ? fresh.stock : product.stock + qty;
      setProduct(fresh ? { ...product, ...fresh } : { ...product, stock: newStock });
      setJustAdded({ added: qty, newStock });
      setQty(1);
      toast.success(`+${qty} added to ${product.name}`, { description: `Now ${newStock} in stock` });

      /* Refresh both histories so the page reflects the write it just made,
         and drop the cached product list the rest of the app reads from. */
      void loadRecent();
      void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
      fetchStockLogs({ productId: product.id, type: "IN", limit: "6" })
        .then(setHistory)
        .catch(() => { /* keep the stale list rather than blanking it */ });

      if (mode === "scan") scanInputRef.current?.focus();
    } catch (err) {
      playError();
      /* A response can be lost *after* the server commits, so never imply the
         write definitely failed — a blind retry would double the stock. Send
         them to the feed, which is authoritative. */
      toast.error(err instanceof Error ? err.message : "Stock update failed", {
        description: "Check 'Recent stock entries' below before retrying — it may have gone through.",
      });
      void loadRecent();
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }, [product, qty, userId, loadRecent, mode, queryClient]);

  /* ── Derived: this product's last entry + recent-feed rollups ─── */
  const lastEntry = history?.[0] ?? null;

  const todayTotals = useMemo(() => {
    const today = todayIst();
    const rows = recent.filter((r) => istDay(r.createdAt) === today);
    return {
      entries: rows.length,
      units:   rows.reduce((s, r) => s + r.quantity, 0),
      skus:    new Set(rows.map((r) => r.productId)).size,
    };
  }, [recent]);

  const groupedRecent = useMemo(() => {
    const map = new Map<string, StockLog[]>();
    for (const row of recent) {
      const day = istDay(row.createdAt);
      const list = map.get(day);
      if (list) list.push(row); else map.set(day, [row]);
    }
    return [...map.entries()];
  }, [recent]);

  const lowStock = product ? product.stock <= product.lowStockThreshold : false;

  /* ═══════════════════ Render ═══════════════════ */
  return (
    <div className="min-h-full bg-muted/20">
      <ScanFlash flash={flash} />

      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Entry Data</h1>
              <p className="text-sm text-muted-foreground">
                Scan a barcode to add stock and see when it was last stocked
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => { toggleSoundMute(); setMuted(isSoundMuted()); }}
              title={muted ? "Unmute scan sounds" : "Mute scan sounds"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Link href="/logs">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Clock className="h-4 w-4" /> Full history
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Input card: Scan | Manual ── */}
        <div className="mb-5 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex border-b bg-muted/40 p-1.5">
            {([
              { key: "scan"   as const, label: "Scan barcode", icon: ScanLine },
              { key: "manual" as const, label: "Manual",       icon: Keyboard },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  mode === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {mode === "scan" ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" />
                    <Input
                      ref={scanInputRef}
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      placeholder="Scan barcode or SKU…"
                      autoFocus
                      inputMode="none"
                      className="h-14 pl-11 pr-11 text-lg font-medium tracking-wide"
                    />
                    {looking && (
                      <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    variant={cameraOn ? "default" : "outline"}
                    onClick={() => { setCameraError(null); setCameraOn((v) => !v); }}
                    className="h-14 gap-2 px-5 sm:w-auto"
                  >
                    {cameraOn ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                    {cameraOn ? "Stop camera" : "Use camera"}
                  </Button>
                </div>

                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  USB scanner is live — just scan. No barcode on the item? Switch to Manual.
                </p>

                {cameraOn && (
                  <div className="relative mt-3 overflow-hidden rounded-xl border bg-black">
                    <video ref={videoRef} playsInline muted className="h-56 w-full object-cover sm:h-72" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-24 w-56 rounded-lg border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type product name or SKU…"
                  autoFocus
                  className="h-14 pl-11 pr-10 text-base"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {search.trim() && (
                  <div className="mt-2 overflow-hidden rounded-xl border bg-background">
                    {suggestions.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No product matches “{search.trim()}”.
                      </div>
                    ) : (
                      suggestions.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSearch(""); beginLookup(p.sku); }}
                          className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="block font-mono text-xs text-muted-foreground">{p.sku}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            p.stock <= p.lowStockThreshold
                              ? "bg-amber-100 text-amber-800"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {p.stock} in stock
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Body: product panel + recent entries ── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* ═══ Product panel ═══ */}
          <div>
            {!product ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <PackageSearch className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Scan a product to begin</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  You'll see its full details and every past stock entry before you
                  decide how much to add.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                {/* Product header */}
                <div className="flex gap-4 border-b p-4 sm:p-5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-muted sm:h-24 sm:w-24">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Boxes className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold leading-snug sm:text-xl">{product.name}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium">
                        {product.sku}
                      </span>
                      {product.barcode && (
                        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          <Barcode className="h-3 w-3" />{product.barcode}
                        </span>
                      )}
                      {product.category && (
                        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          <Layers className="h-3 w-3" />{product.category}
                        </span>
                      )}
                    </div>
                    <Link href={`/product?sku=${encodeURIComponent(product.sku)}`}>
                      <span className="mt-2 inline-block cursor-pointer text-xs font-medium text-primary hover:underline">
                        Open full product page →
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Key numbers */}
                <div className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-4 sm:divide-y-0">
                  <div className={`p-4 ${lowStock ? "bg-amber-50" : ""}`}>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In stock</div>
                    <div className={`mt-1 text-2xl font-bold tabular-nums ${lowStock ? "text-amber-700" : ""}`}>
                      {product.stock}
                    </div>
                    {lowStock && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Low stock
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost price</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {product.purchasePrice != null ? money(product.purchasePrice) : "—"}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selling at</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {money(product.salePrice ?? product.price)}
                    </div>
                    {product.salePrice != null && product.salePrice !== product.price && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-through">{money(product.price)}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock value</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                      {money(product.stock * (product.purchasePrice ?? product.price))}
                    </div>
                  </div>
                </div>

                {/* Last stock — the reason this page exists */}
                <div className="border-b p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Last stock entries</h3>
                  </div>

                  {history === null ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                    </div>
                  ) : history.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                      Never stocked before — this will be its first entry.
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-emerald-50 px-4 py-3">
                        <div>
                          <div className="text-xs font-medium text-emerald-800">Last stocked</div>
                          <div className="text-base font-semibold text-emerald-900">
                            {lastEntry && relativeDays(lastEntry.createdAt)}
                            <span className="ml-1.5 text-sm font-normal text-emerald-700">
                              ({lastEntry && fmtDate(lastEntry.createdAt)})
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-emerald-800">Quantity added</div>
                          <div className="text-base font-semibold text-emerald-900">
                            +{lastEntry?.quantity}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-emerald-800">Last {history.length} entries</div>
                          <div className="text-base font-semibold text-emerald-900">
                            +{history.reduce((s, h) => s + h.quantity, 0)} total
                          </div>
                        </div>
                      </div>

                      <ul className="divide-y rounded-xl border">
                        {history.map((h) => (
                          <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{fmtDate(h.createdAt)}</div>
                              <div className="text-xs text-muted-foreground">{fmtTime(h.createdAt)}</div>
                            </div>
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold tabular-nums text-emerald-800">
                              +{h.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* Add stock */}
                <div className="p-4 sm:p-5">
                  {justAdded && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      Added {justAdded.added} — now {justAdded.newStock} in stock. Scan the next item.
                    </div>
                  )}

                  {!canAddStock ? (
                    <div className="flex items-start gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      You can view stock here, but your account isn't allowed to add stock.
                      Ask the owner to give you write access.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-sm font-medium">Quantity to add</label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline" size="icon" className="h-12 w-12 shrink-0"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            disabled={qty <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number" min={1} inputMode="numeric"
                            value={qty}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              setQty(Number.isNaN(n) ? 1 : Math.max(1, n));
                            }}
                            className="h-12 w-24 text-center text-lg font-semibold tabular-nums"
                          />
                          <Button
                            variant="outline" size="icon" className="h-12 w-12 shrink-0"
                            onClick={() => setQty((q) => q + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <div className="ml-1 hidden gap-1.5 sm:flex">
                            {[5, 10, 25, 50].map((n) => (
                              <button
                                key={n}
                                onClick={() => setQty((q) => q + n)}
                                className="rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                +{n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => void addStock()}
                        disabled={adding}
                        className="h-12 gap-2 bg-emerald-600 px-6 text-base hover:bg-emerald-700 sm:min-w-[190px]"
                      >
                        {adding
                          ? <><Loader2 className="h-5 w-5 animate-spin" /> Adding…</>
                          : <><PackagePlus className="h-5 w-5" /> Add {qty} to stock</>}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ═══ Recent entries ═══ */}
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Recent stock entries</h3>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Today", value: todayTotals.entries, sub: "entries" },
                  { label: "Units",  value: todayTotals.units,   sub: "added" },
                  { label: "Items",  value: todayTotals.skus,    sub: "products" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-muted/50 px-3 py-2.5 text-center">
                    <div className="text-xl font-bold tabular-nums">{s.value}</div>
                    <div className="text-[11px] leading-tight text-muted-foreground">{s.label} {s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-h-[540px] overflow-y-auto">
              {recentLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : recent.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No stock entries yet.
                </div>
              ) : (
                groupedRecent.map(([day, rows]) => (
                  <div key={day}>
                    <div className="sticky top-0 z-10 flex items-center justify-between border-y bg-muted/70 px-4 py-1.5 backdrop-blur">
                      <span className="text-xs font-semibold">{fmtDayLabel(day)}</span>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        +{rows.reduce((s, r) => s + r.quantity, 0)} units
                      </span>
                    </div>
                    <ul className="divide-y">
                      {rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40">
                          <button
                            onClick={() => beginLookup(r.productSku)}
                            className="min-w-0 flex-1 text-left"
                            title="Open this product"
                          >
                            <div className="truncate text-sm font-medium">{r.productName}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {r.productSku} · {fmtTime(r.createdAt)}
                            </div>
                          </button>
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800">
                            +{r.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
