import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Tag, Printer, Loader2, Search, Check, Package, Eye, Plus, Minus, Info, DollarSign, Ruler, X, ZoomIn, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LabelCard, type LabelProduct as Product } from "@/components/ui/LabelCard";
import { getCategoryEmoji, getCategoryHex } from "@/lib/category-colors";
import { useListProducts } from "@workspace/api-client-react";
import { useStoreSettings } from "@/lib/store-info";
import { MM_TO_PX, LABEL_PRESETS, loadLabelSize, saveLabelSize, isPresetSize as isPreset, type LabelSize } from "@/lib/label-size";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Labels() {
  const { data: productsData, isLoading: loading } = useListProducts();
  const products: Product[] = (productsData ?? []) as Product[];
  const store = useStoreSettings();

  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [copies, setCopies]           = useState<Record<string, number>>({});
  const [printing, setPrinting]       = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTip, setShowTip]         = useState(true);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [zoomedProduct, setZoomedProduct] = useState<(Product & { _key: string }) | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [addedDateFilter, setAddedDateFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/suppliers`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSuppliers(Array.isArray(d) ? d.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) : []))
      .catch(() => {});
  }, []);

  const [labelSize, setLabelSizeState]   = useState<LabelSize>(loadLabelSize);
  const [customW, setCustomW]            = useState(String(labelSize.w));
  const [customH, setCustomH]            = useState(String(labelSize.h));

  const setLabelSize = useCallback((size: LabelSize) => {
    setLabelSizeState(size);
    saveLabelSize(size);
    setCustomW(String(size.w));
    setCustomH(String(size.h));
  }, []);

  const applyCustom = useCallback(() => {
    const w = Math.min(200, Math.max(10, parseFloat(customW) || 0));
    const h = Math.min(200, Math.max(10, parseFloat(customH) || 0));
    if (w >= 10 && h >= 10) setLabelSize({ w, h });
  }, [customW, customH, setLabelSize]);

  const labelWpx = Math.round(labelSize.w * MM_TO_PX);
  const labelHpx = Math.round(labelSize.h * MM_TO_PX);

  useEffect(() => {
    if (!printing) return;
    const raf = requestAnimationFrame(() => { window.print(); });
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printing]);

  const categoryOptions = Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b));

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesStock =
      stockFilter === "all" ? true :
      stockFilter === "in" ? Number(p.stock ?? 0) > 0 :
      stockFilter === "out" ? Number(p.stock ?? 0) <= 0 :
      Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? 0);
    const createdAt = (p as { createdAt?: string }).createdAt;
    const matchesDate =
      !addedDateFilter ? true :
      createdAt ? new Date(createdAt).toISOString().slice(0, 10) === addedDateFilter : true;
    const sid = (p as { supplierId?: string | null }).supplierId;
    const matchesSupplier =
      supplierFilter === "all" ? true :
      supplierFilter === "__none__" ? !sid : sid === supplierFilter;

    return matchesSearch && matchesCategory && matchesStock && matchesDate && matchesSupplier;
  });

  const getDefaultCopies = (id: string) => {
    const p = products.find((x) => x.id === id);
    const stock = Number(p?.stock ?? 0);
    return Math.max(1, Math.min(99, stock || 1));
  };
  const getCopies    = (id: string) => copies[id] ?? getDefaultCopies(id);
  const toggle       = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll    = () => {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };
  const setCopiesFor = (id: string, val: number) => setCopies((c) => ({ ...c, [id]: Math.max(1, Math.min(99, val)) }));
  const doPrint      = useCallback(() => setPrinting(true), []);

  const selectedProducts = products.filter((p) => selected.has(p.id));
  const printItems = selectedProducts.flatMap((p) =>
    Array.from({ length: getCopies(p.id) }, (_, i) => ({ ...p, _key: `${p.id}-${i}` }))
  );
  const totalLabels = selectedProducts.reduce((s, p) => s + getCopies(p.id), 0);
  const showPrice   = store.labelShowPrice ?? true;

  const currentPresetLabel = LABEL_PRESETS.find((p) => p.w === labelSize.w && p.h === labelSize.h)?.label
    ?? `${labelSize.w}×${labelSize.h}mm`;

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @page { size: ${labelSize.w}mm ${labelSize.h}mm; margin: 1mm 0 0 0; }
        @media print {
          html, body { height: auto !important; overflow: visible !important; }
          body > *:not(.labels-print-area) { display: none !important; }
          .labels-print-area {
            display: block !important;
            position: static !important; top: auto !important; left: auto !important;
            width: 100% !important; height: auto !important;
            overflow: visible !important; visibility: visible !important;
            margin: 0 !important; padding: 0 !important; background: white !important;
          }
          .label-page {
            display: block !important;
            width: ${labelSize.w}mm !important; height: ${labelSize.h - 1}mm !important;
            page-break-after: always !important; break-after: page !important;
            overflow: hidden !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .label-page:last-child {
            page-break-after: avoid !important; break-after: avoid !important;
          }
        }
      `}</style>

      {/* ── Print portal ── */}
      {printing && createPortal(
        <div className="labels-print-area" style={{
          position: "fixed", top: "-200vh", left: 0, width: `${labelSize.w}mm`,
          background: "white",
        }}>
          {printItems.map((p) => (
            <div key={p._key} className="label-page" style={{ width: `${labelSize.w}mm`, height: `${labelSize.h - 1}mm` }}>
              <LabelCard p={p} printMode widthMm={labelSize.w} heightMm={labelSize.h} />
            </div>
          ))}
        </div>,
        document.body
      )}

      <div className="flex flex-col h-full bg-background">

        {/* ── Header ── */}
        <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Tag className="w-6 h-6 text-primary" /> Label Printer
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">{currentPresetLabel} sticker labels · one per product</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Label size picker */}
              <div className="relative">
                <button
                  onClick={() => setShowSizePicker((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full border font-bold text-sm transition-all ${
                    showSizePicker
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted border-muted-foreground/20 text-muted-foreground hover:text-foreground"
                  }`}
                  title="Choose label size"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  {currentPresetLabel}
                </button>

                {showSizePicker && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-popover border border-border rounded-2xl shadow-xl p-4 w-64">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Label Size</p>

                    {/* Preset buttons */}
                    <div className="flex flex-col gap-1.5 mb-4">
                      {LABEL_PRESETS.map((preset) => {
                        const active = labelSize.w === preset.w && labelSize.h === preset.h;
                        return (
                          <button
                            key={preset.label}
                            onClick={() => { setLabelSize({ w: preset.w, h: preset.h }); setShowSizePicker(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl border font-bold text-sm transition-all ${
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <span>{preset.label}</span>
                            {active && <Check className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom size inputs */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-2">Custom size (mm)</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">Width</label>
                          <Input
                            type="number"
                            min={10} max={200}
                            value={customW}
                            onChange={(e) => { setCustomW(e.target.value); }}
                            onBlur={applyCustom}
                            className="h-9 text-sm font-bold rounded-xl [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="50"
                          />
                        </div>
                        <span className="text-muted-foreground font-bold mt-4">×</span>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground font-bold block mb-0.5">Height</label>
                          <Input
                            type="number"
                            min={10} max={200}
                            value={customH}
                            onChange={(e) => { setCustomH(e.target.value); }}
                            onBlur={applyCustom}
                            className="h-9 text-sm font-bold rounded-xl [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="25"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => { applyCustom(); setShowSizePicker(false); }}
                        className="w-full mt-2 py-2 rounded-xl bg-muted hover:bg-muted/70 font-bold text-sm transition-colors"
                      >
                        Apply custom size
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Price toggle */}
              <button
                onClick={() => store.update({ labelShowPrice: !showPrice })}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border font-bold text-sm transition-all ${
                  showPrice
                    ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400"
                    : "bg-muted border-muted-foreground/20 text-muted-foreground"
                }`}
                title={showPrice ? "Price visible on labels — click to hide" : "Price hidden — click to show"}
              >
                <DollarSign className="w-3.5 h-3.5" />
                {showPrice ? "Price ON" : "Price OFF"}
              </button>

              {selected.size > 0 && (
                <>
                  <button
                    onClick={() => setShowPreview((v) => !v)}
                    className="flex items-center gap-2 bg-muted border text-foreground px-3 py-2 rounded-full font-bold text-sm hover:bg-muted/70 active:scale-95 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    {showPreview ? "Hide" : "Preview"}
                  </button>
                  <button
                    onClick={doPrint}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    Print {totalLabels}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Print tip */}
          {showTip && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 mb-3 text-xs text-amber-800 dark:text-amber-300">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">
                <b>Print settings:</b> set <b>Margins → None</b> and uncheck <b>Headers and footers</b>.
                Each label prints on its own {currentPresetLabel} sticker.
              </span>
              <button onClick={() => setShowTip(false)} className="font-black text-amber-600 hover:text-amber-800 ml-1">✕</button>
            </div>
          )}

          {/* Search + select all */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-muted/50 border-transparent"
              />
            </div>
            <button
              onClick={toggleAll}
              className="px-3 h-11 rounded-xl bg-muted text-xs font-bold hover:bg-muted/70 transition-colors whitespace-nowrap"
            >
              {selected.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground px-2 py-1 rounded-md bg-muted/50 border">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-2.5 text-xs font-semibold"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as "all" | "in" | "low" | "out")}
              className="h-9 rounded-lg border bg-background px-2.5 text-xs font-semibold"
            >
              <option value="all">All Stock</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>

            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-2.5 text-xs font-semibold"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__none__">No Supplier</option>
            </select>

            <Input
              type="date"
              value={addedDateFilter}
              onChange={(e) => setAddedDateFilter(e.target.value)}
              className="h-9 w-[170px] rounded-lg text-xs md:min-w-[170px]"
              title="Filter by product added date"
            />

            <button
              type="button"
              onClick={() => { setCategoryFilter("all"); setStockFilter("all"); setAddedDateFilter(""); setSupplierFilter("all"); }}
              className="h-9 px-3 rounded-lg border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Clear
            </button>
          </div>

          {selected.size > 0 && (
            <p className="text-xs text-primary font-bold mt-2">
              {selected.size} product{selected.size !== 1 ? "s" : ""} · {totalLabels} sticker{totalLabels !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* ── Label preview (actual size on screen) ── */}
        {showPreview && printItems.length > 0 && (
          <div className="border-b bg-slate-100 dark:bg-slate-900 px-4 py-4">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <ZoomIn className="w-3 h-3" />
              Preview — tap a label to zoom ({currentPresetLabel})
            </p>
            <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto">
              {printItems.map((p) => (
                <button
                  key={p._key}
                  onClick={() => setZoomedProduct(p)}
                  title="Tap to zoom"
                  style={{
                    width: labelWpx,
                    height: labelHpx,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  className="hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all"
                >
                  <LabelCard p={p} printMode widthMm={labelSize.w} heightMm={labelSize.h} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Product list ── */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
              <Package className="w-12 h-12 opacity-30 mb-3" />
              <p className="font-bold">No products found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p) => {
                const isSelected = selected.has(p.id);
                const hex = getCategoryHex(p.category);
                const emoji = getCategoryEmoji(p.category);
                const n = getCopies(p.id);
                const stock = Number(p.stock ?? 0);
                const low = stock <= Number(p.lowStockThreshold ?? 0);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-4 md:px-6 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <button
                      onClick={() => toggle(p.id)}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}
                    >
                      {isSelected
                        ? <Check className="w-5 h-5 text-primary-foreground" />
                        : <Tag className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    <button onClick={() => toggle(p.id)} className="flex-1 min-w-0 text-left">
                      <p className={`font-bold truncate ${isSelected ? "text-primary" : ""}`}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{p.sku}</span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: hex.badge, color: hex.text }}
                        >
                          {emoji} {p.category}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${low ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>
                          Stock {stock}
                        </span>
                      </div>
                    </button>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="font-black text-sm">₹{Number(p.price).toLocaleString("en-IN")}</p>
                      {isSelected && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setCopiesFor(p.id, n - 1)}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 active:scale-90 transition-all"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number" min={1} max={99} value={n}
                            onChange={(e) => setCopiesFor(p.id, parseInt(e.target.value) || 1)}
                            className="w-9 text-center text-xs font-black border rounded-lg h-6 bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => setCopiesFor(p.id, n + 1)}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 active:scale-90 transition-all"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Close size picker on outside click ── */}
      {showSizePicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSizePicker(false)}
        />
      )}

      {/* ── Zoomed label preview modal ── */}
      {zoomedProduct && createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setZoomedProduct(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl flex flex-col w-full max-w-sm"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div className="min-w-0">
                <p className="font-black text-sm truncate">{zoomedProduct.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{zoomedProduct.sku}</p>
              </div>
              <button
                onClick={() => setZoomedProduct(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors ml-3 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scaled label — scrollable so nothing clips on narrow screens */}
            <div
              className="overflow-auto bg-slate-100 dark:bg-slate-900"
              style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
            >
              {/* This wrapper has the actual scaled dimensions so the scroll
                  container knows the true extent of the content */}
              <div style={{
                width: labelWpx * 2.5 + 48,
                height: labelHpx * 2.5 + 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {/* Transform origin top-left on a positioned box avoids any
                    clipping — the wrapper above provides layout space */}
                <div style={{ position: "relative", width: labelWpx * 2.5, height: labelHpx * 2.5 }}>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transformOrigin: "top left",
                    transform: "scale(2.5)",
                    width: labelWpx,
                    height: labelHpx,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                  }}>
                    <LabelCard p={zoomedProduct} printMode widthMm={labelSize.w} heightMm={labelSize.h} />
                  </div>
                </div>
              </div>
            </div>

            {/* Size badge */}
            <div className="flex items-center justify-center gap-2 py-2 border-t border-b bg-muted/30 shrink-0">
              <span className="text-xs text-muted-foreground font-bold">
                {currentPresetLabel} · 2.5× zoom · scroll to see full label
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 shrink-0">
              <button
                onClick={() => setZoomedProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-bold hover:bg-muted/70 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => { setZoomedProduct(null); doPrint(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-neutral-800 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                Print {totalLabels}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
