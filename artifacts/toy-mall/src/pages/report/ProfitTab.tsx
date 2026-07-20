import { useState, useEffect, useMemo } from "react";
import {
  Download, Loader2, Search, IndianRupee, Wallet, PiggyBank, Percent,
  ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, PackagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types (mirror /api/reports/profit) ─────────────────────────── */
interface ProfitRow {
  kind:      "sku" | "manual";
  name:      string;
  sku:       string | null;
  category:  string | null;
  qty:       number;
  revenue:   number;
  cost:      number | null;
  profit:    number | null;
  margin:    number | null;
  billCount: number;
  costKnown: boolean;
}

interface ProfitReport {
  from: string;
  to:   string;
  rows: ProfitRow[];
  totals: {
    revenue:         number;
    itemRevenue:     number;
    investment:      number;
    profit:          number;
    margin:          number;
    qty:             number;
    billCount:       number;
    uncostedRevenue: number;
  };
  purchases: { units: number; txCount: number; estValue: number };
}

type SortKey = "name" | "qty" | "revenue" | "cost" | "profit" | "margin";

/* ── Helpers ────────────────────────────────────────────────────── */
function todayIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function shiftDay(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function monthStart(): string {
  return todayIndia().slice(0, 8) + "01";
}
const money  = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const money2 = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const prettyDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ── Component ──────────────────────────────────────────────────── */
export default function ProfitTab() {
  const store = useStoreSettings();
  const [from, setFrom]         = useState(() => shiftDay(todayIndia(), -29));
  const [to, setTo]             = useState(todayIndia);
  const [report, setReport]     = useState<ProfitReport | null>(null);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("revenue");
  const [sortDesc, setSortDesc] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BASE_URL}/api/reports/profit?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setReport(d); })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const presets = [
    { label: "Today",      apply: () => { const t = todayIndia(); setFrom(t); setTo(t); } },
    { label: "7 Days",     apply: () => { setFrom(shiftDay(todayIndia(), -6));  setTo(todayIndia()); } },
    { label: "30 Days",    apply: () => { setFrom(shiftDay(todayIndia(), -29)); setTo(todayIndia()); } },
    { label: "This Month", apply: () => { setFrom(monthStart()); setTo(todayIndia()); } },
  ];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else { setSortKey(key); setSortDesc(key !== "name"); }
  };

  const rows = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? report.rows.filter((r) =>
          r.name.toLowerCase().includes(q)
          || (r.sku ?? "").toLowerCase().includes(q)
          || (r.category ?? "").toLowerCase().includes(q))
      : report.rows;
    const dir = sortDesc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return dir * (av === bv ? 0 : av > bv ? 1 : -1);
    });
  }, [report, query, sortKey, sortDesc]);

  /* Totals follow the current filter so the sheet always adds up to what
     is on screen (Excel behaviour). */
  const view = useMemo(() => {
    let qty = 0, revenue = 0, cost = 0, profit = 0, uncosted = 0;
    for (const r of rows) {
      qty += r.qty; revenue += r.revenue;
      if (r.costKnown && r.cost != null && r.profit != null) { cost += r.cost; profit += r.profit; }
      else uncosted += r.revenue;
    }
    const coveredRevenue = revenue - uncosted;
    return { qty, revenue, cost, profit, uncosted, margin: coveredRevenue > 0 ? (profit / coveredRevenue) * 100 : 0 };
  }, [rows]);

  const uncostedCount = report ? report.rows.filter((r) => !r.costKnown).length : 0;

  /* ── Excel (.xlsx) download — exceljs is lazy-loaded so the main
     bundle stays lean; the file is styled: title block, dark header,
     gridlines, ₹ number formats, bold totals, frozen header. ── */
  const downloadExcel = async () => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Profit Report", { views: [{ state: "frozen", ySplit: 9 }] });

      ws.columns = [
        { width: 5 }, { width: 42 }, { width: 16 }, { width: 18 }, { width: 9 },
        { width: 15 }, { width: 15 }, { width: 15 }, { width: 10 },
      ];

      const title = ws.getCell("A1");
      title.value = store.name || "My Shop";
      title.font = { bold: true, size: 16 };
      ws.mergeCells("A1:I1");

      ws.getCell("A2").value = "Profit & Investment Report";
      ws.getCell("A2").font  = { bold: true, size: 12, color: { argb: "FF4B5563" } };
      ws.mergeCells("A2:I2");

      ws.getCell("A3").value = `Period: ${prettyDate(report.from)} — ${prettyDate(report.to)}`;
      ws.getCell("A3").font  = { size: 10, color: { argb: "FF6B7280" } };
      ws.mergeCells("A3:I3");

      const RUPEE = '"₹"#,##0.00';
      const summary: [string, number | string, string?][] = [
        ["Billed Revenue",              report.totals.revenue, RUPEE],
        ["Total Investment (goods sold)", report.totals.investment, RUPEE],
        ["Total Profit",                report.totals.profit, RUPEE],
        ["Profit Margin",               `${report.totals.margin.toFixed(1)}%`],
      ];
      summary.forEach(([label, value, numFmt], i) => {
        const r = ws.getRow(4 + i);
        r.getCell(2).value = label;
        r.getCell(2).font  = { bold: true, size: 10 };
        r.getCell(3).value = value;
        r.getCell(3).font  = { bold: true, size: 10 };
        if (numFmt) r.getCell(3).numFmt = numFmt;
      });

      const HEADERS = ["#", "Item", "SKU", "Category", "Qty", "Revenue", "Investment", "Profit", "Margin %"];
      const headerRow = ws.getRow(9);
      HEADERS.forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
        c.alignment = { horizontal: i >= 4 ? "right" : "left", vertical: "middle" };
        c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      headerRow.height = 20;

      rows.forEach((r, i) => {
        const row = ws.getRow(10 + i);
        row.getCell(1).value = i + 1;
        row.getCell(2).value = r.name + (r.kind === "manual" ? "  (manual)" : "");
        row.getCell(3).value = r.sku ?? "—";
        row.getCell(4).value = r.category ?? "—";
        row.getCell(5).value = r.qty;
        row.getCell(6).value = r.revenue;
        row.getCell(6).numFmt = RUPEE;
        if (r.costKnown && r.cost != null && r.profit != null) {
          row.getCell(7).value = r.cost;
          row.getCell(7).numFmt = RUPEE;
          row.getCell(8).value = r.profit;
          row.getCell(8).numFmt = RUPEE;
          row.getCell(8).font = { color: { argb: r.profit >= 0 ? "FF047857" : "FFB91C1C" } };
          row.getCell(9).value = r.margin != null ? Number(r.margin.toFixed(1)) : null;
          row.getCell(9).numFmt = '0.0"%"';
        } else {
          row.getCell(7).value = "cost not set";
          row.getCell(7).font  = { italic: true, color: { argb: "FF92400E" }, size: 9 };
        }
        for (let c = 1; c <= 9; c++) {
          const cell = row.getCell(c);
          cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
          if (c >= 5) cell.alignment = { horizontal: "right" };
          if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        }
      });

      const totalRow = ws.getRow(10 + rows.length);
      totalRow.getCell(2).value = "TOTAL";
      totalRow.getCell(5).value = view.qty;
      totalRow.getCell(6).value = view.revenue;
      totalRow.getCell(7).value = view.cost;
      totalRow.getCell(8).value = view.profit;
      totalRow.getCell(9).value = Number(view.margin.toFixed(1));
      totalRow.getCell(9).numFmt = '0.0"%"';
      [6, 7, 8].forEach((c) => { totalRow.getCell(c).numFmt = RUPEE; });
      for (let c = 1; c <= 9; c++) {
        const cell = totalRow.getCell(c);
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
        cell.border = { top: { style: "medium" }, bottom: { style: "medium" } };
        if (c >= 5) cell.alignment = { horizontal: "right" };
      }

      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `profit-report-${report.from}-to-${report.to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel file downloaded!");
    } catch {
      toast.error("Failed to build the Excel file");
    } finally {
      setExporting(false);
    }
  };

  /* ── Rendering ── */
  const SortHead = ({ label, k, right = false, w }: { label: string; k: SortKey; right?: boolean; w?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`select-none cursor-pointer border border-border/70 bg-muted px-2 py-1.5 text-[11px] font-black uppercase tracking-wide whitespace-nowrap ${right ? "text-right" : "text-left"} ${w ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k
          ? (sortDesc ? <ArrowDown className="w-3 h-3 text-primary" /> : <ArrowUp className="w-3 h-3 text-primary" />)
          : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* ── Range + actions toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {presets.map((p) => (
            <button key={p.label} onClick={p.apply}
              className="px-3 h-8 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-all">
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-muted rounded-xl p-1 px-2">
          <input type="date" value={from} max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="text-xs font-bold bg-transparent border-0 focus:outline-none cursor-pointer" />
          <span className="text-xs font-black text-muted-foreground">→</span>
          <input type="date" value={to} min={from} max={todayIndia()}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="text-xs font-bold bg-transparent border-0 focus:outline-none cursor-pointer" />
        </div>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item / SKU / category…"
            className="w-full h-9 pl-8 pr-3 rounded-xl border bg-muted/30 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={downloadExcel}
          disabled={!report || exporting || rows.length === 0}
          className="ml-auto flex items-center gap-2 px-4 h-9 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Building…" : "Download Excel"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && report && (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Billed Revenue",   value: money(report.totals.revenue),    icon: IndianRupee, cls: "text-blue-700 dark:text-blue-400",     iconBg: "bg-blue-500" },
              { label: "Total Investment", value: money(report.totals.investment), icon: Wallet,      cls: "text-orange-700 dark:text-orange-400", iconBg: "bg-orange-500", hint: "Cost of goods sold" },
              { label: "Total Profit",     value: money(report.totals.profit),     icon: PiggyBank,   cls: report.totals.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400", iconBg: report.totals.profit >= 0 ? "bg-emerald-500" : "bg-rose-500" },
              { label: "Profit Margin",    value: `${report.totals.margin.toFixed(1)}%`, icon: Percent, cls: "text-purple-700 dark:text-purple-400", iconBg: "bg-purple-500" },
            ].map((k) => (
              <div key={k.label} className="bg-card border rounded-2xl p-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${k.iconBg} text-white flex items-center justify-center shrink-0`}>
                  <k.icon className="w-[18px] h-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">{k.label}</p>
                  <p className={`text-lg font-black leading-tight ${k.cls}`}>{k.value}</p>
                  {"hint" in k && k.hint && <p className="text-[10px] text-muted-foreground">{k.hint}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* ── Secondary stats ── */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-bold text-muted-foreground px-1">
            <span>🧾 {report.totals.billCount.toLocaleString("en-IN")} bills</span>
            <span>📦 {report.totals.qty.toLocaleString("en-IN")} units sold</span>
            <span className="inline-flex items-center gap-1">
              <PackagePlus className="w-3.5 h-3.5" />
              Stock purchased: {report.purchases.units.toLocaleString("en-IN")} units
              {report.purchases.estValue > 0 && <> (≈ {money(report.purchases.estValue)} at current cost)</>}
            </span>
            {uncostedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {uncostedCount} item{uncostedCount !== 1 ? "s" : ""} without purchase price ({money(report.totals.uncostedRevenue)} revenue) excluded from profit
              </span>
            )}
          </div>

          {/* ── Excel-style grid ── */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full border-collapse min-w-[860px] text-xs">
                <thead className="sticky top-0 z-10">
                  {/* Column-letter strip, like a spreadsheet */}
                  <tr>
                    {["", "A", "B", "C", "D", "E", "F", "G", "H"].map((l, i) => (
                      <th key={i} className="border border-border/70 bg-muted/70 h-[20px] px-2 text-[9px] font-black text-muted-foreground text-center">
                        {l}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border border-border/70 bg-muted px-2 py-1.5 text-[11px] font-black text-muted-foreground w-10 text-center">#</th>
                    <SortHead label="Item"       k="name" />
                    <th className="border border-border/70 bg-muted px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-left">SKU</th>
                    <th className="border border-border/70 bg-muted px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-left">Category</th>
                    <SortHead label="Qty"        k="qty"     right />
                    <SortHead label="Revenue"    k="revenue" right />
                    <SortHead label="Investment" k="cost"    right />
                    <SortHead label="Profit"     k="profit"  right />
                    <SortHead label="Margin"     k="margin"  right />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="border border-border/50 px-3 py-10 text-center text-muted-foreground font-medium">
                        No sales in this period{query ? " matching your search" : ""}.
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={`${r.kind}-${r.name}-${r.sku ?? i}`} className={`${i % 2 === 1 ? "bg-muted/30" : ""} hover:bg-primary/5`}>
                      <td className="border border-border/50 px-2 py-1.5 text-center text-muted-foreground font-mono">{i + 1}</td>
                      <td className="border border-border/50 px-2 py-1.5 font-bold max-w-[280px] truncate">
                        {r.name}
                        {r.kind === "manual" && (
                          <span className="ml-1.5 px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[9px] font-black uppercase">manual</span>
                        )}
                      </td>
                      <td className="border border-border/50 px-2 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{r.sku ?? "—"}</td>
                      <td className="border border-border/50 px-2 py-1.5 text-muted-foreground whitespace-nowrap">{r.category ?? "—"}</td>
                      <td className="border border-border/50 px-2 py-1.5 text-right font-mono tabular-nums">{r.qty.toLocaleString("en-IN")}</td>
                      <td className="border border-border/50 px-2 py-1.5 text-right font-mono tabular-nums font-bold">{money2(r.revenue)}</td>
                      {r.costKnown && r.cost != null && r.profit != null ? (
                        <>
                          <td className="border border-border/50 px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{money2(r.cost)}</td>
                          <td className={`border border-border/50 px-2 py-1.5 text-right font-mono tabular-nums font-bold ${r.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                            {money2(r.profit)}
                          </td>
                          <td className="border border-border/50 px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                            {r.margin != null ? `${r.margin.toFixed(1)}%` : "—"}
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="border border-border/50 px-2 py-1.5 text-center text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          set purchase price to see profit
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="bg-muted font-black">
                      <td className="border border-border/70 px-2 py-2" />
                      <td className="border border-border/70 px-2 py-2 uppercase tracking-wide">Total</td>
                      <td className="border border-border/70 px-2 py-2" />
                      <td className="border border-border/70 px-2 py-2" />
                      <td className="border border-border/70 px-2 py-2 text-right font-mono tabular-nums">{view.qty.toLocaleString("en-IN")}</td>
                      <td className="border border-border/70 px-2 py-2 text-right font-mono tabular-nums">{money2(view.revenue)}</td>
                      <td className="border border-border/70 px-2 py-2 text-right font-mono tabular-nums">{money2(view.cost)}</td>
                      <td className={`border border-border/70 px-2 py-2 text-right font-mono tabular-nums ${view.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                        {money2(view.profit)}
                      </td>
                      <td className="border border-border/70 px-2 py-2 text-right font-mono tabular-nums">{view.margin.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground px-1">
            Investment = purchase cost of the goods actually sold in this period (sale-time cost snapshot when available).
            Manual bill lines have no purchase cost, so their full amount counts as profit.
            Stock-purchase value is estimated at each product's current purchase price.
          </p>
        </>
      )}

      {!loading && !report && (
        <div className="text-center py-12 text-sm font-bold text-muted-foreground">
          Could not load the profit report. Check your connection and try again.
        </div>
      )}
    </div>
  );
}
