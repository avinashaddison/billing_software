import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Tag, Printer, Loader2, Search, Check, Package, Eye, Plus, Minus, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LabelCard, type LabelProduct as Product } from "@/components/ui/LabelCard";
import { getCategoryEmoji, getCategoryHex } from "@/lib/category-colors";
import { useListProducts } from "@workspace/api-client-react";

/* 80×50mm at 96dpi (1mm ≈ 3.78px) — used for on-screen preview */
const LABEL_W_PX = Math.round(80 * 3.78);
const LABEL_H_PX = Math.round(50 * 3.78);

export default function Labels() {
  const { data: productsData, isLoading: loading } = useListProducts();
  const products: Product[] = (productsData ?? []) as Product[];

  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [copies, setCopies]           = useState<Record<string, number>>({});
  const [printing, setPrinting]       = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTip, setShowTip]         = useState(true);

  /* Trigger window.print() only after the portal is committed + painted */
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

  const filtered = products.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getCopies    = (id: string) => copies[id] ?? 1;
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

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @page { size: 80mm 50mm; margin: 0; }
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
            width: 80mm !important; height: 50mm !important;
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

      {/* ── Print portal — direct child of <body> so the CSS selector works ── */}
      {printing && createPortal(
        <div className="labels-print-area" style={{
          position: "fixed", top: "-200vh", left: 0, width: "80mm",
          background: "white",
        }}>
          {printItems.map((p) => (
            <div key={p._key} className="label-page">
              <LabelCard p={p} printMode />
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
              <p className="text-xs text-muted-foreground mt-0.5">80×50mm price tag labels · one per product</p>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
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
              </div>
            )}
          </div>

          {/* Print tip */}
          {showTip && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 mb-3 text-xs text-amber-800 dark:text-amber-300">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">
                <b>Print settings:</b> set <b>Margins → None</b>, uncheck <b>Headers and footers</b>, keep <b>Background graphics ON</b> (for the black sale price box).
                Each label prints on its own 80×50mm sticker.
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

          {selected.size > 0 && (
            <p className="text-xs text-primary font-bold mt-2">
              {selected.size} product{selected.size !== 1 ? "s" : ""} · {totalLabels} sticker{totalLabels !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* ── Label preview (actual 50×25mm size on screen) ── */}
        {showPreview && printItems.length > 0 && (
          <div className="border-b bg-slate-100 dark:bg-slate-900 px-4 py-4">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              Preview — actual label size
            </p>
            <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto">
              {printItems.map((p) => (
                <div
                  key={p._key}
                  style={{
                    width: LABEL_W_PX,
                    height: LABEL_H_PX,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <LabelCard p={p} printMode />
                </div>
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
    </>
  );
}
