import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, CheckCircle2, Loader2, Sparkles, Tag, PenLine, FolderOpen, Eye, TrendingUp, AlertTriangle, Truck, Check, ChevronsUpDown } from "lucide-react";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { LabelCard, type LabelProduct } from "@/components/ui/LabelCard";
import { getCategoryStyle, getCategoryEmoji } from "@/lib/category-colors";

/* ── Helpers ─────────────────────────────────────────────────────── */
function titleCase(str: string) {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function autoFormat(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—]+\s*/g, " – ")
    .split(" – ")
    .map((seg) => titleCase(seg.trim()))
    .join(" – ");
}

function codeFromName(name: string): string {
  const words = name.trim().toUpperCase().replace(/[^A-Z\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "OTH";
  if (words.length === 1) return words[0].slice(0, 4);
  return words.map((w) => w[0]).join("").slice(0, 4);
}

const JUNK_PATTERN = /^(test|abc|xyz|asdf|qwerty|foo|bar|baz|aaa|111|zzz)$/i;

/* ── Zod schema ──────────────────────────────────────────────────── */
const createProductSchema = z.object({
  name:              z.string().min(3, "Name is too short")
                      .refine((v) => v.trim().split(/\s+/).length >= 2, { message: 'Enter a clear name (e.g. "Remote Car – Red – Rechargeable")' })
                      .refine((v) => !JUNK_PATTERN.test(v.trim()), { message: "Enter a real product name, not placeholder text" }),
  category:          z.string().min(1, "Please select a category"),
  customCategory:    z.string().optional(),
  price:             z.coerce.number().min(0.01, "Price must be greater than 0"),
  salePrice:         z.union([z.coerce.number().min(0.01, "Sale price must be greater than 0"), z.literal("")]).optional(),
  purchasePrice:     z.union([z.coerce.number().min(0.01, "Purchase price must be greater than 0"), z.literal("")]).optional(),
  salePriceUntil:    z.string().optional().or(z.literal("")),
  stock:             z.coerce.number().int().min(0, "Stock cannot be negative").optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
  imageUrl:          z.string().optional().or(z.literal("")),
}).refine((d) => {
  if (d.salePrice && typeof d.salePrice === "number") return d.salePrice < d.price;
  return true;
}, { message: "Sale price must be less than the regular price", path: ["salePrice"] });

type FormValues = z.infer<typeof createProductSchema>;

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchNextSku(categoryCode: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/products/next-sku?categoryCode=${encodeURIComponent(categoryCode)}`);
  if (!res.ok) throw new Error("Failed to fetch SKU");
  const data = await res.json();
  return data.sku as string;
}

/* ── Types ───────────────────────────────────────────────────────── */
interface ApiCategory { id: string; name: string; emoji: string; skuCode: string }
interface ApiSupplier { id: string; name: string }

/* ── Margin colour helper ─────────────────────────────────────────── */
function marginColour(pct: number) {
  if (pct >= 30) return { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-400", badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" };
  if (pct >= 15) return { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" };
  return { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" };
}

/* ── Component ───────────────────────────────────────────────────── */
export default function CreateProduct() {
  const [, setLocation] = useLocation();
  const queryClient   = useQueryClient();
  const createProduct = useCreateProduct();

  /* Load categories from the database only */
  const { data: dbCategories = [], isLoading: catsLoading } = useQuery<ApiCategory[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/categories`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 1000 * 60,
  });

  /* Load suppliers */
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<ApiSupplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/suppliers`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 1000 * 60,
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  const [autoSku, setAutoSku]         = useState<string>("");
  const [skuLoading, setSkuLoading]   = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: "", category: "", customCategory: "", price: undefined as unknown as number, stock: 0, lowStockThreshold: 5, imageUrl: "" },
  });

  const selectedCategory     = form.watch("category");
  const customCategoryVal    = form.watch("customCategory") ?? "";
  const currentName          = form.watch("name");
  const watchedPrice         = form.watch("price");
  const watchedSalePrice     = form.watch("salePrice");
  const watchedPurchasePrice = form.watch("purchasePrice");
  const watchedStock         = form.watch("stock");
  const watchedImageUrl      = form.watch("imageUrl");

  /* Live margin calculation */
  const liveMargin = (() => {
    const cost    = parseFloat(String(watchedPurchasePrice ?? ""));
    const sp      = parseFloat(String(watchedSalePrice     ?? ""));
    const mrp     = parseFloat(String(watchedPrice         ?? ""));
    const selling = sp > 0 ? sp : mrp > 0 ? mrp : NaN;
    if (isNaN(cost) || isNaN(selling) || cost <= 0 || selling <= 0) return null;
    const profit = selling - cost;
    const pct    = (profit / selling) * 100;
    return { cost, selling, profit, pct };
  })();

  const isCustom  = selectedCategory === "__custom__";
  const activeCat = dbCategories.find((c) => c.name === selectedCategory) ?? null;

  /* Derived preview values */
  const previewCategory = isCustom ? (customCategoryVal || "Custom") : (selectedCategory || "");
  const previewName     = currentName ? autoFormat(currentName) : "";
  const previewSku      = autoSku || "SKU-XXX";
  const previewMrp      = parseFloat(String(watchedPrice ?? ""));
  const previewSale     = parseFloat(String(watchedSalePrice ?? ""));
  const previewStock    = Number(watchedStock ?? 0);
  const cs              = previewCategory ? getCategoryStyle(previewCategory) : null;
  const catEmoji        = activeCat?.emoji ?? (previewCategory ? getCategoryEmoji(previewCategory) : "🎁");
  const hasPreviewData  = !!previewName && previewMrp > 0;
  const isLowStock      = previewStock > 0 && previewStock <= Number(form.watch("lowStockThreshold") ?? 5);

  /* Label product object for LabelCard */
  const labelProduct: LabelProduct = {
    id:       "preview",
    name:     previewName || "Product Name",
    sku:      previewSku,
    price:    previewMrp > 0 ? previewMrp : 0,
    salePrice: previewSale > 0 ? previewSale : null,
    category: previewCategory || "Category",
    stock:    previewStock,
  };

  /* Auto-generate SKU when category changes */
  useEffect(() => {
    if (!selectedCategory) { setAutoSku(""); return; }
    let code: string;
    if (isCustom) {
      if (!customCategoryVal.trim()) { setAutoSku(""); return; }
      code = codeFromName(customCategoryVal);
    } else {
      code = activeCat?.skuCode ?? codeFromName(selectedCategory);
    }
    setSkuLoading(true);
    setAutoSku("");
    fetchNextSku(code)
      .then(setAutoSku)
      .catch(() => toast.error("Could not generate SKU"))
      .finally(() => setSkuLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, isCustom, customCategoryVal]);

  const handleNameBlur = () => {
    const raw = form.getValues("name");
    if (raw.trim()) form.setValue("name", autoFormat(raw), { shouldValidate: true });
  };

  const onSubmit = (data: FormValues) => {
    if (!autoSku) { toast.error("Please select a category to generate the SKU first"); return; }
    const finalCategory = isCustom ? (data.customCategory?.trim() || "") : data.category;
    if (!finalCategory) { toast.error("Please enter a custom category name"); return; }
    const salePriceVal      = data.salePrice && typeof data.salePrice === "number" ? data.salePrice : undefined;
    const salePriceUntilVal = data.salePriceUntil ? new Date(data.salePriceUntil).toISOString() : null;
    const purchasePriceVal  = data.purchasePrice && typeof data.purchasePrice === "number" ? data.purchasePrice : undefined;
    createProduct.mutate(
      { data: { name: data.name, category: finalCategory, price: data.price, salePrice: salePriceVal ?? null, salePriceUntil: salePriceUntilVal, purchasePrice: purchasePriceVal ?? null, stock: data.stock ?? 0, lowStockThreshold: data.lowStockThreshold ?? 5, sku: autoSku, imageUrl: data.imageUrl || null, supplierId: selectedSupplierId || null } },
      {
        onSuccess: (product) => {
          toast.success("Product created!", { icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setLocation(`/product?sku=${product.sku}`);
        },
        onError: (error: any) => {
          toast.error(error?.data?.error || error.message || "Failed to create product");
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Page header ── */}
      <div className="p-4 md:px-6 border-b flex items-center gap-3 sticky top-0 bg-background z-10">
        <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">New Product</h1>
      </div>

      {/* ── Two-column layout on desktop ── */}
      <div className="overflow-y-auto flex-1 pb-32 md:pb-6">
        <div className="p-4 md:p-6 md:grid md:grid-cols-[minmax(0,540px)_1fr] md:gap-8 md:items-start md:max-w-6xl">

          {/* ─── LEFT: Form ─────────────────────────────────────────── */}
          <div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* ── Basic Info ── */}
                <div className="p-5 bg-card border rounded-2xl space-y-5">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Package className="w-5 h-5" />
                    <h2>Basic Info</h2>
                  </div>

                  {/* Category combobox (searchable) */}
                  <FormField control={form.control} name="category" render={({ field }) => {
                    const selectedCat = dbCategories.find((c) => c.name === field.value);
                    const isCustomSelected = field.value === "__custom__";
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-bold text-muted-foreground">
                          <Tag className="w-3.5 h-3.5 inline mr-1.5" />Category
                        </FormLabel>
                        <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={categoryOpen}
                                className={cn(
                                  "h-14 text-base rounded-xl justify-between font-normal w-full",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <span className="flex items-center gap-2 truncate">
                                  {selectedCat ? (
                                    <>
                                      <span>{selectedCat.emoji}</span>
                                      <span className="font-semibold">{selectedCat.name}</span>
                                      <span className="font-mono text-xs text-muted-foreground">({selectedCat.skuCode})</span>
                                    </>
                                  ) : isCustomSelected ? (
                                    <><span>🎁</span><span className="font-semibold">Other / Custom</span></>
                                  ) : (
                                    catsLoading
                                      ? "Loading categories…"
                                      : dbCategories.length === 0
                                        ? "No categories yet — create one first"
                                        : "Select a category…"
                                  )}
                                </span>
                                <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                            <Command
                              filter={(value, search) => {
                                if (!search) return 1;
                                const v = value.toLowerCase();
                                const s = search.toLowerCase();
                                if (v.startsWith(s)) return 2;
                                if (v.includes(s))   return 1;
                                return 0;
                              }}
                            >
                              <CommandInput placeholder="Search category…" autoFocus />
                              <CommandList className="max-h-72">
                                <CommandEmpty>No category found.</CommandEmpty>
                                <CommandGroup>
                                  {dbCategories.map((cat) => (
                                    <CommandItem
                                      key={cat.id}
                                      value={`${cat.name} ${cat.skuCode}`}
                                      onSelect={() => {
                                        field.onChange(cat.name);
                                        form.setValue("customCategory", "");
                                        setCategoryOpen(false);
                                      }}
                                    >
                                      <span className="mr-2">{cat.emoji}</span>
                                      <span className="font-semibold flex-1">{cat.name}</span>
                                      <span className="ml-2 font-mono text-xs text-muted-foreground">({cat.skuCode})</span>
                                      <Check className={cn("ml-2 w-4 h-4", field.value === cat.name ? "opacity-100" : "opacity-0")} />
                                    </CommandItem>
                                  ))}
                                  <CommandItem
                                    value="Other Custom"
                                    onSelect={() => {
                                      field.onChange("__custom__");
                                      setCategoryOpen(false);
                                    }}
                                  >
                                    <span className="mr-2">🎁</span>
                                    <span className="font-semibold flex-1">Other / Custom</span>
                                    <Check className={cn("ml-2 w-4 h-4", isCustomSelected ? "opacity-100" : "opacity-0")} />
                                  </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                        {dbCategories.length === 0 && !catsLoading && (
                          <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                            <FolderOpen className="w-3.5 h-3.5" />
                            No categories in database.{" "}
                            <Link href="/categories" className="underline font-bold">Add categories here</Link> first, or use "Other / Custom" below.
                          </p>
                        )}
                      </FormItem>
                    );
                  }} />

                  {/* Custom category input */}
                  {isCustom && (
                    <FormField control={form.control} name="customCategory" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-muted-foreground">
                          <PenLine className="w-3.5 h-3.5 inline mr-1.5" />Custom Category Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Water Guns, Art & Craft, Musical Toys…"
                            className="h-12 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-[11px] text-muted-foreground">
                          SKU prefix will be auto-derived from your category name.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {/* Supplier dropdown */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-muted-foreground">
                      <Truck className="w-3.5 h-3.5 inline mr-1.5" />Supplier — optional
                    </p>
                    <Select
                      value={selectedSupplierId}
                      onValueChange={(v) => setSelectedSupplierId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder={suppliersLoading ? "Loading suppliers…" : "Select a supplier…"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {!suppliersLoading && suppliers.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                            No suppliers yet —{" "}
                            <Link href="/suppliers" className="font-bold underline">add one in Suppliers</Link>
                          </div>
                        ) : (
                          <>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">None</span>
                            </SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="font-semibold">{s.name}</span>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Product name */}
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Product Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={activeCat ? `e.g. ${activeCat.name} – …` : "Select a category first…"}
                          className="h-14 text-lg rounded-xl"
                          {...field}
                          ref={nameRef}
                          onBlur={handleNameBlur}
                          disabled={!selectedCategory || (isCustom && !customCategoryVal.trim())}
                        />
                      </FormControl>
                      <FormMessage />
                      {currentName && (
                        <p className="text-xs text-muted-foreground">
                          Will save as: <span className="font-semibold text-foreground">{autoFormat(currentName)}</span>
                        </p>
                      )}
                    </FormItem>
                  )} />

                  {/* Auto SKU */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-muted-foreground">SKU (Auto-generated)</p>
                    <div className={`h-14 px-4 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                      autoSku ? "border-green-500/50 bg-green-50 dark:bg-green-950/30" : "border-dashed border-muted bg-muted/30"
                    }`}>
                      {skuLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><span className="text-muted-foreground font-mono text-sm">Generating…</span></>
                      ) : autoSku ? (
                        <><Sparkles className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="font-mono font-black text-xl text-green-700 dark:text-green-400 tracking-widest">{autoSku}</span></>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {isCustom ? "Enter a category name above to generate SKU" : "Select a category to generate SKU"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Pricing & Stock ── */}
                <div className="p-5 bg-card border rounded-2xl space-y-5">
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">MRP / Regular Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" className="h-14 text-lg rounded-xl font-mono" onWheel={(e) => e.currentTarget.blur()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="salePrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Sale Price (₹) — optional</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Leave blank if no sale" className="h-14 text-lg rounded-xl font-mono"
                          value={field.value === "" || field.value == null ? "" : String(field.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => field.onChange(e.target.value === "" ? "" : e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Purchase / Cost Price (₹) — optional</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Your cost from supplier" className="h-14 text-lg rounded-xl font-mono"
                          value={field.value === "" || field.value == null ? "" : String(field.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => field.onChange(e.target.value === "" ? "" : e.target.value)} />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">Used for profit margin reports. Not shown on receipts.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Live margin strip — mobile only (desktop shows it in the right panel) */}
                  {liveMargin && (() => {
                    const mc = marginColour(liveMargin.pct);
                    return (
                      <div className={`md:hidden rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition-all ${mc.bg} ${mc.border}`}>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Live Margin</div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[11px] text-muted-foreground">Profit per unit</p>
                            <p className={`font-black text-sm ${mc.text}`}>
                              {liveMargin.profit >= 0 ? "+" : ""}₹{liveMargin.profit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className={`text-2xl font-black px-3 py-1 rounded-xl ${mc.badge}`}>
                            {liveMargin.pct.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <FormField control={form.control} name="salePriceUntil" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Sale Ends On — optional</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-14 text-base rounded-xl" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">Sale price reverts to regular price automatically after this date.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="stock" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-muted-foreground">Initial Stock</FormLabel>
                        <FormControl>
                          <Input type="number" className="h-14 text-lg rounded-xl font-mono" onWheel={(e) => e.currentTarget.blur()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-muted-foreground">Alert At</FormLabel>
                        <FormControl>
                          <Input type="number" className="h-14 text-lg rounded-xl font-mono" onWheel={(e) => e.currentTarget.blur()} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Image upload */}
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ImageUploader
                          value={field.value || ""}
                          onChange={(url) => field.onChange(url)}
                          onClear={() => field.onChange("")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button
                  type="submit"
                  className="w-full h-16 text-lg font-black rounded-2xl shadow-xl active:scale-[0.98] transition-transform"
                  disabled={createProduct.isPending || skuLoading || !autoSku || (isCustom && !customCategoryVal.trim())}
                >
                  {createProduct.isPending
                    ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating…</>
                    : "Save Product"
                  }
                </Button>
              </form>
            </Form>
          </div>

          {/* ─── RIGHT: Live preview panel (desktop only) ────────────── */}
          <div className="hidden md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto md:py-6">
            <div className="space-y-4">

              {/* Panel header */}
              <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground px-1">
                <Eye className="w-4 h-4" />
                <span>Live Preview</span>
              </div>

              {/* ── Product card preview — mirrors ProductMobileCard from Products.tsx ── */}
              <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                <div className="px-4 py-2.5 border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Product Card
                </div>
                <div className="p-4">
                  {!hasPreviewData ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl">🎁</div>
                      <p className="text-sm font-medium text-muted-foreground">Fill in a name and price<br/>to see a live preview</p>
                    </div>
                  ) : (
                    /* Mirrors ProductMobileCard from Products.tsx */
                    <div className="rounded-xl border bg-card overflow-hidden">
                      {/* Image / placeholder */}
                      {watchedImageUrl ? (
                        <div className="h-32 overflow-hidden bg-muted">
                          <img src={watchedImageUrl} alt={previewName} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-20 bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-4xl">
                          {catEmoji}
                        </div>
                      )}
                    <div className="p-4 flex items-center justify-between relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cs?.dot ?? "bg-muted"}`} />
                      <div className="flex-1 min-w-0 pr-4 pl-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{catEmoji}</span>
                          <h3 className="font-bold text-base truncate">{previewName}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md text-xs">{previewSku}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cs?.badge ?? "bg-muted text-muted-foreground"}`}>{previewCategory || "Category"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <div className={`text-2xl font-black leading-none flex items-center gap-1 ${isLowStock ? "text-red-600 dark:text-red-400" : ""}`}>
                          {isLowStock && <AlertTriangle className="w-4 h-4" />}
                          {previewStock}
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Left</span>
                        {previewSale > 0 ? (
                          <span className="text-[10px]">
                            <span className="line-through text-muted-foreground">₹{previewMrp.toLocaleString("en-IN")}</span>
                            {" "}<span className="text-red-600 font-bold">₹{previewSale.toLocaleString("en-IN")}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">₹{previewMrp.toLocaleString("en-IN")}</span>
                        )}
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Margin breakdown ── */}
              {liveMargin && (() => {
                const mc = marginColour(liveMargin.pct);
                return (
                  <div className={`border rounded-2xl overflow-hidden bg-card shadow-sm ${mc.border}`}>
                    <div className={`px-4 py-2.5 border-b text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${mc.bg} ${mc.text}`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                      Margin Breakdown
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Cost price</span>
                          <span className="font-bold font-mono">₹{liveMargin.cost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Selling price
                            {previewSale > 0 && <span className="ml-1 text-[10px] text-red-500 font-bold">SALE</span>}
                          </span>
                          <span className="font-bold font-mono">₹{liveMargin.selling.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Profit per unit</span>
                          <span className={`font-black font-mono ${mc.text}`}>
                            {liveMargin.profit >= 0 ? "+" : ""}₹{liveMargin.profit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${mc.bg}`}>
                        <span className={`text-xs font-bold ${mc.text}`}>Margin</span>
                        <span className={`text-3xl font-black ${mc.text}`}>{liveMargin.pct.toFixed(1)}%</span>
                      </div>
                      {liveMargin.pct < 15 && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          Low margin — consider adjusting the price or cost.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Label preview — print-mode 50×24mm label, scaled down to 70% ── */}
              {hasPreviewData && (
                <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <div className="px-4 py-2.5 border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Shelf Label Preview
                  </div>
                  <div className="p-4 flex flex-col items-center gap-2">
                    {/*
                      Print label is 50mm × 24mm. At 96dpi: ~189px × 91px.
                      Scale to 70% → clip container to ~132px × 64px.
                    */}
                    <div style={{ width: 133, height: 64, overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ transform: "scale(0.7)", transformOrigin: "top left" }}>
                        <LabelCard p={labelProduct} printMode={true} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">50mm × 24mm thermal label</p>
                  </div>
                </div>
              )}

              {/* Tip when no data yet */}
              {!hasPreviewData && (
                <div className="rounded-2xl border border-dashed border-muted-foreground/20 p-5 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Fill in the form on the left and the product card, margin breakdown, and shelf label will appear here instantly.
                  </p>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
