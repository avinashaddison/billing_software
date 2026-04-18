import { useState, useEffect } from "react";
import { useSearch, useLocation, Link } from "wouter";
import {
  useGetProductBySku, useUpdateStock, useGetProductQr,
  getGetProductBySkuQueryKey, getGetDashboardSummaryQueryKey,
  getGetTodayActivityQueryKey, getListProductsQueryKey,
  getGetLowStockProductsQueryKey, getListStockLogsQueryKey,
  getGetProductQrQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Package, AlertTriangle, ArrowDownToLine, ArrowUpToLine, ChevronRight, Edit3, X, Check, Loader2 } from "lucide-react";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { playTick, playStockIn, playStockOut, playError } from "@/lib/sounds";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function ProductDetail() {
  const searchParams = new URLSearchParams(useSearch());
  const sku = searchParams.get("sku") || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { userId, role } = useAuth();
  const isOwner = role === "owner";

  const [quantity, setQuantity]         = useState<number>(1);
  const [savingImg, setSavingImg]       = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [editSaving, setEditSaving]     = useState(false);
  const [editForm, setEditForm]         = useState({ name: "", price: "", category: "", lowStockThreshold: "" });

  const { data: product, isLoading, isError } = useGetProductBySku(sku, {
    query: {
      enabled: !!sku,
      queryKey: getGetProductBySkuQueryKey(sku),
      retry: false
    }
  });

  const { data: qrData, isLoading: qrLoading } = useGetProductQr(product?.id ?? "", {
    query: {
      enabled: !!product?.id,
      queryKey: getGetProductQrQueryKey(product?.id ?? "")
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
      playError();
      toast.error("Quantity must be at least 1");
      return;
    }
    if (type === "OUT" && product.stock < quantity) {
      playError();
      toast.error("Insufficient stock");
      return;
    }

    const previousStock = product.stock;
    const newStock = type === "IN" ? previousStock + quantity : previousStock - quantity;

    queryClient.setQueryData(getGetProductBySkuQueryKey(sku), { ...product, stock: newStock });

    try {
      await updateStock.mutateAsync({ id: product.id, data: { type, quantity, userId } });
      if (type === "IN") playStockIn(); else playStockOut();
      toast.success(`Stock ${type === "IN" ? "added" : "removed"} successfully`);
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTodayActivityQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListStockLogsQueryKey() });
      setQuantity(1);
    } catch (error: any) {
      playError();
      queryClient.setQueryData(getGetProductBySkuQueryKey(sku), { ...product, stock: previousStock });
      toast.error(error?.data?.error || error?.message || "Failed to update stock");
    }
  };

  const saveImageUrl = async (url: string) => {
    if (!product) return;
    setSavingImg(true);
    try {
      await fetch(`${BASE_URL}/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url || null }),
      });
      queryClient.invalidateQueries({ queryKey: getGetProductBySkuQueryKey(sku) });
      toast.success("Image updated");
    } catch { toast.error("Failed to save image"); }
    finally { setSavingImg(false); }
  };

  const openEdit = () => {
    if (!product) return;
    setEditForm({
      name: product.name,
      price: String(product.price),
      category: product.category,
      lowStockThreshold: String(product.lowStockThreshold),
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!product) return;
    const name = editForm.name.trim();
    const price = parseFloat(editForm.price);
    const threshold = parseInt(editForm.lowStockThreshold, 10);
    const category = editForm.category.trim();
    if (!name)              { toast.error("Name is required"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return; }
    if (isNaN(threshold) || threshold < 0) { toast.error("Enter a valid threshold"); return; }
    if (!category)          { toast.error("Category is required"); return; }
    setEditSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, category, lowStockThreshold: threshold }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      toast.success("Product updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetProductBySkuQueryKey(sku) });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
    } catch (e: any) { toast.error(e.message || "Update failed"); }
    finally { setEditSaving(false); }
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
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64 rounded-3xl md:col-span-1" />
          <Skeleton className="h-64 rounded-3xl md:col-span-1" />
          <Skeleton className="h-64 rounded-3xl md:col-span-1" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const isLowStock = product.stock <= product.lowStockThreshold;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 md:px-6 border-b flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-black truncate">{product.name}</h1>
            <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
          </div>
        </div>
        {isOwner && (
          <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 shrink-0" onClick={openEdit}>
            <Edit3 className="w-5 h-5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* ── Edit panel ── */}
      {editOpen && (
        <div className="border-b bg-primary/5 px-4 md:px-6 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary" /> Edit Product
            </h2>
            <button onClick={() => setEditOpen(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Product Name</p>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bunny Soft Toy" className="h-11 rounded-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Category</p>
              <Input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Plush Toys" className="h-11 rounded-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Price (₹)</p>
              <Input type="number" min={0.01} step={0.01} value={editForm.price}
                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00" className="h-11 rounded-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Low Stock Threshold</p>
              <Input type="number" min={0} step={1} value={editForm.lowStockThreshold}
                onChange={(e) => setEditForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
                placeholder="5" className="h-11 rounded-xl" />
            </div>
          </div>
          <button onClick={handleEditSave} disabled={editSaving}
            className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
            {editSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      )}

      {/* Content: mobile = stacked, desktop = 3 columns */}
      <div className="p-4 md:p-6 overflow-y-auto flex-1 pb-32 md:pb-6">
        <div className="grid gap-4 md:grid-cols-3">

          {/* ── Col 1: Product info ── */}
          <div className="p-5 bg-card border rounded-3xl shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5">
              <Package className="w-32 h-32" />
            </div>

            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">SKU</p>
                <p className="text-xl font-mono font-black">{product.sku}</p>
              </div>
              <Badge variant="secondary" className="text-xs px-3 py-1 font-bold">{product.category}</Badge>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Price</p>
                <p className="text-2xl font-bold">
                  ₹{product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Current Stock</p>
                <div className="flex items-center gap-2">
                  {isLowStock && <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />}
                  <p className={`text-5xl font-black leading-none ${isLowStock ? "text-destructive" : ""}`} data-testid="text-stock-count">
                    {product.stock}
                  </p>
                  <span className="text-sm text-muted-foreground font-semibold self-end mb-1">units</span>
                </div>
              </div>

              {isLowStock && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <p className="text-xs font-bold text-red-700 dark:text-red-400">
                    Low stock! Threshold: {product.lowStockThreshold} units
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Low Stock Threshold</p>
                <p className="text-sm font-semibold">{product.lowStockThreshold} units</p>
              </div>
            </div>

            {/* Image upload section */}
            <div className="mt-4 pt-4 border-t">
              <ImageUploader
                value={(product as any).imageUrl ?? ""}
                onChange={(url) => saveImageUrl(url)}
                onClear={() => saveImageUrl("")}
                label="Product Image"
              />
              {savingImg && <p className="text-xs text-muted-foreground mt-1">Saving…</p>}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Link href="/logs" className="flex items-center justify-between text-sm font-semibold text-primary hover:underline">
                View stock history
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* ── Col 2: Stock adjust ── */}
          <div className="p-5 bg-card border rounded-3xl shadow-sm flex flex-col gap-6">
            <h2 className="text-lg font-bold text-center">Quick Adjust</h2>

            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="w-14 h-14 rounded-full text-2xl font-black shadow-sm"
                onClick={() => { playTick(); setQuantity(Math.max(1, quantity - 1)); }}
              >
                −
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
                onClick={() => { playTick(); setQuantity(quantity + 1); }}
              >
                +
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6 flex-1">
              <Button
                className="h-24 text-lg font-black rounded-2xl bg-green-600 hover:bg-green-700 text-white shadow-lg active:scale-95 transition-all flex flex-col gap-1 items-center justify-center"
                onClick={() => handleStockAction("IN")}
                disabled={updateStock.isPending}
                data-testid="button-stock-in"
              >
                <ArrowDownToLine className="w-6 h-6" />
                STOCK IN
              </Button>

              <Button
                className="h-24 text-lg font-black rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-lg active:scale-95 transition-all flex flex-col gap-1 items-center justify-center"
                onClick={() => handleStockAction("OUT")}
                disabled={updateStock.isPending || product.stock < quantity}
                data-testid="button-stock-out"
              >
                <ArrowUpToLine className="w-6 h-6" />
                STOCK OUT
              </Button>
            </div>
          </div>

          {/* ── Col 3: QR Code (always visible) ── */}
          <div className="p-5 bg-card border rounded-3xl shadow-sm flex flex-col items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Product QR Code</p>
              <p className="text-sm text-muted-foreground">Scan to open this product</p>
            </div>

            {qrLoading ? (
              <Skeleton className="w-48 h-48 rounded-2xl" />
            ) : qrData?.qrDataUrl ? (
              <img
                src={qrData.qrDataUrl}
                alt={`QR code for ${product.sku}`}
                className="w-48 h-48 rounded-2xl border-4 border-muted shadow-sm"
              />
            ) : (
              <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-muted flex items-center justify-center text-muted-foreground text-sm">
                QR unavailable
              </div>
            )}

            <div className="text-center space-y-1">
              <p className="font-mono font-black text-lg tracking-widest">{product.sku}</p>
              <p className="text-xs text-muted-foreground">{product.name}</p>
            </div>

            {qrData?.qrDataUrl && (
              <a
                href={qrData.qrDataUrl}
                download={`${product.sku}-qr.png`}
                className="text-xs font-bold text-primary hover:underline"
              >
                Download QR →
              </a>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
