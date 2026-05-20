import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useSearch, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Package, Search, Plus, AlertTriangle, Upload, X, Loader2, Check, FileText, Trash2, ScanLine, Truck, Sparkles, Filter, History } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getCategoryStyle, getCategoryEmoji } from "@/lib/category-colors";
import { useUsbScanner } from "@/hooks/use-usb-scanner";
import { useScanFlash } from "@/hooks/use-scan-flash";

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

/* ── Delete confirmation modal ── */
function DeleteConfirmModal({
  product,
  onConfirm,
  onCancel,
  deleting,
}: {
  product: { name: string; sku: string };
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full md:max-w-sm bg-background rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mx-auto">
            <Trash2 className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="font-black text-lg">Delete Product?</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{product.name}</span>
            <span className="font-mono text-xs ml-1 text-muted-foreground">({product.sku})</span>
            {" "}will be permanently removed. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 h-12 rounded-2xl border font-bold text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CsvImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed]     = useState<{ headers: string[]; rows: ImportRow[] } | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState<{ updated: number; created: number; skipped: number } | null>(null);

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
        salePrice:         row.salePrice || row.sale_price || row.SalePrice || undefined,
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
      toast.success(`Import done: ${data.updated} updated, ${data.created ?? 0} created, ${data.skipped} skipped`);
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
              <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1">
                <p className="font-bold text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> CSV must have a <code className="bg-muted px-1 rounded">sku</code> column. Optional: name, category, price, salePrice, stock, lowStockThreshold</p>
                <p className="text-muted-foreground">Existing SKUs are updated. New SKUs with name + category + price are created automatically.</p>
              </div>

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
                  {(result.created ?? 0) > 0 && (
                    <div className="flex-1 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-center">
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{result.created}</p>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Created</p>
                    </div>
                  )}
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

/* ── Sale-price recovery dialog ────────────────────────────────── */
interface RecoverCandidate {
  id: string;
  sku: string;
  name: string;
  price: number;
  recoveredSalePrice: number;
  lastSoldAt: string;
}

function RecoverSalePricesModal({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const [phase, setPhase] = useState<"loading" | "preview" | "applying" | "done" | "error">("loading");
  const [candidates, setCandidates] = useState<RecoverCandidate[]>([]);
  const [errMsg, setErrMsg] = useState("");
  const [restoredCount, setRestoredCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BASE_URL}/api/products/sale-price-recovery/preview`);
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setCandidates(data.candidates ?? []);
        setPhase("preview");
      } catch (e) {
        if (cancelled) return;
        setErrMsg((e as Error).message);
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const apply = async () => {
    setPhase("applying");
    try {
      const r = await fetch(`${BASE_URL}/api/products/sale-price-recovery/apply`, { method: "POST" });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const data = await r.json();
      setRestoredCount(data.restored ?? 0);
      setPhase("done");
      onApplied();
    } catch (e) {
      setErrMsg((e as Error).message);
      setPhase("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl bg-background rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="font-black text-base flex items-center gap-2">
            <History className="w-5 h-5 text-amber-500" /> Recover Sale Prices
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {phase === "loading" && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Scanning sales history…
            </div>
          )}

          {phase === "error" && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <p className="font-bold">Could not contact server</p>
              <p className="text-xs mt-1">{errMsg}</p>
            </div>
          )}

          {phase === "preview" && (
            <>
              <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-bold mb-1">How this works</p>
                <p className="leading-relaxed">
                  We scan past bills for prices recorded below the current regular price. Those were
                  active sale prices at billing time. The most recent match per product is restored
                  with an <span className="font-bold">open-ended</span> end date — you can set a new
                  end date anytime from the product page.
                </p>
              </div>

              {candidates.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold">Nothing to recover</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No products with missing sale prices have audit data in past bills.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2 font-bold">
                    {candidates.length} product{candidates.length === 1 ? "" : "s"} can be restored
                  </p>
                  <div className="space-y-1.5">
                    {candidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{c.sku}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm">
                            <span className="line-through text-muted-foreground font-normal mr-1.5">₹{c.price.toLocaleString("en-IN")}</span>
                            <span className="text-red-600">₹{c.recoveredSalePrice.toLocaleString("en-IN")}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            from {new Date(c.lastSoldAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {phase === "applying" && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Restoring sale prices…
            </div>
          )}

          {phase === "done" && (
            <div className="text-center py-6">
              <Check className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
              <p className="font-black text-lg">Done</p>
              <p className="text-sm text-muted-foreground mt-1">
                Restored sale prices on {restoredCount} product{restoredCount === 1 ? "" : "s"}.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20 flex gap-2 shrink-0">
          {phase === "preview" && candidates.length > 0 && (
            <>
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border font-bold text-sm hover:bg-muted active:scale-95 transition-all"
              >Cancel</button>
              <button
                onClick={apply}
                className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm active:scale-95 transition-all"
              >Restore {candidates.length} product{candidates.length === 1 ? "" : "s"}</button>
            </>
          )}
          {(phase === "preview" && candidates.length === 0) || phase === "done" || phase === "error" ? (
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-black text-sm active:scale-95 transition-all"
            >Close</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Quick "Activate Today's Deal" dialog ──────────────────────── */
interface DealQuickModalProps {
  product: { id: string; name: string; price: number; salePrice?: number | null };
  onClose: () => void;
  onSaved: () => void;
}

function DealQuickModal({ product, onClose, onSaved }: DealQuickModalProps) {
  const [type, setType]   = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving]   = useState(false);

  const v = parseFloat(value);
  const computedSale = !Number.isFinite(v) || v <= 0
    ? null
    : type === "percent"
      ? Math.max(0, Math.round(product.price * (1 - v / 100) * 100) / 100)
      : Math.max(0, product.price - v);

  const endOfDayISO = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(23, 59, 59, 999);
    return x.toISOString();
  };

  const handleActivate = async () => {
    if (computedSale == null) {
      toast.error("Enter a discount value");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salePrice:      computedSale,
          salePriceUntil: endDate ? endOfDayISO(new Date(endDate)) : endOfDayISO(new Date()),
          isTodayDeal:    true,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      toast.success(`${product.name} → ₹${computedSale} (live on Today's Deals)`);
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
      <div className="relative w-full md:max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-black text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" /> Activate Today's Deal
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="p-3 rounded-xl border bg-muted/40">
            <p className="font-bold text-sm">{product.name}</p>
            <p className="text-xs text-muted-foreground">MRP ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1.5">Discount</p>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border bg-muted/30 overflow-hidden h-11">
                <button onClick={() => setType("percent")}
                  className={`px-4 text-sm font-black transition-colors ${type === "percent" ? "bg-violet-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>%</button>
                <button onClick={() => setType("amount")}
                  className={`px-4 text-sm font-black transition-colors border-l ${type === "amount" ? "bg-violet-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>₹</button>
              </div>
              <Input
                type="number"
                min={0}
                max={type === "percent" ? 100 : product.price}
                placeholder={type === "percent" ? "e.g. 20" : "e.g. 50"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                className="h-11 rounded-xl flex-1 font-bold tabular-nums"
              />
            </div>
            {computedSale != null && (
              <div className="mt-2 p-3 rounded-xl bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-400/10 border border-violet-500/30">
                <p className="text-xs text-muted-foreground">Customer pays</p>
                <p className="text-2xl font-black bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  ₹{computedSale.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Saving ₹{(product.price - computedSale).toFixed(2)} per unit
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1.5">Valid until (optional)</p>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="h-11 rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Leave empty for "today only" — auto-expires at midnight.</p>
          </div>
        </div>
        <div className="p-4 border-t bg-muted/20">
          <button
            onClick={handleActivate}
            disabled={computedSale == null || saving}
            className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 text-white shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {saving ? "Activating…" : "Activate Deal"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Memoized product rows ── */
interface ProductRowProps {
  product: { id: string; name: string; sku: string; category: string; price: number; salePrice?: number | null; salePriceUntil?: string | null; stock: number; lowStockThreshold: number; imageUrl?: string | null; supplierId?: string | null; isTodayDeal?: boolean };
  supplierName?: string | null;
  isAdmin?: boolean;
  onDelete?: (product: { id: string; name: string; sku: string }) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggleDeal?: (product: { id: string; name: string; price: number; salePrice?: number | null; isTodayDeal?: boolean }) => void;
}

const ProductMobileCard = memo(function ProductMobileCard({ product, supplierName, isAdmin, onDelete, selected, onToggleSelect, onToggleDeal }: ProductRowProps) {
  const cs = getCategoryStyle(product.category);
  const emoji = getCategoryEmoji(product.category);
  const isLow = product.stock <= product.lowStockThreshold;
  const dealOn = product.isTodayDeal === true;
  return (
    <Link href={`/product?sku=${product.sku}`} className="block">
      <div className={`p-4 rounded-xl border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all relative overflow-hidden ${selected ? "ring-2 ring-primary" : ""} ${dealOn ? "border-violet-300 dark:border-violet-700" : ""}`} data-testid={`card-product-${product.id}`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${cs.dot}`} />
        <div className="flex items-center justify-between">
          {isAdmin && onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelect(product.id)}
              onClick={(e) => { e.stopPropagation(); }}
              className="ml-2 mr-1 w-4 h-4 rounded border-muted-foreground/40 text-primary focus:ring-primary cursor-pointer shrink-0"
              aria-label="Select product"
            />
          )}
          <div className="flex-1 min-w-0 pr-4 pl-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-base">{emoji}</span>
              <h3 className="font-bold text-base truncate">{product.name}</h3>
              {dealOn && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shrink-0">
                  <Sparkles className="w-2.5 h-2.5" /> DEAL
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md text-xs">{product.sku}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cs.badge}`}>{product.category}</span>
            </div>
            {supplierName && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                <Truck className="w-3 h-3 shrink-0" />
                <span className="truncate">by <span className="font-semibold text-foreground/80">{supplierName}</span></span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex flex-col items-end">
              <div className={`text-2xl font-black leading-none flex items-center gap-1 ${isLow ? "text-red-600 dark:text-red-400" : ""}`}>
                {isLow && <AlertTriangle className="w-4 h-4" />}
                {product.stock}
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Left</span>
              {product.salePrice != null ? (
                <span className="text-[10px]">
                  <span className="line-through text-muted-foreground">₹{product.price.toLocaleString("en-IN")}</span>
                  {" "}<span className="text-red-600 font-bold">₹{product.salePrice.toLocaleString("en-IN")}</span>
                  {product.salePriceUntil && (
                    <span className="block text-amber-600 dark:text-amber-400">
                      Sale ends {new Date(product.salePriceUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">₹{product.price.toLocaleString("en-IN")}</span>
              )}
            </div>
            {isAdmin && onDelete && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(product); }}
                className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors shrink-0"
                aria-label="Delete product"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {/* Today's Deal toggle (admin only) — full-width pill below */}
        {isAdmin && onToggleDeal && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleDeal(product); }}
            className={`mt-3 ml-3 w-[calc(100%-0.75rem)] h-9 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] border-2 ${
              dealOn
                ? "bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 text-white border-transparent shadow-md"
                : "bg-card border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {dealOn ? "DEACTIVATE TODAY DEAL" : "ACTIVATE TODAY DEAL"}
          </button>
        )}
      </div>
    </Link>
  );
});

const ProductDesktopRow = memo(function ProductDesktopRow({ product, supplierName, isAdmin, onDelete, selected, onToggleSelect, onToggleDeal }: ProductRowProps) {
  const cs = getCategoryStyle(product.category);
  const emoji = getCategoryEmoji(product.category);
  const isLow = product.stock <= product.lowStockThreshold;
  const dealOn = product.isTodayDeal === true;
  return (
    <div className={`grid ${isAdmin ? "grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto_auto_auto_auto]"} gap-4 px-6 py-3.5 hover:bg-muted/40 transition-colors items-center border-b last:border-0 ${selected ? "bg-primary/5" : ""}`} data-testid={`card-product-${product.id}`}>
      {isAdmin && onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(product.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-muted-foreground/40 text-primary focus:ring-primary cursor-pointer"
          aria-label="Select product"
        />
      )}
      <Link href={`/product?sku=${product.sku}`} className="contents">
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
        <div className="w-36 text-left min-w-0">
          {supplierName ? (
            <span className="inline-flex items-center gap-1.5 max-w-full text-xs font-semibold text-foreground/80 bg-muted/60 px-2 py-1 rounded-md">
              <Truck className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate">{supplierName}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">—</span>
          )}
        </div>
        <div className="w-24 text-right">
          {product.salePrice != null ? (
            <div>
              <p className="text-xs line-through text-muted-foreground">₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="font-bold text-red-600">₹{product.salePrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              {product.salePriceUntil && (
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Sale ends {new Date(product.salePriceUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          ) : (
            <p className="font-semibold">₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          )}
        </div>
        <div className="w-20 text-right flex items-center justify-end gap-1.5">
          {isLow && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
          <p className={`text-xl font-black ${isLow ? "text-destructive" : ""}`}>{product.stock}</p>
        </div>
      </Link>
      {/* Today's Deal toggle — outside the Link so click doesn't navigate */}
      <div className="w-28 flex items-center justify-center">
        {isAdmin && onToggleDeal ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleDeal(product); }}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-black border-2 transition-all active:scale-95 ${
              dealOn
                ? "bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 text-white border-transparent shadow-sm"
                : "bg-card border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {dealOn ? "DEACTIVATE" : "ACTIVATE"}
          </button>
        ) : dealOn ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
            <Sparkles className="w-3 h-3" /> ACTIVE
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </div>
      <div className="w-10 flex items-center justify-center">
        {isAdmin && onDelete && (
          <button
            onClick={() => onDelete(product)}
            className="w-8 h-8 rounded-full hover:bg-red-100 dark:hover:bg-red-950/50 flex items-center justify-center text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
            aria-label="Delete product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});

export default function Products() {
  const searchStr                   = useSearch();
  const urlParams                   = new URLSearchParams(searchStr);
  const filterLowStock              = urlParams.get("filter") === "lowstock";
  const [search, setSearch]         = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; sku: string } | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [pendingDeal, setPendingDeal] = useState<{ id: string; name: string; price: number; salePrice?: number | null; isTodayDeal?: boolean } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [addedDateFilter, setAddedDateFilter] = useState<string>("");
  const [showRecover, setShowRecover] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const bulkAssignSupplier = async (supplierId: string | null) => {
    if (selected.size === 0) return;
    setBulkAssigning(true);
    try {
      const r = await fetch(`${BASE_URL}/api/products/bulk-assign-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selected), supplierId }),
      });
      if (!r.ok) throw new Error("Bulk assign failed");
      const out = await r.json();
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast.success(`${out.updated} product${out.updated === 1 ? "" : "s"} updated`);
      setSelected(new Set());
    } catch {
      toast.error("Failed to update products");
    } finally {
      setBulkAssigning(false);
    }
  };
  const debouncedSearch             = useDebounce(search, 300);
  const { role }                    = useAuth();
  const isAdmin                     = role === "owner";
  const qc                          = useQueryClient();
  const [, navigate]                = useLocation();
  const searchInputRef              = useRef<HTMLInputElement>(null);

  /* Today's Deal toggle handler.
     - If product is currently active → instantly deactivate. The server
       wipes salePrice + salePriceUntil on the same call so the offer is
       fully reset, not just hidden from the Deals page.
     - If inactive → open the DealQuickModal so the cashier can enter
       discount + end date, then activate. */
  const handleToggleDeal = useCallback(async (product: { id: string; name: string; price: number; salePrice?: number | null; isTodayDeal?: boolean }) => {
    if (product.isTodayDeal) {
      try {
        const r = await fetch(`${BASE_URL}/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isTodayDeal: false }),
        });
        if (!r.ok) throw new Error("failed");
        toast.success(`${product.name} removed from Today's Deals`);
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      } catch {
        toast.error("Could not deactivate deal");
      }
    } else {
      setPendingDeal(product);
    }
  }, [qc]);

  const { isFlashing, flash, clear } = useScanFlash(1500);

  const handleUsbScan = useCallback(async (raw: string) => {
    let sku = raw;
    try {
      if (raw.includes("product?sku=")) {
        const u = new URL(raw.startsWith("http") ? raw : `http://x${raw}`);
        sku = u.searchParams.get("sku") ?? raw;
      }
    } catch { /* use raw */ }

    sku = sku.trim().toUpperCase();
    flash();

    try {
      const res = await fetch(`${BASE_URL}/api/products/scan/${encodeURIComponent(sku)}`);
      if (!res.ok) {
        clear();
        toast.error(`Product not found: ${sku}`);
        return;
      }
      const product = await res.json() as { sku: string };
      clear();
      navigate(`/product?sku=${encodeURIComponent(product.sku)}`);
    } catch {
      clear();
      toast.error(`Product not found: ${sku}`);
    }
  }, [navigate, flash, clear]);

  useUsbScanner(handleUsbScan, {
    allowedInput: { ref: searchInputRef, onClear: () => setSearch("") },
  });

  const { data: allProducts, isLoading } = useListProducts(
    { search: debouncedSearch || undefined },
    { query: { queryKey: getListProductsQueryKey({ search: debouncedSearch || undefined }) } }
  );

  const { data: suppliers = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/suppliers`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

  const baseProducts = filterLowStock
    ? allProducts?.filter((p) => p.stock <= p.lowStockThreshold)
    : allProducts;

  const categoryOptions = Array.from(new Set((baseProducts ?? []).map((p) => p.category))).sort((a, b) => a.localeCompare(b));

  const products = (baseProducts ?? []).filter((p) => {
    const sid = "supplierId" in p ? (p.supplierId as string | null | undefined) : null;
    const createdAt = (p as { createdAt?: string }).createdAt;
    const categoryOk = categoryFilter === "all" || p.category === categoryFilter;
    const supplierOk = supplierFilter === "all" || (supplierFilter === "__none__" ? !sid : sid === supplierFilter);
    const stockOk =
      stockFilter === "all" ? true :
      stockFilter === "in" ? p.stock > 0 :
      stockFilter === "out" ? p.stock <= 0 :
      p.stock <= p.lowStockThreshold;
    const dateOk =
      !addedDateFilter ? true :
      createdAt
        ? new Date(createdAt).toISOString().slice(0, 10) === addedDateFilter
        : true;

    return categoryOk && supplierOk && stockOk && dateOk;
  });

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const r = await fetch(`${BASE_URL}/api/products/${pendingDelete.id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error("Delete failed");
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast.success(`"${pendingDelete.name}" deleted`);
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {showImport && <CsvImportModal onClose={() => setShowImport(false)} />}
      {showRecover && (
        <RecoverSalePricesModal
          onClose={() => setShowRecover(false)}
          onApplied={() => qc.invalidateQueries({ queryKey: getListProductsQueryKey() })}
        />
      )}
      {pendingDeal && (
        <DealQuickModal
          product={pendingDeal}
          onClose={() => setPendingDeal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: getListProductsQueryKey() })}
        />
      )}
      {pendingDelete && (
        <DeleteConfirmModal
          product={pendingDelete}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
          deleting={deleting}
        />
      )}

      <div className="p-4 md:p-6 bg-background border-b sticky top-0 z-10 space-y-3">
        {filterLowStock && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="font-bold text-red-700 dark:text-red-400">Showing low-stock items only</span>
            <Link href="/products" className="ml-auto text-xs text-red-500 hover:underline font-bold">Clear filter</Link>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground hidden md:block mt-0.5">
              {products ? `${products.length} items` : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setShowRecover(true)}
                className="flex items-center gap-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 px-3 py-2 rounded-full font-bold text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 active:scale-95 transition-all"
                title="Restore sale prices that were auto-cleared on older app versions">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Recover Sale Prices</span>
              </button>
            )}
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
          <Input ref={searchInputRef} placeholder="Search by name or SKU..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base bg-muted/50 border-transparent focus-visible:bg-background"
            data-testid="input-search" />
          {isFlashing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-xs font-bold animate-pulse pointer-events-none">
              <ScanLine className="w-3.5 h-3.5" />
              Scanning…
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <Input
            type="date"
            value={addedDateFilter}
            onChange={(e) => setAddedDateFilter(e.target.value)}
            className="h-9 w-[170px] rounded-lg text-xs"
            title="Filter by product added date"
          />

          <button
            type="button"
            onClick={() => { setCategoryFilter("all"); setSupplierFilter("all"); setStockFilter("all"); setAddedDateFilter(""); }}
            className="h-9 px-3 rounded-lg border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-[88px] md:top-[112px] z-10 bg-primary/10 border-b border-primary/20 px-4 md:px-6 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-primary">
            {selected.size} selected
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Set supplier:</span>
          <select
            disabled={bulkAssigning}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              bulkAssignSupplier(v === "__none__" ? null : v);
              e.currentTarget.value = "";
            }}
            className="text-xs font-semibold bg-background border border-border rounded-lg px-2 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            <option value="">Choose…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="__none__">— Clear supplier —</option>
          </select>
          {bulkAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Desktop table header */}
      <div className={`hidden md:grid ${isAdmin ? "grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto_auto_auto_auto]"} gap-4 px-6 py-2 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30`}>
        {isAdmin && (
          <input
            type="checkbox"
            checked={products && products.length > 0 && selected.size === products.length}
            ref={(el) => {
              if (el && products) el.indeterminate = selected.size > 0 && selected.size < products.length;
            }}
            onChange={() => {
              if (!products) return;
              if (selected.size === products.length) setSelected(new Set());
              else setSelected(new Set(products.map((p) => p.id)));
            }}
            className="w-4 h-4 rounded border-muted-foreground/40 text-primary focus:ring-primary cursor-pointer"
            aria-label="Select all"
          />
        )}
        <span>Product</span>
        <span className="w-32 text-center">Category</span>
        <span className="w-36 text-left">Supplier</span>
        <span className="w-24 text-right">Price</span>
        <span className="w-20 text-right">Stock</span>
        <span className="w-28 text-center">Today Deal</span>
        <span className="w-10"></span>
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
              {products?.map((product) => {
                const sid = "supplierId" in product ? (product.supplierId as string | null | undefined) : null;
                return (
                  <ProductMobileCard
                    key={product.id}
                    product={product}
                    supplierName={sid ? supplierMap.get(sid) ?? null : null}
                    isAdmin={isAdmin}
                    onDelete={setPendingDelete}
                    selected={selected.has(product.id)}
                    onToggleSelect={toggleSelect}
                    onToggleDeal={handleToggleDeal}
                  />
                );
              })}
            </div>

            {/* Desktop: table rows */}
            <div className="hidden md:block">
              {products?.map((product) => {
                const sid = "supplierId" in product ? (product.supplierId as string | null | undefined) : null;
                return (
                  <ProductDesktopRow
                    key={product.id}
                    product={product}
                    supplierName={sid ? supplierMap.get(sid) ?? null : null}
                    isAdmin={isAdmin}
                    onDelete={setPendingDelete}
                    selected={selected.has(product.id)}
                    onToggleSelect={toggleSelect}
                    onToggleDeal={handleToggleDeal}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
