import { useState, useEffect } from "react";
import { Tag, Printer, Loader2, Search, Check, Package } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Product { id: string; name: string; sku: string; price: number; category: string; stock: number; }
interface QrData   { sku: string; url: string; qrDataUrl: string; }

export default function Labels() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [qrMap, setQrMap]         = useState<Record<string, QrData>>({});
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

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
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const generateAndPrint = async () => {
    const toGenerate = products.filter((p) => selected.has(p.id));
    setGenerating(true);
    const results: Record<string, QrData> = { ...qrMap };
    for (const p of toGenerate) {
      if (results[p.id]) continue;
      try {
        const r = await fetch(`${BASE_URL}/api/products/${p.id}/qr`);
        results[p.id] = await r.json();
      } catch { /* skip */ }
    }
    setQrMap(results);
    setGenerating(false);
    setShowPrint(true);
    setTimeout(() => window.print(), 300);
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {selectedProducts.map((p) => {
              const qr = qrMap[p.id];
              return (
                <div key={p.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, fontFamily: "'Courier New', monospace", textAlign: "center" }}>
                  {qr && <img src={qr.qrDataUrl} alt={p.sku} style={{ width: 100, height: 100, margin: "0 auto 8px" }} />}
                  <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 2 }}>{p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name}</div>
                  <div style={{ fontSize: 10, color: "#666", letterSpacing: 2, marginBottom: 4 }}>{p.sku}</div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>₹{p.price.toLocaleString("en-IN")}</div>
                  <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>VishwaKarma Complex</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col h-full bg-background">
        <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Tag className="w-6 h-6 text-primary" /> Label Printer
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Select products · generate QR shelf labels</p>
            </div>
            {selected.size > 0 && (
              <button onClick={generateAndPrint} disabled={generating}
                className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-full font-bold text-sm hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Print {selected.size} Label{selected.size !== 1 ? "s" : ""}
              </button>
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
                return (
                  <button key={p.id} onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-4 p-4 md:px-6 transition-colors text-left ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                      {isSelected ? <Check className="w-5 h-5 text-primary-foreground" /> : <Tag className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${isSelected ? "text-primary" : ""}`}>{p.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{p.sku} · {p.category}</p>
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
