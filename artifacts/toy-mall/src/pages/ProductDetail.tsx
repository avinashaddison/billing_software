import { useState, useEffect } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { useGetProductBySku, useUpdateStock, getGetProductBySkuQueryKey, getGetDashboardSummaryQueryKey, getGetTodayActivityQueryKey, getListProductsQueryKey, getGetLowStockProductsQueryKey, getListStockLogsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Package, AlertTriangle, ArrowDownToLine, ArrowUpToLine, Loader2, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ProductDetail() {
  const searchParams = new URLSearchParams(useSearch());
  const sku = searchParams.get("sku") || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  
  const [quantity, setQuantity] = useState<number>(1);

  const { data: product, isLoading, isError } = useGetProductBySku(sku, {
    query: {
      enabled: !!sku,
      queryKey: getGetProductBySkuQueryKey(sku),
      retry: false
    }
  });

  const updateStock = useUpdateStock();

  useEffect(() => {
    if (isError) {
      toast.error("Product not found");
      setLocation("/products");
    }
  }, [isError, setLocation]);

  const handleStockAction = async (type: "IN" | "OUT") => {
    if (!product) return;
    if (quantity <= 0) {
      toast.error("Quantity must be at least 1");
      return;
    }
    
    if (type === "OUT" && product.stock < quantity) {
      toast.error("Insufficient stock");
      return;
    }

    // Optimistic UI update
    const previousStock = product.stock;
    const newStock = type === "IN" ? previousStock + quantity : previousStock - quantity;
    
    queryClient.setQueryData(getGetProductBySkuQueryKey(sku), {
      ...product,
      stock: newStock
    });

    try {
      await updateStock.mutateAsync({
        id: product.id,
        data: {
          type,
          quantity,
          userId
        }
      });

      toast.success(`Stock ${type === "IN" ? "added" : "removed"} successfully`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTodayActivityQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListStockLogsQueryKey() });
      
      setQuantity(1); // Reset quantity
    } catch (error: any) {
      // Revert optimistic update on error
      queryClient.setQueryData(getGetProductBySkuQueryKey(sku), {
        ...product,
        stock: previousStock
      });
      toast.error(error?.message || "Failed to update stock");
    }
  };

  if (!sku) {
    return (
      <div className="p-6 text-center">
        <p>No SKU provided.</p>
        <Button onClick={() => setLocation("/products")} className="mt-4">Back to Products</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!product) return null;

  const isLowStock = product.stock <= product.lowStockThreshold;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black truncate">{product.name}</h1>
        </div>
        <div className="flex gap-2">
          {/* Mock edit/delete buttons for completeness */}
          <Button variant="ghost" size="icon" className="rounded-full w-10 h-10">
            <Edit3 className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="p-4 overflow-y-auto flex-1 pb-32 space-y-4">
        {/* Info Card */}
        <div className="p-5 bg-card border rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Package className="w-32 h-32" />
          </div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">SKU</p>
              <p className="text-2xl font-mono font-black">{product.sku}</p>
            </div>
            <Badge variant="secondary" className="text-xs px-3 py-1 font-bold">{product.category}</Badge>
          </div>
          
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-xl font-bold">${product.price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Current Stock</p>
              <div className="flex items-center gap-2 justify-end">
                {isLowStock && <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />}
                <p className={`text-4xl font-black leading-none ${isLowStock ? 'text-destructive' : 'text-foreground'}`} data-testid="text-stock-count">
                  {product.stock}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="p-5 bg-card border rounded-3xl shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-4 text-center">Quick Adjust</h2>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button 
                variant="outline" 
                size="icon" 
                className="w-14 h-14 rounded-full text-2xl font-black shadow-sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              
              <div className="relative">
                <Input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 h-20 text-4xl text-center font-black rounded-2xl shadow-inner bg-muted/30 border-2 border-muted"
                />
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Quantity
                </span>
              </div>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="w-14 h-14 rounded-full text-2xl font-black shadow-sm"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8 pt-4">
            <Button 
              className="h-20 text-xl font-black rounded-2xl bg-success hover:bg-success/90 text-success-foreground shadow-lg active:scale-95 transition-all flex flex-col gap-1 items-center justify-center"
              onClick={() => handleStockAction("IN")}
              disabled={updateStock.isPending}
              data-testid="button-stock-in"
            >
              <ArrowDownToLine className="w-6 h-6" />
              <span>STOCK IN</span>
            </Button>
            
            <Button 
              className="h-20 text-xl font-black rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg active:scale-95 transition-all flex flex-col gap-1 items-center justify-center"
              onClick={() => handleStockAction("OUT")}
              disabled={updateStock.isPending || product.stock < quantity}
              data-testid="button-stock-out"
            >
              <ArrowUpToLine className="w-6 h-6" />
              <span>STOCK OUT</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
