import { useState, useEffect } from "react";
import { Tag, Printer, Loader2, Search, Check, Package, Eye, Barcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCategoryEmoji, getCategoryHex } from "@/lib/category-colors";
import { BarcodeImage } from "@/components/ui/BarcodeImage";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Product { id: string; name: string; sku: string; price: number; category: string; stock: number; }

/* ── Single printed label card ─────────────────────────────────── */
function PrintLabel({ p }: { p: Product }) {
  return (
    <div style={{ background: "#ffffff", pageBreakInside: "avoid", padding: "6px 4px" }}>
      <BarcodeImage value={p.sku} height={60} fontSize={11} />
    </div>
  );
}

/* ── On-screen label preview card ──────────────────────────────── */
function PreviewCard({ p }: { p: Product }) {
  const hex = getCategoryHex(p.category);
  const emoji = getCategoryEmoji(p.category);
  const store = useStoreSettings();
  return (
    <div className="rounded-2xl overflow-hidden border shadow-md bg-white" style={{ width: 160 }}>
      <div style={{ background: hex.strip }} className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[9px] font-black text-white tracking-tight">{store.name.split(" ")[0]}</span>
        <span className="text-sm">{emoji}</span>
      </div>
      <div className="p-2 text-center flex flex-col items-center gap-1">
        <span
          className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{ background: hex.badge, color: hex.text }}>
          {p.category}
        </span>
        <div className="w-full bg-white py-1">
          <BarcodeImage value={p.sku} height={44} fontSize={9} className="w-full" />
        </div>
        <p className="text-[10px] font-bold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
        <div className="w-full border-t-2 my-0.5" style={{ borderColor: hex.strip }} />
        <p className="text-base font-black text-gray-900">₹{p.price.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Labels() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/products`)
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setShowPreview(false);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) { setSelected(new Set()); }
    else { setSelected(new Set(filtered.map((p) => p.id))); }
    setShowPreview(false);
  };

  const generateAndAct = (andPrint = false) => {
    setShowPreview(false);
    if (andPrint) { setShowPrint(true); setTimeout(() => window.print(), 300); }
    else { setShowPreview(true); }
  };

  const selectedProducts = products.filter((p) => selected.has(p.id));

  return (
    <>
      {/* Print-only CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .labels-print-area, .labels-print-area * { visibility: visible !important; }
          .labels-print-area {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 16px !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Hidden print area */}
      {showPrint && (
        <div className="labels-print-area fixed inset-0 hidden print:block bg-white p-4">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {selectedProducts.map((p) => (
              <PrintLabel key={p.id} p={p} />
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
              <p className="text-xs text-muted-foreground mt-0.5">Select products · preview · print barcode shelf labels</p>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => generateAndAct(false)}
                  className="flex items-center gap-2 bg-muted border text-foreground px-3 py-2 rounded-full font-bold text-sm hover:bg-muted/70 active:scale-95 transition-all">
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button onClick={() => generateAndAct(true)}
                  className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all">
                  <Printer className="w-4 h-4" />
                  Print {selected.size}
                </button>
              </div>
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
            <p className="text-xs text-primary font-bold mt-2">{selected.size} product{selected.size !== 1 ? "s" : ""} selected</p>
          )}
        </div>

        {/* Label preview strip */}
        {showPreview && selectedProducts.length > 0 && (
          <div className="border-b bg-muted/30 px-4 py-4">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">
              <Barcode className="inline w-3.5 h-3.5 mr-1" />Label Preview
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedProducts.map((p) => (
                <div key={p.id} className="shrink-0">
                  <PreviewCard p={p} />
                </div>
              ))}
            </div>
            <button onClick={() => generateAndAct(true)}
              className="mt-3 flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all">
              <Printer className="w-4 h-4" />
              Print {selected.size} Label{selected.size !== 1 ? "s" : ""}
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
                return (
                  <button key={p.id} onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-4 p-4 md:px-6 transition-colors text-left ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {isSelected ? <Check className="w-5 h-5 text-primary-foreground" /> : <Tag className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${isSelected ? "text-primary" : ""}`}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{p.sku}</span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: hex.badge, color: hex.text }}>
                          {emoji} {p.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm">₹{p.price.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
