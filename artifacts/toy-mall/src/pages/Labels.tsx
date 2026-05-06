import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Tag, Printer, Loader2, Search, Check, Package, Eye, Barcode, Plus, Minus, LayoutGrid, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LabelCard, type LabelProduct as Product } from "@/components/ui/LabelCard";
import { getCategoryEmoji, getCategoryHex } from "@/lib/category-colors";
import { useListProducts } from "@workspace/api-client-react";

type Columns = 2 | 3 | 4;
type LabelSize = "sm" | "md" | "lg";

const SIZE_LABELS: Record<LabelSize, string> = { sm: "Small", md: "Medium", lg: "Large" };

/* A4 printable area (mm) with 10mm margins: 190 × 277 */
const LABEL_HEIGHT_MM: Record<LabelSize, number> = { sm: 42, md: 52, lg: 64 };
const GAP_MM = 4;

function rowsPerPage(size: LabelSize): number {
  const h = LABEL_HEIGHT_MM[size];
  return Math.floor((277 + GAP_MM) / (h + GAP_MM));
}

function labelsPerPage(cols: Columns, size: LabelSize): number {
  return cols * rowsPerPage(size);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

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
  const [previewPage, setPreviewPage] = useState(0);

  /* Trigger window.print() only after the portal is committed + painted */
  useEffect(() => {
    if (!printing) return;
    const raf = requestAnimationFrame(() => {
      window.print();
    });
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

  const getCopies  = (id: string) => copies[id] ?? 1;
  const toggle     = (id: string) => { setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); setShowPreview(false); setPreviewPage(0); };
  const toggleAll  = () => { if (selected.size === filtered.length) { setSelected(new Set()); } else { setSelected(new Set(filtered.map((p) => p.id))); } setShowPreview(false); setPreviewPage(0); };
  const setCopiesFor = (id: string, val: number) => setCopies((c) => ({ ...c, [id]: Math.max(1, Math.min(99, val)) }));

  const doPrint = useCallback(() => setPrinting(true), []);

  const selectedProducts = products.filter((p) => selected.has(p.id));
  const printItems = selectedProducts.flatMap((p) => Array.from({ length: getCopies(p.id) }, (_, i) => ({ ...p, _key: `${p.id}-${i}` })));
  const totalLabels = selectedProducts.reduce((s, p) => s + getCopies(p.id), 0);

  const perPage = labelsPerPage(columns, labelSize);
  const pages   = useMemo(() => chunkArray(printItems, perPage), [printItems, perPage]);
  const totalPages = pages.length;

  /* Label pixel height for screen preview (1mm ≈ 3.78px at 96dpi) */
  const labelPxH = Math.round(LABEL_HEIGHT_MM[labelSize] * 3.78);
  /* A4 preview card: 190mm × 277mm at reduced scale */
  const previewScale = 0.48;
  const a4W = Math.round(190 * 3.78 * previewScale);
  const a4H = Math.round(277 * 3.78 * previewScale);

  const colCss = `repeat(${columns}, 1fr)`;

  return (
    <>
      {/* ── Print CSS (injected into <head>) ── */}
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { height: auto !important; overflow: visible !important; }
          body > *:not(.labels-print-area) { display: none !important; }
          .labels-print-area {
            display: block !important;
            position: static !important;
            top: auto !important;
            left: auto !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            visibility: visible !important;
            margin: 0 !important; padding: 0 !important;
            background: white !important;
          }
          .print-page {
            display: grid;
            grid-template-columns: ${colCss};
            gap: ${GAP_MM}mm;
            width: 100%;
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child { page-break-after: avoid; break-after: avoid; }
          .print-cell {
            break-inside: avoid;
            page-break-inside: avoid;
            height: ${LABEL_HEIGHT_MM[labelSize]}mm;
            overflow: hidden;
          }
        }
      `}</style>

      {/* ── Print portal — rendered directly on <body> so CSS selector works ── */}
      {printing && createPortal(
        <div className="labels-print-area" style={{
          position: "fixed", top: "-200vh", left: 0, width: "210mm",
          background: "white", overflow: "hidden",
        }}>
          {pages.map((page, pi) => (
            <div key={pi} className="print-page">
              {page.map((p) => (
                <div key={p._key} className="print-cell">
                  <LabelCard p={p} printMode />
                </div>
              ))}
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
              <p className="text-xs text-muted-foreground mt-0.5">Select products · set copies · preview · print</p>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowPreview((v) => !v); setPreviewPage(0); }}
                  className="flex items-center gap-2 bg-muted border text-foreground px-3 py-2 rounded-full font-bold text-sm hover:bg-muted/70 active:scale-95 transition-all">
                  <Eye className="w-4 h-4" />
                  {showPreview ? "Hide Preview" : "Preview"}
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
                <b>Print tip:</b> In the print dialog → uncheck <b>"Headers and footers"</b>, set <b>Margins → None</b>, and enable <b>"Background graphics"</b> for coloured label strips.
              </span>
              <button onClick={() => setShowTip(false)} className="font-black text-amber-600 hover:text-amber-800 ml-1">✕</button>
            </div>
          )}

          {/* Layout controls */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground ml-1" />
              {([2, 3, 4] as Columns[]).map((c) => (
                <button key={c} onClick={() => { setColumns(c); setPreviewPage(0); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${columns === c ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {c} col
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              {(["sm", "md", "lg"] as LabelSize[]).map((s) => (
                <button key={s} onClick={() => { setLabelSize(s); setPreviewPage(0); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${labelSize === s ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {SIZE_LABELS[s]}
                </button>
              ))}
            </div>
            {totalPages > 0 && (
              <span className="text-xs text-muted-foreground font-medium ml-1">
                {totalLabels} label{totalLabels !== 1 ? "s" : ""} · {totalPages} page{totalPages !== 1 ? "s" : ""}
              </span>
            )}
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
              {selected.size} product{selected.size !== 1 ? "s" : ""} · {totalLabels} label{totalLabels !== 1 ? "s" : ""} · {totalPages} A4 page{totalPages !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* ── Page-by-page preview ── */}
        {showPreview && pages.length > 0 && (
          <div className="border-b bg-slate-100 dark:bg-slate-900 px-4 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5" />
                Print Preview — Page {previewPage + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button disabled={previewPage === 0} onClick={() => setPreviewPage((p) => p - 1)}
                      className="w-7 h-7 rounded-full bg-background border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold w-16 text-center text-muted-foreground">
                      {previewPage + 1} / {totalPages}
                    </span>
                    <button disabled={previewPage === totalPages - 1} onClick={() => setPreviewPage((p) => p + 1)}
                      className="w-7 h-7 rounded-full bg-background border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button onClick={doPrint}
                  className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all">
                  <Printer className="w-4 h-4" />
                  Print All {totalLabels}
                </button>
              </div>
            </div>

            {/* A4 paper mockup */}
            <div className="flex justify-center">
              <div
                style={{
                  width: a4W,
                  height: a4H,
                  background: "#fff",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                  borderRadius: 4,
                  padding: Math.round(10 * 3.78 * previewScale),
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: Math.round(GAP_MM * 3.78 * previewScale),
                    width: "100%",
                    height: "100%",
                    alignContent: "start",
                  }}
                >
                  {pages[previewPage].map((p) => (
                    <div key={p._key} style={{ height: Math.round(labelPxH * previewScale), overflow: "hidden" }}>
                      <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left",
                        width: `${100 / previewScale}%` }}>
                        <LabelCard p={p} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Page number watermark */}
                <div style={{
                  position: "absolute", bottom: 6, right: 10,
                  fontSize: 9, color: "#9ca3af", fontFamily: "monospace",
                }}>
                  {previewPage + 1}/{totalPages}
                </div>
              </div>
            </div>

            {/* Dot pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {pages.map((_, i) => (
                  <button key={i} onClick={() => setPreviewPage(i)}
                    className={`rounded-full transition-all ${i === previewPage ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Product list ── */}
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
                    <button onClick={() => toggle(p.id)}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {isSelected ? <Check className="w-5 h-5 text-primary-foreground" /> : <Tag className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => toggle(p.id)} className="flex-1 min-w-0 text-left">
                      <p className={`font-bold truncate ${isSelected ? "text-primary" : ""}`}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{p.sku}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: hex.badge, color: hex.text }}>
                          {emoji} {p.category}
                        </span>
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="font-black text-sm">₹{Number(p.price).toLocaleString("en-IN")}</p>
                      {isSelected && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setCopiesFor(p.id, n - 1)}
                            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 active:scale-90 transition-all">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input type="number" min={1} max={99} value={n}
                            onChange={(e) => setCopiesFor(p.id, parseInt(e.target.value) || 1)}
                            className="w-9 text-center text-xs font-black border rounded-lg h-6 bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                          <button onClick={() => setCopiesFor(p.id, n + 1)}
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
