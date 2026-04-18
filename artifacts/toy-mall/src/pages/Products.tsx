import { useState, useRef, memo } from "react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Package, Search, Plus, AlertTriangle, Upload, X, Loader2, Check, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getCategoryStyle, getCategoryEmoji } from "@/lib/category-colors";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ImportRow = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: ImportRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

function CsvImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed]     = useState<{ headers: string[]; rows: ImportRow[] } | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState<{ updated: number; skipped: number } | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setParsed(parseCsv(text));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImporting(true);
    try {
      const items = parsed.rows.map((row) => ({
        sku:               (row.sku || row.SKU || "").trim().toUpperCase(),
        name:              row.name || row.Name,
        category:          row.category || row.Category,
        price:             row.price || row.Price,
        stock:             row.stock || row.Stock,
        lowStockThreshold: row.lowStockThreshold || row.low_stock_threshold,
      }));
      const r = await fetch(`${BASE_URL}/api/products/bulk-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await r.json();
      setResult(data);
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast.success(`Import done: ${data.updated} updated, ${data.skipped} skipped`);
    } catch {
      toast.error("Import failed");
    } finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl bg-background rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-black text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Bulk CSV Import
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {!parsed ? (
            <>
              {/* Template hint */}
              <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1">
                <p className="font-bold text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> CSV must have a <code className="bg-muted px-1 rounded">sku</code> column. Optional: name, category, price, stock, lowStockThreshold</p>
                <p className="text-muted-foreground">Only existing SKUs are updated. New SKUs are skipped.</p>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-bold text-muted-foreground">Drop CSV file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>
            </>
          ) : (
            <>
              {/* Preview */}
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-600" />
                <span className="font-bold">{fileName}</span>
                <span className="text-muted-foreground">· {parsed.rows.length} rows</span>
                <button onClick={() => { setParsed(null); setFileName(""); setResult(null); }}
                  className="ml-auto text-xs text-muted-foreground hover:text-destructive">Change file</button>
              </div>

              {parsed.rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {parsed.headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          {parsed.headers.map((h) => (
                            <td key={h} className="px-3 py-2 font-mono">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                      {parsed.rows.length > 5 && (
                        <tr>
                          <td colSpan={parsed.headers.length} className="px-3 py-2 text-muted-foreground text-center">
                            …and {parsed.rows.length - 5} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {result && (
                <div className="flex gap-3">
                  <div className="flex-1 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-center">
                    <p className="text-2xl font-black text-green-700 dark:text-green-400">{result.updated}</p>
                    <p className="text-xs font-bold text-green-600 dark:text-green-400">Updated</p>
                  </div>
                  <div className="flex-1 p-3 rounded-xl bg-muted border text-center">
                    <p className="text-2xl font-black">{result.skipped}</p>
                    <p className="text-xs font-bold text-muted-foreground">Skipped</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t">
          {parsed && !result && (
            <button onClick={handleImport} disabled={importing || parsed.rows.length === 0}
              className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : `Import ${parsed.rows.length} Row${parsed.rows.length !== 1 ? "s" : ""}`}
            </button>
          )}
          {result && (
            <button onClick={onClose} className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-black text-sm">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Memoized product rows — skips re-render if props unchanged ── */
interface ProductRowProps {
  product: { id: string; name: string; sku: string; category: string; price: number; stock: number; lowStockThreshold: number; imageUrl?: string | null };
}
const ProductMobileCard = memo(function ProductMobileCard({ product }: ProductRowProps) {
  const cs = getCategoryStyle(product.category);
  const emoji = getCategoryEmoji(product.category);
  const isLow = product.stock <= product.lowStockThreshold;
  return (
    <Link href={`/product?sku=${product.sku}`} className="block">
      <div className="p-4 rounded-xl border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all flex items-center justify-between relative overflow-hidden" data-testid={`card-product-${product.id}`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${cs.dot}`} />
        <div className="flex-1 min-w-0 pr-4 pl-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{emoji}</span>
            <h3 className="font-bold text-base truncate">{product.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md text-xs">{product.sku}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cs.badge}`}>{product.category}</span>
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <div className={`text-2xl font-black leading-none flex items-center gap-1 ${isLow ? "text-red-600 dark:text-red-400" : ""}`}>
            {isLow && <AlertTriangle className="w-4 h-4" />}
            {product.stock}
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Left</span>
          <span className="text-[10px] text-muted-foreground">₹{product.price.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </Link>
  );
});

const ProductDesktopRow = memo(function ProductDesktopRow({ product }: ProductRowProps) {
  const cs = getCategoryStyle(product.category);
  const emoji = getCategoryEmoji(product.category);
  const isLow = product.stock <= product.lowStockThreshold;
  return (
    <Link href={`/product?sku=${product.sku}`} className="block" data-testid={`card-product-${product.id}`}>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3.5 hover:bg-muted/40 transition-colors items-center border-b last:border-0">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${cs.bg} ${cs.border} border flex items-center justify-center shrink-0 text-base`}>
              {emoji}
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{product.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
            </div>
          </div>
        </div>
        <div className="w-32 text-center">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cs.badge}`}>{product.category}</span>
        </div>
        <div className="w-24 text-right">
          <p className="font-semibold">₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="w-20 text-right flex items-center justify-end gap-1.5">
          {isLow && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
          <p className={`text-xl font-black ${isLow ? "text-destructive" : ""}`}>{product.stock}</p>
        </div>
      </div>
    </Link>
  );
});

export default function Products() {
  const [search, setSearch]         = useState("");
  const [showImport, setShowImport] = useState(false);
  const debouncedSearch             = useDebounce(search, 300);
  const { role }                    = useAuth();
  const isAdmin                     = role === "owner";

  const { data: products, isLoading } = useListProducts(
    { search: debouncedSearch || undefined },
    { query: { queryKey: getListProductsQueryKey({ search: debouncedSearch || undefined }) } }
  );

  return (
    <div className="flex flex-col h-full">
      {showImport && <CsvImportModal onClose={() => setShowImport(false)} />}
      <div className="p-4 md:p-6 bg-background border-b sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground hidden md:block mt-0.5">
              {products ? `${products.length} items` : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-2 border border-border px-3 py-2 rounded-full font-bold text-sm hover:bg-muted active:scale-95 transition-all">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import CSV</span>
              </button>
            )}
            <Link href="/products/new"
              className="bg-primary text-primary-foreground px-4 py-2.5 rounded-full font-bold flex items-center gap-2 active:scale-95 transition-transform shadow-md hover:opacity-90"
              data-testid="link-create-product">
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </Link>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search by name or SKU..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base bg-muted/50 border-transparent focus-visible:bg-background"
            data-testid="input-search" />
        </div>
      </div>

      {/* Desktop table header */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
        <span>Product</span>
        <span className="w-28 text-center">Category</span>
        <span className="w-20 text-right">Price</span>
        <span className="w-20 text-right">Stock</span>
      </div>

      <div className="flex-1 md:divide-y divide-border overflow-y-auto">
        {isLoading ? (
          <div className="p-4 md:p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 md:h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground p-4">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <h2 className="text-xl font-bold mb-2">No products found</h2>
            <p className="text-sm">Try adjusting your search or add a new product.</p>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="p-4 space-y-3 md:hidden">
              {products?.map((product) => (
                <ProductMobileCard key={product.id} product={product} />
              ))}
            </div>

            {/* Desktop: table rows */}
            <div className="hidden md:block">
              {products?.map((product) => (
                <ProductDesktopRow key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
