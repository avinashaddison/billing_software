import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, CheckCircle2, Loader2, Sparkles, Lightbulb } from "lucide-react";
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

/* ── Constants ───────────────────────────────────────────────────── */

const CATEGORIES = [
  {
    label: "Remote Cars",
    value: "Remote Cars",
    code: "RC",
    placeholder: "e.g. Remote Car – Red – Rechargeable",
    formatHint: "Remote Car – [Colour] – [Feature]",
    suggestions: [
      "Remote Car – Red – Rechargeable",
      "Remote Car – Blue – Big",
      "Remote Car – Black – Drift",
      "Remote Car – Yellow – Off-Road",
    ],
  },
  {
    label: "Teddy Bears",
    value: "Teddy Bears",
    code: "TB",
    placeholder: "e.g. Teddy Bear – Pink – 2ft",
    formatHint: "Teddy Bear – [Colour] – [Size]",
    suggestions: [
      "Teddy Bear – Pink – 2ft",
      "Teddy Bear – Brown – Soft",
      "Teddy Bear – White – XL",
      "Teddy Bear – Grey – Mini",
    ],
  },
  {
    label: "Building Blocks",
    value: "Building Blocks",
    code: "BB",
    placeholder: "e.g. Building Blocks – City – 200 Pcs",
    formatHint: "Building Blocks – [Theme] – [Pieces]",
    suggestions: [
      "Building Blocks – City – 200 Pcs",
      "Building Blocks – Classic – Starter",
      "Building Blocks – Space – 500 Pcs",
      "Building Blocks – Farm – 100 Pcs",
    ],
  },
  {
    label: "Drones",
    value: "Drones",
    code: "DR",
    placeholder: "e.g. Drone – Mini – Foldable",
    formatHint: "Drone – [Size] – [Feature]",
    suggestions: [
      "Drone – Mini – Foldable",
      "Drone – Racing – Pro",
      "Drone – Camera – 4K",
      "Drone – Glow – Night Edition",
    ],
  },
] as const;

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Title-case every word */
function titleCase(str: string) {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Auto-format a raw name string:
 *  - trim & collapse spaces
 *  - replace " - " / " -- " / "  " between words with " – "
 *  - title-case each segment
 */
function autoFormat(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")                    // collapse spaces
    .replace(/\s*[-–—]+\s*/g, " – ")         // normalise separators to em-dash
    .split(" – ")
    .map((seg) => titleCase(seg.trim()))
    .join(" – ");
}

const JUNK_PATTERN = /^(test|abc|xyz|asdf|qwerty|foo|bar|baz|aaa|111|zzz)$/i;

/* ── Zod schema ──────────────────────────────────────────────────── */

const createProductSchema = z.object({
  name: z
    .string()
    .min(3, "Name is too short")
    .refine((v) => v.trim().split(/\s+/).length >= 2, {
      message: 'Please enter a clear name (e.g. "Remote Car – Red – Rechargeable")',
    })
    .refine((v) => !JUNK_PATTERN.test(v.trim()), {
      message: "Please enter a real product name, not placeholder text",
    }),
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

/* ── Component ───────────────────────────────────────────────────── */

export default function CreateProduct() {
  const [, setLocation] = useLocation();
  const queryClient   = useQueryClient();
  const createProduct = useCreateProduct();

  const [autoSku, setAutoSku]       = useState<string>("");
  const [skuLoading, setSkuLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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
  const currentName      = form.watch("name");

  const activeCat = CATEGORIES.find((c) => c.value === selectedCategory) ?? null;

  /* Auto-generate SKU when category changes */
  useEffect(() => {
    if (!selectedCategory) { setAutoSku(""); return; }
    const cat = CATEGORIES.find((c) => c.value === selectedCategory);
    if (!cat) return;
    setSkuLoading(true);
    setAutoSku("");
    fetchNextSku(cat.code)
      .then(setAutoSku)
      .catch(() => toast.error("Could not generate SKU"))
      .finally(() => setSkuLoading(false));
  }, [selectedCategory]);

  /* Show suggestions when category selected and name field is empty / focused */
  const handleNameFocus = () => { if (activeCat) setShowSuggestions(true); };
  const handleNameBlur  = () => {
    // delay so click on suggestion chip registers first
    setTimeout(() => setShowSuggestions(false), 150);
    // auto-format on blur
    const raw = form.getValues("name");
    if (raw.trim()) form.setValue("name", autoFormat(raw), { shouldValidate: true });
  };

  const applySuggestion = (name: string) => {
    form.setValue("name", name, { shouldValidate: true });
    setShowSuggestions(false);
    nameRef.current?.blur();
  };

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

            {/* ── Basic Info card ── */}
            <div className="p-5 bg-card border rounded-2xl space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Package className="w-5 h-5" />
                <h2>Basic Info</h2>
              </div>

              {/* 1. Category first */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-14 text-lg rounded-xl" data-testid="select-category">
                          <SelectValue placeholder="Select a category first…" />
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

              {/* 2. Product Name with suggestions */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Product Name</FormLabel>

                    {/* Format hint */}
                    {activeCat && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>Format: <span className="font-semibold text-foreground">{activeCat.formatHint}</span></span>
                      </div>
                    )}

                    <div className="relative">
                      <FormControl>
                        <Input
                          ref={nameRef}
                          placeholder={activeCat?.placeholder ?? "Select a category first…"}
                          className="h-14 text-lg rounded-xl"
                          {...field}
                          onFocus={handleNameFocus}
                          onBlur={handleNameBlur}
                          disabled={!selectedCategory}
                          data-testid="input-name"
                        />
                      </FormControl>

                      {/* Suggestion chips dropdown */}
                      {showSuggestions && activeCat && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border rounded-xl shadow-xl overflow-hidden">
                          <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Suggestions
                          </p>
                          {activeCat.suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted transition-colors border-t border-border/50 first:border-0"
                              onMouseDown={() => applySuggestion(s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <FormMessage />

                    {/* Live format preview after user types something */}
                    {currentName && !showSuggestions && (
                      <p className="text-xs text-muted-foreground">
                        Will save as:{" "}
                        <span className="font-semibold text-foreground">{autoFormat(currentName)}</span>
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* 3. Auto SKU display */}
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

            {/* ── Pricing & Stock card ── */}
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
                        <Input type="number" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-stock" />
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
                        <Input type="number" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-threshold" />
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
