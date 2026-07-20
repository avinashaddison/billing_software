import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download, Loader2, Search, IndianRupee, Wallet, PiggyBank, Percent,
  ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, PackagePlus, Plus, Grid3X3,
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
const num2   = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prettyDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ── Spreadsheet column model ───────────────────────────────────────
 * Every data cell is addressable (letter + row) like Excel: `raw` feeds the
 * formula bar / clipboard, `numeric` feeds the status-bar Sum/Avg. */
interface Col {
  letter:   string;
  label:    string;
  align:    "left" | "right";
  sortKey?: SortKey;
  raw:      (r: ProfitRow) => string | number;
  numeric?: (r: ProfitRow) => number | null;
  render:   (r: ProfitRow) => React.ReactNode;
}

const COLS: Col[] = [
  {
    letter: "A", label: "Item", align: "left", sortKey: "name",
    raw: (r) => r.name + (r.kind === "manual" ? " (manual)" : ""),
    render: (r) => (
      <>
        {r.name}
        {r.kind === "manual" && (
          <span className="ml-1.5 px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[9px] font-black uppercase">manual</span>
        )}
      </>
    ),
  },
  {
    letter: "B", label: "SKU", align: "left",
    raw: (r) => r.sku ?? "",
    render: (r) => <span className="font-mono text-muted-foreground">{r.sku ?? "—"}</span>,
  },
  {
    letter: "C", label: "Category", align: "left",
    raw: (r) => r.category ?? "",
    render: (r) => <span className="text-muted-foreground">{r.category ?? "—"}</span>,
  },
  {
    letter: "D", label: "Qty", align: "right", sortKey: "qty",
    raw: (r) => r.qty, numeric: (r) => r.qty,
    render: (r) => r.qty.toLocaleString("en-IN"),
  },
  {
    letter: "E", label: "Revenue", align: "right", sortKey: "revenue",
    raw: (r) => r.revenue, numeric: (r) => r.revenue,
    render: (r) => <span className="font-bold">{money2(r.revenue)}</span>,
  },
  {
    letter: "F", label: "Investment", align: "right", sortKey: "cost",
    raw: (r) => (r.costKnown && r.cost != null ? r.cost : "cost not set"),
    numeric: (r) => (r.costKnown ? r.cost : null),
    render: (r) => r.costKnown && r.cost != null
      ? <span className="text-muted-foreground">{money2(r.cost)}</span>
      : <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400" title="Set the purchase price on this product to see profit">—</span>,
  },
  {
    letter: "G", label: "Profit", align: "right", sortKey: "profit",
    raw: (r) => (r.profit != null ? r.profit : ""),
    numeric: (r) => r.profit,
    render: (r) => r.profit != null
      ? <span className={`font-bold ${r.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{money2(r.profit)}</span>
      : <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">—</span>,
  },
  {
    letter: "H", label: "Margin", align: "right", sortKey: "margin",
    raw: (r) => (r.margin != null ? `${r.margin.toFixed(1)}%` : ""),
    numeric: (r) => r.margin,
    render: (r) => r.margin != null
      ? <span className="text-muted-foreground">{r.margin.toFixed(1)}%</span>
      : <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">—</span>,
  },
];
const LAST_COL = COLS.length - 1;

interface CellPos { r: number; c: number }

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

  /* Excel selection model: anchor = active cell, extent = far corner of the
     dragged / shift-extended range. */
  const [anchor, setAnchor] = useState<CellPos | null>(null);
  const [extent, setExtent] = useState<CellPos | null>(null);
  const dragging = useRef(false);
  const gridRef  = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

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

  /* The visible data changed under the selection — clear it (Excel keeps
     the address, but here the row at that address is a different item). */
  useEffect(() => { setAnchor(null); setExtent(null); }, [rows]);

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

  /* ── Selection helpers ── */
  const range = useMemo(() => {
    if (!anchor) return null;
    const e = extent ?? anchor;
    return {
      r1: Math.min(anchor.r, e.r), r2: Math.max(anchor.r, e.r),
      c1: Math.min(anchor.c, e.c), c2: Math.max(anchor.c, e.c),
    };
  }, [anchor, extent]);

  const inRange   = (r: number, c: number) => !!range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
  const isActive  = (r: number, c: number) => !!anchor && anchor.r === r && anchor.c === c;
  const colSelected = (c: number) => !!range && c >= range.c1 && c <= range.c2;
  const rowSelected = (r: number) => !!range && r >= range.r1 && r <= range.r2;

  /* Excel-style status bar: aggregate the selected cells. */
  const selStats = useMemo(() => {
    if (!range) return null;
    let count = 0, numCount = 0, sum = 0;
    for (let r = range.r1; r <= range.r2 && r < rows.length; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        const raw = COLS[c].raw(rows[r]);
        if (raw !== "" && raw != null) count++;
        const n = COLS[c].numeric?.(rows[r]);
        if (n != null) { numCount++; sum += n; }
      }
    }
    return { count, numCount, sum, avg: numCount > 0 ? sum / numCount : 0 };
  }, [range, rows]);

  const clampPos = useCallback((p: CellPos): CellPos => ({
    r: Math.max(0, Math.min(rows.length - 1, p.r)),
    c: Math.max(0, Math.min(LAST_COL, p.c)),
  }), [rows.length]);

  const scrollCellIntoView = (p: CellPos) => {
    requestAnimationFrame(() => {
      document.getElementById(`pcell-${p.r}-${p.c}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  const onCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    gridRef.current?.focus({ preventScroll: true });
    e.preventDefault();
    if (e.shiftKey && anchor) { setExtent({ r, c }); return; }
    setAnchor({ r, c });
    setExtent(null);
    dragging.current = true;
  };
  const onCellMouseEnter = (r: number, c: number) => {
    if (dragging.current) setExtent({ r, c });
  };
  const selectColumn = (c: number) => {
    if (rows.length === 0) return;
    gridRef.current?.focus({ preventScroll: true });
    setAnchor({ r: 0, c }); setExtent({ r: rows.length - 1, c });
  };
  const selectRow = (r: number) => {
    gridRef.current?.focus({ preventScroll: true });
    setAnchor({ r, c: 0 }); setExtent({ r, c: LAST_COL });
  };
  const selectAll = () => {
    if (rows.length === 0) return;
    gridRef.current?.focus({ preventScroll: true });
    setAnchor({ r: 0, c: 0 }); setExtent({ r: rows.length - 1, c: LAST_COL });
  };

  const copySelection = useCallback(() => {
    if (!range || rows.length === 0) return;
    const lines: string[] = [];
    for (let r = range.r1; r <= range.r2 && r < rows.length; r++) {
      const cells: string[] = [];
      for (let c = range.c1; c <= range.c2; c++) cells.push(String(COLS[c].raw(rows[r])));
      lines.push(cells.join("\t"));
    }
    navigator.clipboard?.writeText(lines.join("\n"))
      .then(() => toast.success("Copied — paste it straight into Excel"))
      .catch(() => toast.error("Copy failed"));
  }, [range, rows]);

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) { e.preventDefault(); copySelection(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); selectAll(); return; }
    if (!anchor) return;

    const move = (dr: number, dc: number, grow: boolean) => {
      e.preventDefault();
      if (grow) {
        const base = extent ?? anchor;
        const p = clampPos({ r: base.r + dr, c: base.c + dc });
        setExtent(p); scrollCellIntoView(p);
      } else {
        const p = clampPos({ r: anchor.r + dr, c: anchor.c + dc });
        setAnchor(p); setExtent(null); scrollCellIntoView(p);
      }
    };

    switch (e.key) {
      case "ArrowUp":    move(-1, 0, e.shiftKey); break;
      case "ArrowDown":  move(1, 0, e.shiftKey);  break;
      case "ArrowLeft":  move(0, -1, e.shiftKey); break;
      case "ArrowRight": move(0, 1, e.shiftKey);  break;
      case "Tab":        move(0, e.shiftKey ? -1 : 1, false); break;
      case "Enter":      move(e.shiftKey ? -1 : 1, 0, false); break;
      case "Escape":     setAnchor(null); setExtent(null); break;
    }
  };

  /* Formula-bar content for the active cell. */
  const activeRef   = anchor ? `${COLS[anchor.c].letter}${anchor.r + 1}` : "";
  const activeValue = anchor && rows[anchor.r] ? String(COLS[anchor.c].raw(rows[anchor.r])) : "";

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
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF107C41" } };
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

  /* ── Header cell styling (Excel: selected column/row headers get the
     green treatment) ── */
  const letterHeadCls = (c: number) =>
    `border border-border/70 h-[22px] px-2 text-[10px] font-black text-center select-none cursor-pointer transition-colors ${
      colSelected(c)
        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-b-2 border-b-emerald-600"
        : "bg-muted/70 text-muted-foreground hover:bg-muted"
    }`;

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

          {/* ── The workbook ── */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">

            {/* Name box + formula bar */}
            <div className="flex items-stretch border-b bg-background/80 text-xs no-print">
              <div className="w-20 shrink-0 px-2 flex items-center justify-center font-mono font-bold border-r h-8">
                {activeRef || <span className="text-muted-foreground/50">—</span>}
              </div>
              <div className="w-9 shrink-0 flex items-center justify-center border-r italic font-serif font-bold text-muted-foreground select-none">fx</div>
              <div className="flex-1 px-3 flex items-center font-mono truncate text-muted-foreground">
                {activeValue || <span className="text-muted-foreground/40">Select a cell…</span>}
              </div>
            </div>

            {/* Grid — focusable so arrow keys / Ctrl+C work like Excel */}
            <div
              ref={gridRef}
              tabIndex={0}
              onKeyDown={onGridKeyDown}
              className="overflow-auto max-h-[62vh] focus:outline-none"
            >
              <table className="w-full border-collapse min-w-[880px] text-xs select-none">
                <thead className="sticky top-0 z-10">
                  {/* Column-letter strip — click a letter to select the column */}
                  <tr>
                    <th onClick={selectAll}
                      title="Select all"
                      className="border border-border/70 bg-muted/70 h-[22px] w-10 cursor-pointer hover:bg-muted text-center">
                      <Grid3X3 className="w-3 h-3 mx-auto text-muted-foreground/60" />
                    </th>
                    {COLS.map((col, c) => (
                      <th key={col.letter} onClick={() => selectColumn(c)} className={letterHeadCls(c)}>
                        {col.letter}
                      </th>
                    ))}
                  </tr>
                  {/* Labels row — click to sort */}
                  <tr>
                    <th className="border border-border/70 bg-muted px-2 py-1.5 text-[11px] font-black text-muted-foreground w-10 text-center">#</th>
                    {COLS.map((col) => (
                      <th
                        key={col.label}
                        onClick={() => col.sortKey && toggleSort(col.sortKey)}
                        className={`border border-border/70 bg-muted px-2 py-1.5 text-[11px] font-black uppercase tracking-wide whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"} ${col.sortKey ? "cursor-pointer" : ""}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.sortKey && (sortKey === col.sortKey
                            ? (sortDesc ? <ArrowDown className="w-3 h-3 text-primary" /> : <ArrowUp className="w-3 h-3 text-primary" />)
                            : <ArrowUpDown className="w-3 h-3 opacity-30" />)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={COLS.length + 1} className="border border-border/50 px-3 py-10 text-center text-muted-foreground font-medium">
                        No sales in this period{query ? " matching your search" : ""}.
                      </td>
                    </tr>
                  )}
                  {rows.map((r, ri) => (
                    <tr key={`${r.kind}-${r.name}-${r.sku ?? ri}`} className={ri % 2 === 1 ? "bg-muted/20" : ""}>
                      {/* Row number — click to select the row */}
                      <td
                        onClick={() => selectRow(ri)}
                        className={`border border-border/70 px-2 py-1.5 text-center font-mono cursor-pointer transition-colors ${
                          rowSelected(ri)
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold border-r-2 border-r-emerald-600"
                            : "bg-muted/70 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {ri + 1}
                      </td>
                      {COLS.map((col, ci) => {
                        const active   = isActive(ri, ci);
                        const selected = inRange(ri, ci);
                        return (
                          <td
                            key={col.letter}
                            id={`pcell-${ri}-${ci}`}
                            onMouseDown={(e) => onCellMouseDown(ri, ci, e)}
                            onMouseEnter={() => onCellMouseEnter(ri, ci)}
                            className={`border border-border/50 px-2 py-1.5 whitespace-nowrap cursor-cell font-mono tabular-nums ${col.align === "right" ? "text-right" : "text-left"} ${ci === 0 ? "max-w-[280px] truncate font-sans font-bold" : ""} ${
                              active
                                ? "outline outline-2 -outline-offset-1 outline-emerald-600 bg-background relative z-[1]"
                                : selected
                                ? "bg-emerald-500/10"
                                : "hover:bg-primary/5"
                            }`}
                          >
                            {col.render(r)}
                          </td>
                        );
                      })}
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

            {/* Sheet-tab strip + status bar */}
            <div className="flex items-center justify-between border-t bg-muted/40 text-[11px] no-print">
              <div className="flex items-stretch">
                <div className="px-4 py-1.5 bg-background border-r font-bold border-t-2 border-t-emerald-600 flex items-center gap-1.5">
                  <Grid3X3 className="w-3 h-3 text-emerald-600" />
                  Profit Report
                </div>
                <div className="px-2 flex items-center text-muted-foreground/50">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-center gap-4 px-3 py-1.5 font-bold text-muted-foreground">
                {selStats && selStats.count > 1 ? (
                  <>
                    {selStats.numCount > 0 && <span>Average: <span className="text-foreground font-mono">{num2(selStats.avg)}</span></span>}
                    <span>Count: <span className="text-foreground font-mono">{selStats.count.toLocaleString("en-IN")}</span></span>
                    {selStats.numCount > 0 && <span>Sum: <span className="text-foreground font-mono">{num2(selStats.sum)}</span></span>}
                  </>
                ) : (
                  <span className="font-medium">
                    {rows.length.toLocaleString("en-IN")} items · drag or Shift+click to select · Ctrl+C to copy
                  </span>
                )}
              </div>
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
