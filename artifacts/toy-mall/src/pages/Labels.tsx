import { useState, useEffect, useCallback } from "react";
import { Tag, Printer, Loader2, Search, Check, Package, Eye, Barcode, Plus, Minus, LayoutGrid, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LabelCard, type LabelProduct as Product } from "@/components/ui/LabelCard";
import { getCategoryEmoji, getCategoryHex } from "@/lib/category-colors";
import { useListProducts } from "@workspace/api-client-react";

type Columns = 3 | 4;
type LabelSize = "sm" | "md" | "lg";

const SIZE_LABELS: Record<LabelSize, string> = { sm: "Small", md: "Medium", lg: "Large" };

/* ═══════════════════════════════════════════════════════════════ */
export default function Labels() {
  const { data: productsData, isLoading: loading } = useListProducts();
  const products: Product[] = (productsData ?? []) as Product[];

  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [copies, setCopies]           = useState<Record<string, number>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [printing, setPrinting]       = useState(false);
  const [columns, setColumns]         = useState<Columns>(3);
  const [labelSize, setLabelSize]     = useState<LabelSize>("md");
  const [showTip, setShowTip]         = useState(true);

  useEffect(() => {
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const filtered = products.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getCopies = (id: string) => copies[id] ?? 1;

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setShowPreview(false);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) { setSelected(new Set()); }
    else { setSelected(new Set(filtered.map((p) => p.id))); }
    setShowPreview(false);
  };

  const setCopiesFor = (id: string, val: number) => {
    setCopies((c) => ({ ...c, [id]: Math.max(1, Math.min(99, val)) }));
  };

  const doPrint = useCallback(() => {
    setPrinting(true);
    setTimeout(() => window.print(), 300);
  }, []);

  const selectedProducts = products.filter((p) => selected.has(p.id));

  const printItems = selectedProducts.flatMap((p) =>
    Array.from({ length: getCopies(p.id) }, (_, i) => ({ ...p, _key: `${p.id}-${i}` }))
  );

  const totalLabels = selectedProducts.reduce((s, p) => s + getCopies(p.id), 0);

  /* Label card size → scale the card */
  const sizeScale: Record<LabelSize, number> = { sm: 0.78, md: 1, lg: 1.18 };

  return (
    <>
      {/* Print CSS — A4, no browser chrome */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          body * { visibility: hidden !important; }
          .labels-print-area, .labels-print-area * { visibility: visible !important; }
          .labels-print-area {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Hidden print area */}
      {printing && (
        <div className="labels-print-area fixed inset-0 hidden print:block bg-white">
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "6px",
            padding: "0",
          }}>
            {printItems.map((p) => (
              <div key={p._key} style={{ transform: `scale(${sizeScale[labelSize]})`, transformOrigin: "top center" }}>
                <LabelCard p={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Tag className="w-6 h-6 text-primary" /> Label Printer
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Select products · set copies · preview · print</p>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowPreview((v) => !v); }}
                  className="flex items-center gap-2 bg-muted border text-foreground px-3 py-2 rounded-full font-bold text-sm hover:bg-muted/70 active:scale-95 transition-all">
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button onClick={doPrint}
                  className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all">
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
                <b>Print tip:</b> In the print dialog → uncheck <b>"Headers and footers"</b> and set <b>Margins → None</b> for clean labels without the URL/date.
              </span>
              <button onClick={() => setShowTip(false)} className="font-black text-amber-600 hover:text-amber-800 ml-1">✕</button>
            </div>
          )}

          {/* Layout controls */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Columns */}
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground ml-1" />
              {([3, 4] as Columns[]).map((c) => (
                <button key={c} onClick={() => setColumns(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${columns === c ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {c} col
                </button>
              ))}
            </div>

            {/* Size */}
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              {(["sm", "md", "lg"] as LabelSize[]).map((s) => (
                <button key={s} onClick={() => setLabelSize(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${labelSize === s ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {SIZE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-muted/50 border-transparent" />
            </div>
            <button onClick={toggleAll}
              className="px-3 h-11 rounded-xl bg-muted text-xs font-bold hover:bg-muted/70 transition-colors whitespace-nowrap">
              {selected.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
            </button>
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-primary font-bold mt-2">
              {selected.size} product{selected.size !== 1 ? "s" : ""} · {totalLabels} label{totalLabels !== 1 ? "s" : ""} total
            </p>
          )}
        </div>

        {/* Label preview strip */}
        {showPreview && selectedProducts.length > 0 && (
          <div className="border-b bg-muted/30 px-4 py-4">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">
              <Barcode className="inline w-3.5 h-3.5 mr-1" />Print Preview — {totalLabels} label{totalLabels !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedProducts.map((p) => (
                <div key={p.id} className="shrink-0">
                  <LabelCard p={p} compact />
                  {getCopies(p.id) > 1 && (
                    <p className="text-center text-[10px] font-bold text-primary mt-1">×{getCopies(p.id)}</p>
                  )}
                </div>
              ))}
            </div>
            <button onClick={doPrint}
              className="mt-3 flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all">
              <Printer className="w-4 h-4" />
              Print {totalLabels} Label{totalLabels !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Product list */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
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
                  <div key={p.id}
                    className={`flex items-center gap-3 p-4 md:px-6 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                    {/* Checkbox area */}
                    <button onClick={() => toggle(p.id)}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {isSelected ? <Check className="w-5 h-5 text-primary-foreground" /> : <Tag className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    {/* Product info */}
                    <button onClick={() => toggle(p.id)} className="flex-1 min-w-0 text-left">
                      <p className={`font-bold truncate ${isSelected ? "text-primary" : ""}`}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{p.sku}</span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: hex.badge, color: hex.text }}>
                          {emoji} {p.category}
                        </span>
                      </div>
                    </button>

                    {/* Price + copies */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="font-black text-sm">₹{p.price.toLocaleString("en-IN")}</p>
                      {isSelected && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setCopiesFor(p.id, n - 1)}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 active:scale-90 transition-all">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1} max={99}
                            value={n}
                            onChange={(e) => setCopiesFor(p.id, parseInt(e.target.value) || 1)}
                            className="w-9 text-center text-xs font-black border rounded-lg h-6 bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => setCopiesFor(p.id, n + 1)}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 active:scale-90 transition-all">
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
