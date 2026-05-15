import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, Flame, Plus, ShoppingCart, Clock, Loader2, X, CheckCircle2, Zap, Star, TrendingDown } from "lucide-react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { getCategoryEmoji } from "@/lib/category-colors";
import { useStoreSettings } from "@/lib/store-info";
import { toast } from "sonner";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface DealProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  salePrice: number | null;
  salePriceUntil: string | null;
  isTodayDeal?: boolean;
  stock: number;
  imageUrl?: string | null;
}

function endOfDayISO(date: Date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

/** ── New-deal modal: picks a product, sets sale price + optional end date ── */
function NewDealModal({ allProducts, onClose, onSaved }: {
  allProducts: DealProduct[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [saleType, setSaleType] = useState<"percent" | "amount">("percent");
  const [saleValue, setSaleValue] = useState("");
  const [endDate, setEndDate] = useState(""); // "" = today only
  const [saving, setSaving] = useState(false);

  const matches = !search ? [] : allProducts
    // Exclude products already featured on Today's Deals (with a live sale)
    .filter((p) => !(p.isTodayDeal === true && isLive(p)))
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 12);

  const picked = pickedId ? allProducts.find((p) => p.id === pickedId) ?? null : null;

  const computeSalePrice = () => {
    if (!picked) return null;
    const v = parseFloat(saleValue);
    if (!Number.isFinite(v) || v <= 0) return null;
    if (saleType === "percent") {
      if (v >= 100) return 0;
      return Math.round(picked.price * (1 - v / 100) * 100) / 100;
    }
    return Math.max(0, picked.price - v);
  };
  const newSale = computeSalePrice();

  const handleSave = async () => {
    if (!picked || newSale == null) {
      toast.error("Pick a product and enter a discount");
      return;
    }
    setSaving(true);
    try {
      const body = {
        salePrice: newSale,
        salePriceUntil: endDate ? endOfDayISO(new Date(endDate)) : endOfDayISO(new Date()),
        // Mark this product as a "Today's Deal" so it appears on the deals page.
        // Products that just have a salePrice (set elsewhere) will NOT show here.
        isTodayDeal: true,
      };
      const res = await fetch(`${BASE_URL}/api/products/${picked.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      toast.success(`Deal added: ${picked.name} → ₹${newSale}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-background rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-black text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" /> New Deal
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {!picked ? (
            <>
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1.5">1. Pick a product</p>
                <Input
                  autoFocus
                  placeholder="Search by name or SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              {search && (
                <div className="space-y-1.5">
                  {matches.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No products match.</p>
                  ) : matches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPickedId(p.id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border hover:bg-muted text-left transition-colors"
                    >
                      <span className="text-xl">{getCategoryEmoji(p.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{p.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{p.sku} · ₹{p.price}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/40">
                <span className="text-2xl">{getCategoryEmoji(picked.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{picked.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{picked.sku} · MRP ₹{picked.price}</p>
                </div>
                <button onClick={() => setPickedId(null)} className="text-[11px] underline text-muted-foreground">change</button>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1.5">2. Discount</p>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-xl border bg-muted/30 overflow-hidden h-11">
                    <button onClick={() => setSaleType("percent")}
                      className={`px-4 text-sm font-black transition-colors ${saleType === "percent" ? "bg-violet-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>%</button>
                    <button onClick={() => setSaleType("amount")}
                      className={`px-4 text-sm font-black transition-colors border-l ${saleType === "amount" ? "bg-violet-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>₹</button>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={saleType === "percent" ? 100 : picked.price}
                    placeholder={saleType === "percent" ? "e.g. 20" : "e.g. 50"}
                    value={saleValue}
                    onChange={(e) => setSaleValue(e.target.value)}
                    className="h-11 rounded-xl flex-1 font-bold tabular-nums"
                  />
                </div>
                {newSale != null && (
                  <div className="mt-2 p-3 rounded-xl bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-400/10 border border-violet-500/30">
                    <p className="text-xs text-muted-foreground">Customer pays</p>
                    <p className="text-2xl font-black bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                      ₹{newSale.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="line-through">₹{picked.price}</span>
                      {" → "}
                      saving ₹{(picked.price - newSale).toFixed(2)} per unit
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1.5">3. Valid until (optional)</p>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="h-11 rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave empty for "today only" — deal auto-expires at midnight.</p>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20">
          <button
            onClick={handleSave}
            disabled={!picked || newSale == null || saving}
            className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 text-white shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {saving ? "Saving…" : "Activate Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isLive(p: DealProduct): boolean {
  if (p.salePrice == null) return false;
  if (!p.salePriceUntil) return true;
  const end = new Date(p.salePriceUntil);
  end.setUTCHours(23, 59, 59, 999);
  return new Date() <= end;
}

function offText(p: DealProduct): string {
  if (p.salePrice == null) return "";
  const off = ((p.price - p.salePrice) / p.price) * 100;
  return `${Math.round(off)}% OFF`;
}

/* ═════════════════════════════════════════════════════════════════
   Today's Deals page
═══════════════════════════════════════════════════════════════════ */
export default function Deals() {
  const { data, isLoading } = useListProducts();
  const products: DealProduct[] = (data ?? []) as DealProduct[];
  const qc = useQueryClient();
  const { addItem, count } = useCart();
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const isAdmin = role === "owner";
  const store = useStoreSettings();
  const [showNew, setShowNew] = useState(false);

  const liveDeals = useMemo(
    () => products
      .filter((p) => p.isTodayDeal === true && isLive(p))
      .sort((a, b) => {
        const aOff = (a.price - (a.salePrice ?? 0)) / a.price;
        const bOff = (b.price - (b.salePrice ?? 0)) / b.price;
        return bOff - aOff;
      }),
    [products],
  );

  const handleAddToCart = (p: DealProduct) => {
    addItem({
      productId: p.id,
      sku:       p.sku,
      name:      p.name,
      price:     p.salePrice ?? p.price,
      mrp:       p.salePrice != null ? p.price : undefined,
    });
    toast.success(`Added: ${p.name} (${count + 1} in cart)`, { duration: 1500 });
  };

  const handleEndDeal = async (p: DealProduct) => {
    if (!confirm(`End the deal on "${p.name}"?`)) return;
    try {
      // Remove from Today's Deals. The server also clears salePrice +
      // salePriceUntil when isTodayDeal flips to false, so the product
      // card stops showing the strikethrough MRP and "Sale ends" line.
      const res = await fetch(`${BASE_URL}/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTodayDeal: false }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deal ended");
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    } catch {
      toast.error("Could not end deal");
    }
  };

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto pb-24 md:pb-8">
      {showNew && isAdmin && (
        <NewDealModal
          allProducts={products}
          onClose={() => setShowNew(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: getListProductsQueryKey() })}
        />
      )}

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-fuchsia-600 via-violet-600 via-blue-600 to-cyan-500 text-white">
        {/* Animated glow blobs */}
        <div className="pointer-events-none absolute -top-20 -left-24 w-64 h-64 rounded-full bg-pink-300/30 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="pointer-events-none absolute -bottom-24 -right-12 w-80 h-80 rounded-full bg-yellow-300/25 blur-3xl animate-pulse" style={{ animationDuration: "5s", animationDelay: "1s" }} />
        <div className="pointer-events-none absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-cyan-300/20 blur-3xl animate-pulse" style={{ animationDuration: "6s", animationDelay: "2s" }} />

        {/* Floating sparkles */}
        <Sparkles className="absolute top-6 left-12 w-5 h-5 text-yellow-300 opacity-80 animate-pulse" style={{ animationDuration: "2s" }} />
        <Star className="absolute top-12 right-32 w-3 h-3 text-yellow-200 opacity-60 fill-yellow-200 animate-pulse" style={{ animationDuration: "3s" }} />
        <Sparkles className="absolute bottom-8 left-1/3 w-4 h-4 text-pink-200 opacity-70 animate-pulse" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
        <Star className="absolute top-1/2 right-1/4 w-3 h-3 text-cyan-200 opacity-60 fill-cyan-200 animate-pulse" style={{ animationDelay: "1.5s" }} />

        <div className="relative px-5 md:px-8 py-7 md:py-10">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-300" />
                </span>
                <p className="text-[10px] uppercase tracking-[0.25em] font-black text-white">
                  Live · {today}
                </p>
              </div>
              <h1 className="text-4xl md:text-6xl font-black mt-3 leading-[0.95]" style={{ letterSpacing: "-0.02em" }}>
                Today's
                <br />
                <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-300 bg-clip-text text-transparent inline-flex items-center gap-2">
                  Hot Deals
                  <Flame className="w-9 h-9 md:w-12 md:h-12 text-orange-300 fill-orange-400 drop-shadow-lg animate-pulse" />
                </span>
              </h1>
              <p className="text-sm md:text-lg text-white/90 mt-3 font-medium max-w-xl">
                {liveDeals.length === 0
                  ? "No offers running yet — tap New Deal to make today special. ✨"
                  : <>
                      <span className="font-black text-yellow-300">{liveDeals.length}</span>
                      {" "}limited-time offer{liveDeals.length !== 1 ? "s" : ""} live now at{" "}
                      <span className="font-bold">{store.name}</span>
                    </>
                  }
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowNew(true)}
                className="group flex items-center gap-2 px-5 md:px-6 py-3 md:py-3.5 rounded-full bg-white text-violet-700 font-black text-sm shadow-2xl hover:scale-105 active:scale-95 transition-transform relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-200/0 via-yellow-200/50 to-yellow-200/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Plus className="w-4 h-4 relative" />
                <span className="relative">New Deal</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative wave at bottom */}
        <svg viewBox="0 0 1440 60" className="absolute bottom-0 left-0 right-0 w-full h-8 md:h-10" preserveAspectRatio="none" aria-hidden>
          <path d="M0,32 C240,60 480,0 720,32 C960,60 1200,0 1440,32 L1440,60 L0,60 Z" className="fill-background" />
        </svg>
      </div>

      {/* ── Empty state ── */}
      {!isLoading && liveDeals.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
          <div className="text-8xl mb-5 animate-bounce" style={{ animationDuration: "3s" }}>🎉</div>
          <h2 className="text-2xl font-black mb-2">No deals running yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Tap <span className="font-bold text-violet-600">New Deal</span> to mark a product as today's special.
            Customers see it here, the cashier can add it to a bill in one tap.
          </p>
        </div>
      )}

      {/* ── Deal grid ── */}
      {liveDeals.length > 0 && (
        <div className="relative">
          {/* Subtle pattern background */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6 p-5 md:p-7">
            {liveDeals.map((p, i) => (
              <DealCard
                key={p.id}
                p={p}
                index={i}
                isAdmin={isAdmin}
                onAdd={() => handleAddToCart(p)}
                onCheckout={() => { handleAddToCart(p); setLocation("/checkout"); }}
                onEnd={() => handleEndDeal(p)}
              />
            ))}
          </div>

          {/* Tagline strip below grid */}
          <div className="text-center pb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-400/10 border border-violet-300/30">
              <Zap className="w-3.5 h-3.5 text-violet-600 fill-violet-500" />
              <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                Tap any card to add it to the next bill — discount auto-applied
              </span>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center p-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/* ── Single deal card ───────────────────────────────────────────── */
function DealCard({ p, index, isAdmin, onAdd, onCheckout, onEnd }: {
  p: DealProduct;
  index: number;
  isAdmin: boolean;
  onAdd: () => void;
  onCheckout: () => void;
  onEnd: () => void;
}) {
  const sale     = p.salePrice ?? p.price;
  const off      = offText(p);
  const offNum   = parseInt(off.split("%")[0] || "0", 10);
  const savings  = p.price - sale;
  const endsAt   = p.salePriceUntil ? new Date(p.salePriceUntil) : null;
  const today    = new Date(); today.setHours(23, 59, 59, 999);
  const endsToday = endsAt != null && endsAt.toDateString() === today.toDateString();
  const emoji    = getCategoryEmoji(p.category);
  const isHotDeal = offNum >= 30;
  const lowStock  = p.stock > 0 && p.stock <= 3;

  /* Vary the card accent palette by position so a row of cards feels alive.
     Each entry is full Tailwind class strings (not concatenated) so JIT
     can statically detect them. */
  const palettes = [
    {
      grad:  "from-fuchsia-500 via-pink-500 to-rose-500",
      soft:  "from-fuchsia-50 via-pink-50 to-rose-50 dark:from-fuchsia-950/30 dark:via-pink-950/30 dark:to-rose-950/30",
      glow:  "bg-fuchsia-500/30",
    },
    {
      grad:  "from-amber-500 via-orange-500 to-rose-500",
      soft:  "from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-rose-950/30",
      glow:  "bg-amber-500/30",
    },
    {
      grad:  "from-emerald-500 via-teal-500 to-cyan-500",
      soft:  "from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30",
      glow:  "bg-emerald-500/30",
    },
    {
      grad:  "from-violet-500 via-indigo-500 to-blue-500",
      soft:  "from-violet-50 via-indigo-50 to-blue-50 dark:from-violet-950/30 dark:via-indigo-950/30 dark:to-blue-950/30",
      glow:  "bg-violet-500/30",
    },
  ] as const;
  const c = palettes[index % palettes.length];

  return (
    <div className="group relative">
      {/* Animated gradient halo behind card */}
      <div className={`absolute -inset-1 bg-gradient-to-br ${c.grad} rounded-[28px] opacity-30 blur-md group-hover:opacity-70 transition-opacity duration-500`} />

      <div className={`relative bg-card border border-border rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl group-hover:-translate-y-1.5 transition-all duration-300`}>
        {/* HOT DEAL ribbon (top-left, when discount is big) */}
        {isHotDeal && (
          <div className="absolute -left-1 top-4 z-20">
            <div className={`relative bg-gradient-to-r ${c.grad} text-white px-3 py-1 text-[10px] font-black tracking-[0.2em] shadow-lg`}>
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 fill-yellow-200" /> HOT
              </span>
              {/* Triangle tail */}
              <span className="absolute -bottom-1 left-0 w-0 h-0 border-t-4 border-r-4 border-transparent border-t-black/40 border-r-transparent" />
            </div>
          </div>
        )}

        {/* End-deal X (admin) */}
        {isAdmin && (
          <button
            onClick={onEnd}
            className="absolute top-3 right-3 z-30 w-7 h-7 rounded-full bg-black/50 hover:bg-red-600 text-white flex items-center justify-center transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
            title="End deal"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Image / hero ── pastel gradient backdrop with pattern */}
        <div className={`aspect-[4/3] relative overflow-hidden bg-gradient-to-br ${c.soft} flex items-center justify-center`}>
          {/* Decorative dot pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "16px 16px",
              color: "rgba(0,0,0,0.06)",
            }}
          />
          {/* Big radial glow behind product */}
          <div className={`absolute inset-1/4 ${c.glow} rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700`} />
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="relative w-full h-full object-cover" />
          ) : (
            <span className="relative text-8xl drop-shadow-2xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">{emoji}</span>
          )}
          {/* Floating sparkles */}
          <Sparkles className="absolute top-4 left-4 w-4 h-4 text-yellow-400 fill-yellow-300 opacity-80 animate-pulse" />
          <Star className="absolute bottom-5 right-1/4 w-3 h-3 text-yellow-300 fill-yellow-300 opacity-70 animate-pulse" style={{ animationDelay: "0.6s" }} />
          <Star className="absolute top-1/3 right-6 w-2.5 h-2.5 text-pink-300 fill-pink-300 opacity-60 animate-pulse" style={{ animationDelay: "1.2s" }} />

          {/* Starburst % OFF sticker (replaces flat circle) */}
          <div className="absolute -bottom-6 right-4 z-20">
            <div className="relative">
              {/* Halo */}
              <div className={`absolute inset-0 ${c.glow} rounded-full blur-xl scale-125`} />
              {/* Starburst SVG */}
              <svg viewBox="0 0 100 100" className="relative w-20 h-20 drop-shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                <defs>
                  <linearGradient id={`grad-${p.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <polygon
                  points="50,3 56,20 73,12 67,30 86,30 72,42 88,52 70,55 80,72 62,68 60,86 50,72 40,86 38,68 20,72 30,55 12,52 28,42 14,30 33,30 27,12 44,20"
                  fill={`url(#grad-${p.id})`}
                />
              </svg>
              {/* Centered text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-black pointer-events-none">
                <span className="text-lg leading-none">{offNum}%</span>
                <span className="text-[8px] tracking-widest leading-none mt-0.5">OFF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 pt-7 space-y-3.5">
          <div>
            <h3 className="font-black text-base leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.sku}</p>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Today</span>
              <TrendingDown className="w-3 h-3 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-black bg-gradient-to-r ${c.grad} bg-clip-text text-transparent`}>
                ₹{sale.toLocaleString("en-IN")}
              </span>
              <span className="text-xs line-through text-muted-foreground">₹{p.price.toLocaleString("en-IN")}</span>
            </div>
            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
              <Sparkles className="w-2.5 h-2.5" />
              SAVE ₹{savings.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Time + stock pill row */}
          <div className="flex items-center justify-between text-[10px] font-bold pt-1 border-t border-dashed border-border">
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="w-3 h-3" />
              {endsToday
                ? "Ends tonight"
                : endsAt
                  ? `Until ${endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                  : "Limited time"}
            </span>
            <span className={`flex items-center gap-1 ${lowStock ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              <span className={`relative flex h-1.5 w-1.5`}>
                {lowStock && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${lowStock ? "bg-red-500" : p.stock > 5 ? "bg-emerald-500" : "bg-amber-500"}`} />
              </span>
              {lowStock ? `Only ${p.stock} left!` : `${p.stock} in stock`}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onAdd}
              disabled={p.stock <= 0}
              className="flex-1 h-11 rounded-xl border-2 border-violet-500 text-violet-600 dark:text-violet-300 font-black text-xs flex items-center justify-center gap-1.5 hover:bg-violet-500 hover:text-white active:scale-95 transition-all disabled:opacity-40"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Add
            </button>
            <button
              onClick={onCheckout}
              disabled={p.stock <= 0}
              className={`flex-1 h-11 rounded-xl bg-gradient-to-r ${c.grad} text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-40 relative overflow-hidden group/btn`}
            >
              <span className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/20 transition-colors" />
              <CheckCircle2 className="w-3.5 h-3.5 relative" />
              <span className="relative">Buy now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
