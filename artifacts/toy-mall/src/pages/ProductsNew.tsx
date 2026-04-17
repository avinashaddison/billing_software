import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { label: "Remote Cars",      value: "Remote Cars",      code: "RC" },
  { label: "Teddy Bears",      value: "Teddy Bears",      code: "TB" },
  { label: "Building Blocks",  value: "Building Blocks",  code: "BB" },
  { label: "Drones",           value: "Drones",           code: "DR" },
] as const;

const createProductSchema = z.object({
  name:              z.string().min(2, "Name must be at least 2 characters"),
  category:          z.string().min(1, "Please select a category"),
  price:             z.coerce.number().min(0.01, "Price must be greater than 0"),
  stock:             z.coerce.number().int().min(0, "Stock cannot be negative").optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
});

type FormValues = z.infer<typeof createProductSchema>;

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchNextSku(categoryCode: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/products/next-sku?categoryCode=${categoryCode}`);
  if (!res.ok) throw new Error("Failed to fetch SKU");
  const data = await res.json();
  return data.sku as string;
}

export default function CreateProduct() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();

  const [autoSku, setAutoSku] = useState<string>("");
  const [skuLoading, setSkuLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name:              "",
      category:          "",
      price:             undefined as unknown as number,
      stock:             0,
      lowStockThreshold: 5,
    },
  });

  const selectedCategory = form.watch("category");

  useEffect(() => {
    if (!selectedCategory) {
      setAutoSku("");
      return;
    }
    const cat = CATEGORIES.find((c) => c.value === selectedCategory);
    if (!cat) return;

    setSkuLoading(true);
    setAutoSku("");
    fetchNextSku(cat.code)
      .then(setAutoSku)
      .catch(() => toast.error("Could not generate SKU"))
      .finally(() => setSkuLoading(false));
  }, [selectedCategory]);

  const onSubmit = (data: FormValues) => {
    if (!autoSku) {
      toast.error("Please select a category to generate the SKU first");
      return;
    }

    createProduct.mutate(
      { data: { ...data, sku: autoSku } },
      {
        onSuccess: (product) => {
          toast.success("Product created!", {
            icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          });
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
      <div className="p-4 md:px-6 border-b flex items-center gap-3 sticky top-0 bg-background z-10">
        <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">New Product</h1>
      </div>

      <div className="p-4 md:p-6 overflow-y-auto flex-1 pb-32 md:pb-6 md:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic info card */}
            <div className="p-5 bg-card border rounded-2xl space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Package className="w-5 h-5" />
                <h2>Basic Info</h2>
              </div>

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Product Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. RC Blue Buggy Pro"
                        className="h-14 text-lg rounded-xl"
                        {...field}
                        data-testid="input-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category dropdown */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-14 text-lg rounded-xl" data-testid="select-category">
                          <SelectValue placeholder="Select a category…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.code} value={cat.value}>
                            <span className="font-semibold">{cat.label}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">({cat.code})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto SKU preview */}
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-muted-foreground">SKU (Auto-generated)</p>
                <div className={`h-14 px-4 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                  autoSku
                    ? "border-green-500/50 bg-green-50 dark:bg-green-950/30"
                    : "border-dashed border-muted bg-muted/30"
                }`}>
                  {skuLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground font-mono text-sm">Generating…</span>
                    </>
                  ) : autoSku ? (
                    <>
                      <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                      <span className="font-mono font-black text-xl text-green-700 dark:text-green-400 tracking-widest">
                        {autoSku}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Select a category to generate SKU
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing & Stock card */}
            <div className="p-5 bg-card border rounded-2xl space-y-5">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Price (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="h-14 text-lg rounded-xl font-mono"
                        {...field}
                        data-testid="input-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Initial Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          className="h-14 text-lg rounded-xl font-mono"
                          {...field}
                          data-testid="input-stock"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-muted-foreground">Alert At</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          className="h-14 text-lg rounded-xl font-mono"
                          {...field}
                          data-testid="input-threshold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-16 text-lg font-black rounded-2xl shadow-xl active:scale-[0.98] transition-transform"
              disabled={createProduct.isPending || skuLoading || !autoSku}
              data-testid="button-submit"
            >
              {createProduct.isPending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating…</>
              ) : (
                "Save Product"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
