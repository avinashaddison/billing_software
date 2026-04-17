import { useGetDashboardSummary, useGetTodayActivity, useGetLowStockProducts, useGetCategoryBreakdown, getGetDashboardSummaryQueryKey, getGetTodayActivityQueryKey, getGetLowStockProductsQueryKey, getGetCategoryBreakdownQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, DollarSign, AlertTriangle, ArrowDownToLine, ArrowUpToLine, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: activity, isLoading: loadingActivity } = useGetTodayActivity({ query: { queryKey: getGetTodayActivityQueryKey() } });
  const { data: lowStock, isLoading: loadingLowStock } = useGetLowStockProducts({ query: { queryKey: getGetLowStockProductsQueryKey() } });
  const { data: categories, isLoading: loadingCategories } = useGetCategoryBreakdown({ query: { queryKey: getGetCategoryBreakdownQueryKey() } });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Mobile-only header */}
      <div className="flex items-center justify-between mb-2 md:hidden">
        <h1 className="text-2xl font-black text-foreground tracking-tight">ToyMall</h1>
        <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20">Staff View</Badge>
      </div>

      {/* Desktop page title */}
      <div className="hidden md:flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your inventory</p>
        </div>
        <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">Staff View</Badge>
      </div>

      {/* Stats grid: 2 cols on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Products" value={summary?.totalProducts} icon={Package} loading={loadingSummary} testid="stat-total-products" />
        <StatCard title="Stock Value" value={summary ? `$${summary.totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined} icon={DollarSign} loading={loadingSummary} testid="stat-stock-value" />
        <StatCard title="Today IN" value={activity?.inQuantity} subtitle={`${activity?.inCount ?? 0} transactions`} icon={ArrowDownToLine} loading={loadingActivity} className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900" valueClassName="text-green-700 dark:text-green-400" testid="stat-today-in" />
        <StatCard title="Today OUT" value={activity?.outQuantity} subtitle={`${activity?.outCount ?? 0} transactions`} icon={ArrowUpToLine} loading={loadingActivity} className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" valueClassName="text-red-700 dark:text-red-400" testid="stat-today-out" />
      </div>

      {/* Two column on desktop for alerts + categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* Low Stock Alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-5 h-5" />
              Low Stock Alerts
            </h2>
            {summary?.lowStockCount !== undefined && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold">{summary.lowStockCount}</Badge>
            )}
          </div>

          {loadingLowStock ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : !lowStock || lowStock.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-6 text-center border border-dashed">
              <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">All stock levels look good!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(product => (
                <Link key={product.id} href={`/product?sku=${product.sku}`} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-red-600 dark:text-red-400 leading-none">{product.stock}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Left</p>
                    </div>
                  </div>
                </Link>
              ))}
              {lowStock.length > 6 && (
                <Link href="/products?lowStock=true" className="block text-center text-sm font-bold text-primary p-2">
                  View all {lowStock.length} alerts →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Layers className="text-primary w-5 h-5" />
            Categories
          </h2>
          {loadingCategories ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {categories?.map(cat => (
                <div key={cat.category} className="p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors">
                  <p className="font-bold text-sm truncate mb-1">{cat.category}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-2xl font-black leading-none">{cat.totalStock}</p>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Items</p>
                      <p className="text-[10px] text-muted-foreground">{cat.productCount} SKUs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, loading, className = "", valueClassName = "", testid }: {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon: React.ElementType;
  loading?: boolean;
  className?: string;
  valueClassName?: string;
  testid?: string;
}) {
  return (
    <Card className={className} data-testid={testid}>
      <CardContent className="p-4 flex flex-col items-start justify-between h-full min-h-[100px]">
        <div className="flex items-center justify-between w-full mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
          <Icon className="w-4 h-4 opacity-50" />
        </div>
        <div className="mt-auto w-full">
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className={`text-2xl font-black leading-none tracking-tight ${valueClassName}`}>{value ?? 0}</p>
          )}
          {subtitle && <p className="text-[10px] mt-1 font-semibold opacity-70">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
