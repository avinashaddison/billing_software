import { useGetDashboardSummary, useGetTodayActivity, useGetLowStockProducts, useGetCategoryBreakdown, getGetDashboardSummaryQueryKey, getGetTodayActivityQueryKey, getGetLowStockProductsQueryKey, getGetCategoryBreakdownQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-foreground tracking-tight">ToyMall</h1>
        <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/20">Staff View</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Products" value={summary?.totalProducts} icon={Package} loading={loadingSummary} testid="stat-total-products" />
        <StatCard title="Stock Value" value={summary ? `$${summary.totalStockValue.toLocaleString()}` : undefined} icon={DollarSign} loading={loadingSummary} testid="stat-stock-value" />
        <StatCard title="Today IN" value={activity?.inQuantity} subtitle={`${activity?.inCount} items`} icon={ArrowDownToLine} loading={loadingActivity} className="bg-success/10 border-success/20 text-success" testid="stat-today-in" />
        <StatCard title="Today OUT" value={activity?.outQuantity} subtitle={`${activity?.outCount} items`} icon={ArrowUpToLine} loading={loadingActivity} className="bg-destructive/10 border-destructive/20 text-destructive" testid="stat-today-out" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="text-secondary w-5 h-5" /> 
            Low Stock Alerts
          </h2>
          {summary?.lowStockCount !== undefined && (
            <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground">{summary.lowStockCount}</Badge>
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
            {lowStock.slice(0, 5).map(product => (
              <Link key={product.id} href={`/product?sku=${product.sku}`} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-black text-destructive leading-none">{product.stock}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Left</p>
                  </div>
                </div>
              </Link>
            ))}
            {lowStock.length > 5 && (
              <Link href="/products?lowStock=true" className="block text-center text-sm font-bold text-primary p-2">
                View all {lowStock.length} alerts
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
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
              <div key={cat.category} className="p-3 rounded-xl border bg-card">
                <p className="font-bold text-sm truncate mb-1">{cat.category}</p>
                <div className="flex justify-between items-end">
                  <p className="text-2xl font-black leading-none">{cat.totalStock}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">Items</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, loading, className, testid }: any) {
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
            <p className="text-2xl font-black leading-none tracking-tight">{value ?? 0}</p>
          )}
          {subtitle && <p className="text-[10px] mt-1 font-semibold opacity-70">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
