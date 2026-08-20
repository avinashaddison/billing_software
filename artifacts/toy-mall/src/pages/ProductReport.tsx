import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart4,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  TrendingUp,
  Package,
  IndianRupee,
  ArrowUpDown,
  Layers
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Days = 7 | 30 | 90;

interface ProductData {
  rank: number;
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  totalQty: number;
  totalRevenue: number;
  billCount: number;
  purchaseCost?: number | null;
  stockValue?: number | null;
  costOfGoods?: number | null;
  profit?: number | null;
  margin?: number | null;
  costedQty?: number;
}

interface ReportData {
  view: "manager" | "owner";
  days: number;
  fromDay: string;
  toDay: string;
  totals: {
    productCount: number;
    unitsSold: number;
    revenue: number;
    currentStock: number;
    lowStockCount: number;
    stockValue?: number;
    stockValueCoverageProducts?: number;
    grossProfit?: number;
    margin?: number | null;
    costedUnitsSold?: number;
    costCoveragePercent?: number;
  };
  products: ProductData[];
}

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return "—";
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatNumber = (val: number | null | undefined) => {
  if (val == null) return "—";
  return val.toLocaleString("en-IN");
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function escapeCsvCell(value: string | number | null | undefined): string {
  let text = String(value ?? "");
  /* Spreadsheet parsers can ignore leading whitespace before a formula
     marker. Prefix a quote so catalogue text remains text when opened. */
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  alert?: boolean;
  highlight?: boolean;
}

function MetricCard({ title, value, subtitle, icon: Icon, alert = false, highlight = false }: MetricCardProps) {
  return (
    <div data-testid={`metric-${title.toLowerCase().replaceAll(" ", "-")}`} className={`p-4 rounded-2xl border transition-all ${alert ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : highlight ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'} shadow-sm flex flex-col justify-between h-full min-h-[110px]`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-[10px] font-black uppercase tracking-wider ${alert ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>{title}</h3>
        <Icon className={`w-4 h-4 ${alert ? 'text-red-600 dark:text-red-400' : highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <div>
        <div className={`text-xl md:text-2xl font-black tabular-nums tracking-tight ${alert ? 'text-red-700 dark:text-red-400' : highlight ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </div>
        {subtitle && <p className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${alert ? 'text-red-600/80 dark:text-red-400/80' : 'text-muted-foreground'}`}>{subtitle}</p>}
      </div>
    </div>
  );
}

type SortConfig = { key: keyof ProductData; direction: "asc" | "desc" };

interface SortableHeaderProps {
  label: string;
  sortKey: keyof ProductData;
  sortConfig: SortConfig;
  onSort: (key: keyof ProductData) => void;
  align?: "left" | "right";
}

function SortableHeader({ label, sortKey, sortConfig, onSort, align = "left" }: SortableHeaderProps) {
  const isActive = sortConfig.key === sortKey;
  return (
    <th 
      className={`px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px] cursor-pointer hover:bg-muted/60 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
      data-testid={`sort-${String(sortKey)}`}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? 'text-foreground' : 'opacity-30'}`} />
      </div>
    </th>
  );
}

function ProductMobileCard({ product, view }: { product: ProductData, view: 'manager'|'owner' }) {
  return (
    <div data-testid={`card-product-${product.productId}`} className={`p-4 rounded-xl border flex flex-col gap-3 ${product.isLowStock ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' : 'bg-card border-border'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">#{product.rank}</span>
            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">{product.productSku}</span>
            <span className="text-[10px] font-bold bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-md truncate max-w-[100px]">{product.category}</span>
          </div>
          <h4 className="font-bold text-sm leading-tight text-foreground truncate">{product.productName}</h4>
        </div>
        <div className="text-right shrink-0 pl-2">
          <div className={`text-sm font-black tabular-nums ${product.isLowStock ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
            {formatNumber(product.currentStock)}
          </div>
          <div className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${product.isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
            Stock
          </div>
          {product.isLowStock && (
            <div className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center justify-end gap-1 mt-1 bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded-sm">
              <AlertTriangle className="w-2.5 h-2.5" /> Low
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Net Sold</p>
          <p className="text-sm font-black tabular-nums text-foreground">{formatNumber(product.totalQty)} <span className="text-[10px] font-bold text-muted-foreground tracking-normal ml-1">({product.billCount} bills)</span></p>
        </div>
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Revenue</p>
          <p className="text-sm font-black tabular-nums text-primary">{formatCurrency(product.totalRevenue)}</p>
        </div>
        {view === 'owner' && (
          <>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Purchase Cost</p>
              <p className="text-sm font-black tabular-nums text-foreground">{formatCurrency(product.purchaseCost)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Stock Value</p>
              <p className="text-sm font-black tabular-nums text-foreground">{formatCurrency(product.stockValue)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Cost of Goods</p>
              <p className="text-sm font-black tabular-nums text-foreground">{formatCurrency(product.costOfGoods)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Gross Profit</p>
              <p className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(product.profit)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Margin</p>
              <div className="mt-0.5">
                {product.margin != null ? (
                   <span className={`px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums ${product.margin >= 30 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400' : product.margin >= 15 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400'}`}>
                     {product.margin.toFixed(1)}%
                   </span>
                ) : <span className="text-sm font-bold text-muted-foreground">—</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductReport() {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rank', direction: 'asc' });

  const fetchReport = useCallback(async (isRefresh = false) => {
    const requestId = ++requestSequence.current;
    if (isRefresh) setRefreshing(true);
    else {
      setLoading(true);
      setData(null);
    }
    setError(null);
    
    try {
      const res = await fetch(`${BASE_URL}/api/reports/products?days=${days}`);
      if (!res.ok) {
        let errorMsg = `Failed to fetch report (${res.status})`;
        try {
          const err = await res.json();
          if (err.error) errorMsg = err.error;
        } catch { /* preserve the HTTP status message when the body is not JSON */ }
        throw new Error(errorMsg);
      }
      const json: ReportData = await res.json();
      if (requestId !== requestSequence.current) return;
      setData(json);
    } catch (err: unknown) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (requestId !== requestSequence.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSort = (key: keyof ProductData) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'rank' ? 'asc' : 'desc' };
    });
  };

  const filteredAndSortedProducts = useMemo(() => {
    if (!data) return [];
    
    let result = data.products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.productName.toLowerCase().includes(q) || 
        p.productSku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    
    result = [...result].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (aVal == null) aVal = -Infinity;
      if (bVal == null) bVal = -Infinity;
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [data, searchQuery, sortConfig]);

  const handleExport = () => {
    if (!data) return;
    
    const headers = [
      "Rank", "Product Name", "SKU", "Category", "Current Stock", "Low Stock",
      "Net Units Sold", "Net Revenue", "Bills"
    ];
    
    if (data.view === "owner") {
      headers.push("Purchase Cost", "Stock Value", "Cost of Goods", "Profit", "Margin %");
    }
    
    const rows = filteredAndSortedProducts.map(p => {
      const row = [
        p.rank,
        p.productName,
        p.productSku,
        p.category,
        p.currentStock,
        p.isLowStock ? "Yes" : "No",
        p.totalQty,
        p.totalRevenue,
        p.billCount
      ];
      
      if (data.view === "owner") {
        row.push(
          p.purchaseCost ?? "",
          p.stockValue ?? "",
          p.costOfGoods ?? "",
          p.profit ?? "",
          p.margin != null ? p.margin.toFixed(2) : ""
        );
      }
      
      return row;
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCsvCell).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Product_Report_${days}days_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = useMemo(() => {
    if (!data) return [];
    const arr = [];
    
    arr.push({ title: "Net Revenue", value: formatCurrency(data.totals.revenue), subtitle: "After returns & bill discounts", icon: IndianRupee, highlight: true });
    arr.push({ title: "Net Units Sold", value: formatNumber(data.totals.unitsSold), subtitle: "After returns", icon: TrendingUp });
    arr.push({ title: "Current Stock", value: formatNumber(data.totals.currentStock), icon: Package });
    
    if (data.view === "owner") {
      arr.push({ 
        title: "Gross Profit", 
        value: formatCurrency(data.totals.grossProfit), 
        subtitle: data.totals.costedUnitsSold != null && data.totals.unitsSold > 0
          ? `Based on ${data.totals.costCoveragePercent?.toFixed(0) ?? 0}% of sold units`
          : undefined,
        icon: IndianRupee 
      });
      arr.push({ title: "Margin", value: data.totals.margin != null ? `${data.totals.margin.toFixed(1)}%` : "—", icon: TrendingUp });
      arr.push({ 
        title: "Stock Value", 
        value: formatCurrency(data.totals.stockValue), 
        subtitle: data.totals.stockValueCoverageProducts != null
          ? `${data.totals.stockValueCoverageProducts} of ${data.totals.productCount} products costed`
          : undefined,
        icon: Layers 
      });
      arr.push({
        title: "Cost Coverage",
        value: `${data.totals.costCoveragePercent?.toFixed(0) ?? 0}%`,
        subtitle: `${formatNumber(data.totals.costedUnitsSold)} of ${formatNumber(data.totals.unitsSold)} sold units`,
        icon: Layers,
      });
    }
    
    arr.push({ title: "Low Stock Items", value: formatNumber(data.totals.lowStockCount), icon: AlertTriangle, alert: data.totals.lowStockCount > 0 });
    arr.push({ title: "Total Products", value: formatNumber(data.totals.productCount), icon: Package });
    
    return arr;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
        <p data-testid="status-product-report-loading" className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Compiling Report</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/20 flex items-center justify-center mb-6 border border-red-100 dark:border-red-900/50">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Report Generation Failed</h2>
        <p data-testid="status-product-report-error" className="text-sm font-bold text-muted-foreground mb-6 max-w-md">{error}</p>
        <button 
          onClick={() => fetchReport()} 
          data-testid="button-product-report-retry"
          className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-black text-sm flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95"
        >
          <RefreshCw className="w-4 h-4" /> Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background font-sans">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 md:px-6 py-4 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
              <BarChart4 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-foreground">Product Report</h1>
              <p data-testid="text-product-report-view" className="text-[10px] font-black text-muted-foreground mt-1.5 tracking-widest uppercase">
                 {data?.view === 'owner' ? 'Owner View' : 'Manager View'}
                 {data && <span className="opacity-50"> · {formatDate(data.fromDay)} - {formatDate(data.toDay)}</span>}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted/80 p-1 rounded-xl border border-border/50">
              {([7, 30, 90] as Days[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  data-testid={`button-product-report-${d}-days`}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all ${days === d ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchReport(true)}
              disabled={refreshing || loading}
              data-testid="button-product-report-refresh"
              className="p-2.5 bg-muted/80 hover:bg-muted text-foreground rounded-xl border border-border/50 transition-colors disabled:opacity-50 active:scale-95"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              disabled={!data || filteredAndSortedProducts.length === 0}
              data-testid="button-product-report-export"
              className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background hover:bg-foreground/90 rounded-xl text-xs font-black transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products by name, SKU, or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-product-report-search"
            className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:font-medium"
          />
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 transition-opacity duration-300 ${loading || refreshing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {error && data && (
          <div data-testid="status-product-report-refresh-error" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
            <p className="text-xs font-bold">{error}. Showing the last loaded report.</p>
            <button
              onClick={() => fetchReport(true)}
              data-testid="button-product-report-refresh-retry"
              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {kpis.map(k => (
            <MetricCard key={k.title} {...k} />
          ))}
        </div>

        {filteredAndSortedProducts.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center border-2 rounded-2xl bg-card/50 border-dashed border-border mt-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-black text-foreground">No records found</h3>
            <p className="text-sm font-bold text-muted-foreground max-w-sm mt-2 leading-relaxed">
              {searchQuery ? `No products match your search "${searchQuery}".` : "No sales or stock data available for the selected period."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                 data-testid="button-product-report-clear-search"
                className="mt-6 px-5 py-2.5 bg-muted text-foreground rounded-xl text-xs font-black hover:bg-muted/80 transition-colors active:scale-95"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <SortableHeader label="Rank" sortKey="rank" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Product" sortKey="productName" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Stock" sortKey="currentStock" sortConfig={sortConfig} onSort={handleSort} align="right" />
                    <SortableHeader label="Sold" sortKey="totalQty" sortConfig={sortConfig} onSort={handleSort} align="right" />
                    <SortableHeader label="Revenue" sortKey="totalRevenue" sortConfig={sortConfig} onSort={handleSort} align="right" />
                    {data?.view === "owner" && (
                      <>
                         <SortableHeader label="Purchase Cost" sortKey="purchaseCost" sortConfig={sortConfig} onSort={handleSort} align="right" />
                         <SortableHeader label="Stock Value" sortKey="stockValue" sortConfig={sortConfig} onSort={handleSort} align="right" />
                         <SortableHeader label="Cost of Goods" sortKey="costOfGoods" sortConfig={sortConfig} onSort={handleSort} align="right" />
                        <SortableHeader label="Profit" sortKey="profit" sortConfig={sortConfig} onSort={handleSort} align="right" />
                        <SortableHeader label="Margin" sortKey="margin" sortConfig={sortConfig} onSort={handleSort} align="right" />
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredAndSortedProducts.map(p => (
                    <tr data-testid={`row-product-${p.productId}`} key={p.productId} className={`transition-colors hover:bg-muted/40 ${p.isLowStock ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                      <td className="px-4 py-3.5 text-xs tabular-nums">
                        <span className="font-black text-muted-foreground bg-muted px-2 py-1 rounded-md">#{p.rank}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-black text-sm text-foreground mb-1">{p.productName}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{p.productSku}</span>
                          <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">{p.category}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className={`text-sm font-black tabular-nums ${p.isLowStock ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                          {formatNumber(p.currentStock)}
                        </div>
                        {p.isLowStock && (
                          <div className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1 flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3 h-3" /> Low Stock
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="text-sm font-black tabular-nums text-foreground">{formatNumber(p.totalQty)}</div>
                        <div className="text-[10px] font-bold text-muted-foreground mt-1 tracking-wide">{p.billCount} bills</div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-black tabular-nums text-primary">
                        {formatCurrency(p.totalRevenue)}
                      </td>
                      {data?.view === "owner" && (
                        <>
                          <td className="px-4 py-3.5 text-right text-sm font-black tabular-nums text-foreground">
                            {formatCurrency(p.purchaseCost)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-black tabular-nums text-foreground">
                            {formatCurrency(p.stockValue)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-black tabular-nums text-foreground">
                            {formatCurrency(p.costOfGoods)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.profit)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-black tabular-nums">
                            {p.margin != null ? (
                               <span className={`px-2 py-1 rounded-md text-[11px] font-black ${p.margin >= 30 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400' : p.margin >= 15 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400'}`}>
                                 {p.margin.toFixed(1)}%
                               </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredAndSortedProducts.map(p => (
                <ProductMobileCard key={p.productId} product={p} view={data?.view || 'manager'} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
