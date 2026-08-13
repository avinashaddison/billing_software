import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Printer, ClipboardList, Search, Package, Loader2,
  CheckSquare, Square, RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ───────────────────────────────────────────────────────── */
interface Supplier { id: string; name: string; phone?: string | null; }
interface ProductLite {
  id: string; name: string; sku: string; category: string;
  stock: number; supplierId?: string | null;
}
interface Group {
  key: string; name: string; phone?: string | null;
  items: ProductLite[]; units: number;
}

/** Group key for products that have no supplier set. */
const UNASSIGNED = "__unassigned__";

const printedStamp = () =>
  new Date().toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  });

/* ── Page ────────────────────────────────────────────────────────── */
export default function StockCheck() {
  const store = useStoreSettings();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts]   = useState<ProductLite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<Set<string> | null>(null); // null = not initialised yet
  const [hideZero, setHideZero]         = useState(false);
  const [pagePerSupplier, setPagePerSupplier] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      fetch(`${BASE_URL}/api/suppliers`).then((r) => {
        if (!r.ok) throw new Error("suppliers");
        return r.json();
      }),
      fetch(`${BASE_URL}/api/products`).then((r) => {
        if (!r.ok) throw new Error("products");
        return r.json();
      }),
    ])
      .then(([s, p]) => {
        setSuppliers(Array.isArray(s) ? s : []);
        setProducts(Array.isArray(p) ? p : []);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  /* All groups that have at least one product, suppliers A→Z,
     "No supplier" always last. */
  const groups = useMemo<Group[]>(() => {
    const knownIds = new Set(suppliers.map((s) => s.id));
    const bySupplier = new Map<string, ProductLite[]>();
    for (const p of products) {
      /* Products pointing at a deleted supplier fall into the "No supplier"
         group too — the count sheet must never silently omit inventory. */
      const key = p.supplierId && knownIds.has(p.supplierId) ? p.supplierId : UNASSIGNED;
      const list = bySupplier.get(key) ?? [];
      list.push(p);
      bySupplier.set(key, list);
    }
    const sortItems = (list: ProductLite[]) =>
      [...list].sort((a, b) => a.name.localeCompare(b.name, "en-IN"));

    const out: Group[] = [];
    for (const s of [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "en-IN"))) {
      const items = bySupplier.get(s.id);
      if (!items || items.length === 0) continue;
      const sorted = sortItems(items);
      out.push({
        key: s.id, name: s.name, phone: s.phone,
        items: sorted, units: sorted.reduce((n, p) => n + p.stock, 0),
      });
    }
    const un = bySupplier.get(UNASSIGNED);
    if (un && un.length > 0) {
      const sorted = sortItems(un);
      out.push({
        key: UNASSIGNED, name: "No supplier set",
        items: sorted, units: sorted.reduce((n, p) => n + p.stock, 0),
      });
    }
    return out;
  }, [suppliers, products]);

  /* Everything selected by default once data arrives. */
  useEffect(() => {
    if (!loading && !loadError && selected === null && groups.length > 0) {
      setSelected(new Set(groups.map((g) => g.key)));
    }
  }, [loading, loadError, groups, selected]);

  const sel = selected ?? new Set<string>();
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  /* What actually prints: selected groups, minus 0-stock rows if hidden. */
  const printGroups = useMemo(() => {
    return groups
      .filter((g) => sel.has(g.key))
      .map((g) => {
        const items = hideZero ? g.items.filter((p) => p.stock > 0) : g.items;
        return { ...g, items, units: items.reduce((n, p) => n + p.stock, 0) };
      })
      .filter((g) => g.items.length > 0);
  }, [groups, sel, hideZero]);

  const totalItems = printGroups.reduce((n, g) => n + g.items.length, 0);
  const totalUnits = printGroups.reduce((n, g) => n + g.units, 0);

  const pickerGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  return (
    <>
      {/* ── A4 print CSS (this page only) ── */}
      <style>{`
        @page { size: A4 portrait; margin: 10mm 12mm; }
        @media print {
          .no-print, .no-print * { display: none !important; }
          html, body, main, .stockcheck-shell {
            display: block !important;
            margin: 0 !important; padding: 0 !important;
            background: white !important;
            height: auto !important; min-height: 0 !important; max-height: none !important;
            overflow: visible !important; width: 100% !important;
          }
          .stock-print-only {
            display: block !important; position: static !important;
            width: 100% !important; background: white !important; color: black !important;
          }
          .stock-print-only table { width: 100%; border-collapse: collapse; }
          .stock-print-only thead { display: table-header-group; }
          .stock-print-only tr { break-inside: avoid; page-break-inside: avoid; }
          .stock-print-only th, .stock-print-only td {
            border-bottom: 1px solid #ccc; padding: 1.6mm 1.5mm;
            font-size: 10px; line-height: 1.25; vertical-align: middle;
          }
          .stock-print-only th {
            border-bottom: 1.5px solid #000; text-align: left;
            font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em;
          }
          .supplier-section { break-inside: auto; }
          .supplier-section.page-break { break-before: page; page-break-before: always; }
          .counted-box {
            display: inline-block; width: 14mm; height: 5.5mm;
            border: 1px solid #888; border-radius: 1mm;
          }
        }
      `}</style>

      <div className="stockcheck-shell flex flex-col h-full bg-background">

        {/* ── Screen header ── */}
        <div className="no-print px-4 md:px-6 py-3 border-b sticky top-0 bg-background/85 backdrop-blur z-10 flex items-center gap-3">
          <Link href="/suppliers" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
                <ClipboardList className="w-3.5 h-3.5 text-white" />
              </div>
              Stock Check
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Print supplier-wise count sheet
            </p>
          </div>
          <button
            onClick={() => window.print()}
            disabled={totalItems === 0}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none dark:bg-white dark:text-black"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        <div className="no-print flex-1 overflow-y-auto pb-24 md:pb-6">
          {loading ? (
            <div className="p-4 md:px-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
            </div>
          ) : loadError ? (
            <div className="text-center py-16 text-muted-foreground px-6">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">Could not load stock data</p>
              <p className="text-sm">Check your connection and try again.</p>
              <button
                onClick={load}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm text-foreground hover:bg-muted active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground px-6">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">No products found</p>
              <p className="text-sm">Add products first, then print a count sheet from here.</p>
            </div>
          ) : (
            <div className="p-4 md:px-6 space-y-4">

              {/* ── Options ── */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setHideZero((v) => !v)}
                  className={`px-3 h-8 rounded-full text-xs font-bold transition-all ${
                    hideZero ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Skip items with 0 stock
                </button>
                <button
                  onClick={() => setPagePerSupplier((v) => !v)}
                  className={`px-3 h-8 rounded-full text-xs font-bold transition-all ${
                    pagePerSupplier ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  New page for each supplier
                </button>
              </div>

              {/* ── Supplier picker ── */}
              <div className="border rounded-2xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2">
                  <p className="font-black text-sm flex-1">
                    Suppliers <span className="text-muted-foreground font-bold">({sel.size} of {groups.length} selected)</span>
                  </p>
                  <button onClick={() => setSelected(new Set(groups.map((g) => g.key)))}
                    className="px-3 h-7 rounded-full bg-muted text-xs font-bold hover:text-foreground text-muted-foreground transition-all">
                    All
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    className="px-3 h-7 rounded-full bg-muted text-xs font-bold hover:text-foreground text-muted-foreground transition-all">
                    None
                  </button>
                </div>
                <div className="px-4 py-2.5 border-b relative">
                  <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Find a supplier…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 rounded-xl bg-muted/50 border-transparent text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border">
                  {pickerGroups.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground font-bold">No suppliers match</p>
                  ) : pickerGroups.map((g) => {
                    const on = sel.has(g.key);
                    return (
                      <button
                        key={g.key}
                        onClick={() => toggle(g.key)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
                      >
                        {on
                          ? <CheckSquare className="w-[18px] h-[18px] text-primary shrink-0" />
                          : <Square className="w-[18px] h-[18px] text-muted-foreground/50 shrink-0" />}
                        <span className={`flex-1 min-w-0 truncate text-sm font-bold ${g.key === UNASSIGNED ? "italic text-muted-foreground" : ""}`}>
                          {g.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-bold tabular-nums shrink-0">
                          {g.items.length} item{g.items.length !== 1 ? "s" : ""} · {g.units} pc
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── What will print ── */}
              <div className="rounded-2xl border bg-muted/30 px-4 py-3 flex items-center gap-3">
                <Package className="w-5 h-5 text-primary shrink-0" />
                <p className="text-sm font-bold">
                  {totalItems === 0
                    ? "Nothing selected to print yet"
                    : <>Sheet will list <span className="tabular-nums">{totalItems}</span> item{totalItems !== 1 ? "s" : ""} from <span className="tabular-nums">{printGroups.length}</span> supplier{printGroups.length !== 1 ? "s" : ""} · <span className="tabular-nums">{totalUnits}</span> pc in system</>}
                </p>
              </div>

              {/* ── Screen preview ── */}
              {printGroups.map((g) => (
                <div key={g.key} className="border rounded-2xl bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3">
                    <p className="font-black text-sm truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground font-bold tabular-nums shrink-0">
                      {g.items.length} item{g.items.length !== 1 ? "s" : ""} · {g.units} pc
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {g.items.map((p) => (
                      <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{p.name}</p>
                          <p className="text-[11px] font-mono text-muted-foreground truncate">{p.sku}{p.category ? ` · ${p.category}` : ""}</p>
                        </div>
                        <p className={`shrink-0 font-black tabular-nums ${p.stock === 0 ? "text-muted-foreground/50" : ""}`}>{p.stock}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Print-only A4 sheet ── */}
        {totalItems > 0 && (
          <div className="stock-print-only hidden">
            <div className="text-black bg-white">
              {/* Sheet header */}
              <div style={{ borderBottom: "2px solid #000", paddingBottom: "2mm", marginBottom: "3mm" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "4mm" }}>
                  <p style={{ fontSize: "15px", fontWeight: 800 }}>{store.name}</p>
                  <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em" }}>STOCK CHECK SHEET</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "4mm", fontSize: "9.5px", marginTop: "1mm" }}>
                  <span>Printed: {printedStamp()}</span>
                  <span>Checked by: ____________________&nbsp;&nbsp;&nbsp;Date: ____________</span>
                </div>
              </div>

              {printGroups.map((g, gi) => (
                <div key={g.key} className={`supplier-section${pagePerSupplier && gi > 0 ? " page-break" : ""}`} style={{ marginBottom: "5mm" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "3mm", padding: "1.5mm 0", borderBottom: "1.5px solid #000" }}>
                    <p style={{ fontSize: "12px", fontWeight: 800 }}>
                      {gi + 1}. {g.name}{g.phone ? <span style={{ fontWeight: 400, fontSize: "10px" }}> · {g.phone}</span> : null}
                    </p>
                    <p style={{ fontSize: "9.5px", fontWeight: 700 }}>
                      {g.items.length} items · {g.units} pc
                    </p>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "7mm" }}>#</th>
                        <th>Item</th>
                        <th style={{ width: "24mm" }}>Category</th>
                        <th style={{ width: "13mm", textAlign: "right" }}>Stock</th>
                        <th style={{ width: "17mm", textAlign: "center" }}>Counted</th>
                        <th style={{ width: "26mm" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((p, i) => (
                        <tr key={p.id}>
                          <td style={{ color: "#555" }}>{i + 1}</td>
                          <td>
                            <span style={{ fontWeight: 700 }}>{p.name}</span>
                            <span style={{ display: "block", fontSize: "8px", color: "#555", fontFamily: "monospace" }}>{p.sku}</span>
                          </td>
                          <td style={{ color: "#555" }}>{p.category || "—"}</td>
                          <td style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{p.stock}</td>
                          <td style={{ textAlign: "center" }}><span className="counted-box" /></td>
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              <p style={{ fontSize: "9px", color: "#555", textAlign: "center", marginTop: "2mm" }}>
                {totalItems} items · {totalUnits} pc in system · Generated by {store.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
