import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  ArrowLeft, Printer, Truck, Package, ArrowDownToLine, ArrowUpToLine,
  IndianRupee, Wallet, Loader2, FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ───────────────────────────────────────────────────────── */
interface SupplierOption { id: string; name: string; phone?: string | null; }

interface ReportProduct {
  id: string; name: string; sku: string; stock: number;
  purchasePrice: number | null; purchasedQty: number; soldQty: number;
  purchaseValue: number | null;
  /** Last stock-IN date, or the product's creation date if never restocked. */
  entryDate: string | null;
}

interface SupplierReportData {
  supplier: { id: string; name: string; phone?: string | null; address?: string | null };
  from: string; to: string;
  products: ReportProduct[];
  totals: {
    purchasedQty: number; soldQty: number; currentStock: number;
    purchaseValue: number; paidInRange: number; paymentCount: number;
  };
}

/* ── Date helpers (IST calendar days, same as Reports page) ──────── */
const todayIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const shiftDay = (day: string, days: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtDay = (day: string) =>
  new Date(day + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtEntry = (ts: string | null) =>
  ts ? new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";

const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/* ── Summary tile ────────────────────────────────────────────────── */
function Tile({ label, value, icon: Icon, tone }: {
  label: string; value: string | number; icon: React.ElementType;
  tone: "green" | "red" | "blue" | "amber" | "emerald";
}) {
  const toneMap = {
    green:   "bg-green-500/10 text-green-600 dark:text-green-400",
    red:     "bg-red-500/10 text-red-600 dark:text-red-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  } as const;
  return (
    <div className="bg-card border rounded-2xl p-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-black leading-none tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function SupplierReport() {
  const store = useStoreSettings();
  const urlParams = new URLSearchParams(useSearch());

  const [suppliers, setSuppliers]   = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState(urlParams.get("supplier") ?? "");
  const [from, setFrom]             = useState(urlParams.get("from") ?? todayIndia());
  const [to, setTo]                 = useState(urlParams.get("to") ?? todayIndia());
  const [report, setReport]         = useState<SupplierReportData | null>(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/suppliers`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list: SupplierOption[] = Array.isArray(d) ? d : [];
        setSuppliers(list);
        // No supplier picked yet → preselect the first so the page isn't blank
        setSupplierId((cur) => cur || (list[0]?.id ?? ""));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!supplierId || !from || !to || from > to) return;
    let stale = false;
    setLoading(true);
    fetch(`${BASE_URL}/api/suppliers/${supplierId}/report?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stale) setReport(d); })
      .catch(() => { if (!stale) setReport(null); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [supplierId, from, to]);

  const presets = useMemo(() => {
    const today = todayIndia();
    return [
      { label: "Today",      from: today,               to: today },
      { label: "7 days",     from: shiftDay(today, -6),  to: today },
      { label: "30 days",    from: shiftDay(today, -29), to: today },
      { label: "This month", from: today.slice(0, 8) + "01", to: today },
    ];
  }, []);

  const paperWidth  = store.receiptPaperWidth ?? "80mm";
  const sidePadding = paperWidth === "58mm" ? "2.5mm" : "4.5mm";
  const hasValue    = (report?.totals.purchaseValue ?? 0) > 0;

  return (
    <>
      {/* ── Thermal print CSS (same pattern as bill receipts) ── */}
      <style>{`
        @page { size: ${paperWidth} auto; margin: 0; }
        @media print {
          .no-print, .no-print * { display: none !important; }
          html, body, .report-shell {
            display: block !important;
            margin: 0 !important; padding: 0 !important;
            background: white !important;
            height: auto !important; min-height: 0 !important; max-height: none !important;
            overflow: visible !important; width: 100% !important;
            box-shadow: none !important; border: none !important;
          }
          .receipt-print-only {
            display: block !important; position: static !important;
            width: 100% !important; max-width: 100% !important;
            margin: 0 auto !important; padding: 0 !important;
            background: white !important; color: black !important;
          }
          .receipt-print-only * { box-sizing: border-box !important; }
          .receipt-print-only > div {
            padding-left: ${sidePadding} !important;
            padding-right: ${sidePadding} !important;
          }
          .receipt-print-only tr, .receipt-print-only tbody, .receipt-print-only thead {
            break-inside: avoid !important; page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="report-shell flex flex-col h-full bg-background">

        {/* ── Sticky header (screen only) ── */}
        <div className="no-print px-4 md:px-6 py-3 border-b sticky top-0 bg-background/85 backdrop-blur z-10 flex items-center gap-3">
          <Link href="/suppliers" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                <Truck className="w-3.5 h-3.5 text-white" />
              </div>
              Supplier Report
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Purchased · Sold · Available
            </p>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!report || report.products.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none dark:bg-white dark:text-black"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        <div className="no-print flex-1 overflow-y-auto pb-24 md:pb-6">

          {/* ── Controls ── */}
          <div className="p-4 md:px-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-transparent font-bold">
                  <SelectValue placeholder="Choose supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                  className="h-10 rounded-xl bg-muted/50 border-transparent font-bold w-full md:w-40" />
                <span className="text-xs font-bold text-muted-foreground shrink-0">to</span>
                <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
                  className="h-10 rounded-xl bg-muted/50 border-transparent font-bold w-full md:w-40" />
              </div>
              <div className="flex gap-1 items-center flex-wrap">
                {presets.map((p) => {
                  const active = from === p.from && to === p.to;
                  return (
                    <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to); }}
                      className={`px-3 h-8 rounded-full text-xs font-bold transition-all ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Report body ── */}
          {loading && !report ? (
            <div className="p-4 md:px-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : !supplierId ? (
            <div className="text-center py-16 text-muted-foreground">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">Choose a supplier</p>
              <p className="text-sm">Pick a supplier and date range to generate the report.</p>
            </div>
          ) : report ? (
            <>
              {/* Summary tiles */}
              <div className="px-4 md:px-6 pb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                <Tile label="Purchased" value={report.totals.purchasedQty} icon={ArrowDownToLine} tone="green" />
                <Tile label="Sold"      value={report.totals.soldQty}      icon={ArrowUpToLine}   tone="red" />
                <Tile label="In Stock"  value={report.totals.currentStock} icon={Package}         tone="blue" />
                <Tile label="Purchase Value" value={`₹${inr(report.totals.purchaseValue)}`} icon={IndianRupee} tone="amber" />
                <Tile label="Paid" value={`₹${inr(report.totals.paidInRange)}`} icon={Wallet} tone="emerald" />
              </div>

              {loading && (
                <div className="px-4 md:px-6 pb-2 flex items-center gap-2 text-xs text-muted-foreground font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
                </div>
              )}

              {report.products.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-bold text-lg">No products linked</p>
                  <p className="text-sm">Link products to this supplier (product → edit → supplier) to see them here.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block mx-6 border rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-2.5 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                      <span>Product</span>
                      <span className="w-24 text-right">Entry Date</span>
                      <span className="w-24 text-right">Purchased</span>
                      <span className="w-20 text-right">Sold</span>
                      <span className="w-20 text-right">In Stock</span>
                      <span className="w-28 text-right">Value</span>
                    </div>
                    <div className="divide-y divide-border">
                      {report.products.map((p) => (
                        <Link key={p.id} href={`/product?sku=${encodeURIComponent(p.sku)}`}>
                          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 hover:bg-muted/30 transition-colors items-center cursor-pointer">
                            <div className="min-w-0">
                              <p className="font-bold truncate">{p.name}</p>
                              <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                            </div>
                            <div className="w-24 text-right text-sm font-bold text-muted-foreground tabular-nums">
                              {fmtEntry(p.entryDate)}
                            </div>
                            <div className="w-24 text-right font-black text-green-600 dark:text-green-400 tabular-nums">
                              {p.purchasedQty > 0 ? `+${p.purchasedQty}` : "—"}
                            </div>
                            <div className="w-20 text-right font-black text-red-600 dark:text-red-400 tabular-nums">
                              {p.soldQty > 0 ? `-${p.soldQty}` : "—"}
                            </div>
                            <div className="w-20 text-right font-bold tabular-nums">{p.stock}</div>
                            <div className="w-28 text-right font-bold text-muted-foreground tabular-nums">
                              {p.purchaseValue != null && p.purchaseValue > 0 ? `₹${inr(p.purchaseValue)}` : "—"}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden px-4 pb-4 space-y-3">
                    {report.products.map((p) => (
                      <Link key={p.id} href={`/product?sku=${encodeURIComponent(p.sku)}`}>
                        <div className="p-4 rounded-2xl border bg-card shadow-sm active:scale-[0.99] transition-all">
                          <p className="font-bold text-sm truncate">{p.name}</p>
                          <p className="text-xs font-mono text-muted-foreground mb-2">
                            {p.sku} · <span className="font-sans font-semibold">Entry: {fmtEntry(p.entryDate)}</span>
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-green-500/10 py-1.5">
                              <p className="text-[9px] font-extrabold text-muted-foreground uppercase">Purchased</p>
                              <p className="font-black text-green-600 dark:text-green-400 tabular-nums">{p.purchasedQty}</p>
                            </div>
                            <div className="rounded-xl bg-red-500/10 py-1.5">
                              <p className="text-[9px] font-extrabold text-muted-foreground uppercase">Sold</p>
                              <p className="font-black text-red-600 dark:text-red-400 tabular-nums">{p.soldQty}</p>
                            </div>
                            <div className="rounded-xl bg-blue-500/10 py-1.5">
                              <p className="text-[9px] font-extrabold text-muted-foreground uppercase">In Stock</p>
                              <p className="font-black text-blue-600 dark:text-blue-400 tabular-nums">{p.stock}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">Could not load report</p>
              <p className="text-sm">Check your connection and try again.</p>
            </div>
          )}
        </div>

        {/* ── Thermal receipt (print only) ── */}
        {report && (
          <div className="receipt-print-only hidden">
            <div className="text-black bg-white" style={{ fontFamily: "'Courier New', monospace" }}>
              {/* Store header */}
              <div className="text-center pt-1">
                <p className="text-[15px] font-black leading-tight">{store.name}</p>
                {store.address && <p className="text-[10px] leading-tight">{store.address}</p>}
                {store.phone && <p className="text-[10px] leading-tight">Ph: {store.phone}</p>}
              </div>

              <div className="border-t border-dashed border-black my-1.5" />
              <p className="text-center text-[11px] font-black tracking-wider">SUPPLIER PURCHASE REPORT</p>
              <div className="border-t border-dashed border-black my-1.5" />

              {/* Supplier + period */}
              <div className="text-[10px] leading-snug">
                <p><span className="font-black">Supplier:</span> {report.supplier.name}</p>
                {report.supplier.phone && <p><span className="font-black">Phone:</span> {report.supplier.phone}</p>}
                <p><span className="font-black">Period:</span> {fmtDay(report.from)}{report.from !== report.to ? ` — ${fmtDay(report.to)}` : ""}</p>
                <p><span className="font-black">Printed:</span> {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Product table */}
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-dashed border-black">
                    <th className="text-left font-black pb-0.5">Item</th>
                    <th className="text-right font-black pb-0.5 w-8">Pur</th>
                    <th className="text-right font-black pb-0.5 w-8">Sold</th>
                    <th className="text-right font-black pb-0.5 w-8">Avl</th>
                  </tr>
                </thead>
                <tbody>
                  {report.products.map((p) => (
                    <tr key={p.id}>
                      <td className="pr-1 leading-tight py-0.5">
                        {p.name}
                        <span className="block text-[8px]">{p.sku} · {fmtEntry(p.entryDate)}</span>
                      </td>
                      <td className="text-right align-top py-0.5 tabular-nums">{p.purchasedQty}</td>
                      <td className="text-right align-top py-0.5 tabular-nums">{p.soldQty}</td>
                      <td className="text-right align-top py-0.5 tabular-nums">{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-black my-1.5" />

              {/* Totals */}
              <div className="text-[10px] leading-snug">
                <div className="flex justify-between"><span className="font-black">Total Purchased</span><span className="tabular-nums">{report.totals.purchasedQty} units</span></div>
                <div className="flex justify-between"><span className="font-black">Total Sold</span><span className="tabular-nums">{report.totals.soldQty} units</span></div>
                <div className="flex justify-between"><span className="font-black">Now In Stock</span><span className="tabular-nums">{report.totals.currentStock} units</span></div>
                {hasValue && (
                  <div className="flex justify-between"><span className="font-black">Purchase Value</span><span className="tabular-nums">Rs. {inr(report.totals.purchaseValue)}</span></div>
                )}
                {report.totals.paidInRange > 0 && (
                  <div className="flex justify-between"><span className="font-black">Paid ({report.totals.paymentCount} payment{report.totals.paymentCount !== 1 ? "s" : ""})</span><span className="tabular-nums">Rs. {inr(report.totals.paidInRange)}</span></div>
                )}
              </div>

              <div className="border-t border-dashed border-black my-1.5" />
              <p className="text-center text-[9px] pb-2">Generated by {store.name}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
