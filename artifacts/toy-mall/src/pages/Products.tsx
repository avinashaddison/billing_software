import { useState } from "react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Package, Search, Plus, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";

export default function Products() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: products, isLoading } = useListProducts(
    { search: debouncedSearch || undefined },
    { query: { queryKey: getListProductsQueryKey({ search: debouncedSearch || undefined }) } }
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 bg-background border-b sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground hidden md:block mt-0.5">
              {products ? `${products.length} items` : "Loading..."}
            </p>
          </div>
          <Link
            href="/products/new"
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-full font-bold flex items-center gap-2 active:scale-95 transition-transform shadow-md hover:opacity-90"
            data-testid="link-create-product"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Link>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base bg-muted/50 border-transparent focus-visible:bg-background"
            data-testid="input-search"
          />
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
                <Link key={product.id} href={`/product?sku=${product.sku}`} className="block">
                  <div className="p-4 rounded-xl border bg-card hover:bg-muted/50 active:scale-[0.98] transition-all flex items-center justify-between" data-testid={`card-product-${product.id}`}>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg truncate">{product.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{product.sku}</span>
                        <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div className="text-2xl font-black leading-none flex items-center gap-1">
                        {product.stock <= product.lowStockThreshold && (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        <span className={product.stock <= product.lowStockThreshold ? "text-destructive" : ""}>
                          {product.stock}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Left</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: table rows */}
            <div className="hidden md:block">
              {products?.map((product) => (
                <Link key={product.id} href={`/product?sku=${product.sku}`} className="block" data-testid={`card-product-${product.id}`}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 hover:bg-muted/40 transition-colors items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold truncate">{product.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
                        </div>
                      </div>
                    </div>
                    <div className="w-28 text-center">
                      <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                    </div>
                    <div className="w-20 text-right">
                      <p className="font-semibold">₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="w-20 text-right flex items-center justify-end gap-1.5">
                      {product.stock <= product.lowStockThreshold && (
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <p className={`text-xl font-black ${product.stock <= product.lowStockThreshold ? "text-destructive" : ""}`}>
                        {product.stock}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
