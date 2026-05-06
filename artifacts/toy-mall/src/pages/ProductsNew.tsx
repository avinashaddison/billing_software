import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, CheckCircle2, Loader2, Sparkles, Lightbulb, Tag, PenLine } from "lucide-react";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── Categories ─────────────────────────────────────────────────── */
const CATEGORIES = [
  {
    label: "Action Figures",   value: "Action Figures",   code: "ACT", emoji: "🦸",
    placeholder: "e.g. Action Figure – Spider-Man – 12 inch",
    formatHint: "Action Figure – [Character] – [Size]",
    suggestions: ["Action Figure – Spider-Man – 12 inch", "Action Figure – Batman – Deluxe", "Action Figure – Iron Man – Mini", "Action Figure – Captain Rex – 6 inch"],
  },
  {
    label: "Board Games",      value: "Board Games",      code: "BG",  emoji: "🎲",
    placeholder: "e.g. Board Game – Monopoly – Junior",
    formatHint: "Board Game – [Name] – [Edition]",
    suggestions: ["Board Game – Monopoly – Junior", "Board Game – Ludo – Classic", "Board Game – Chess – Wooden", "Board Game – Scrabble – Family"],
  },
  {
    label: "Building Blocks",  value: "Building Blocks",  code: "BB",  emoji: "🧱",
    placeholder: "e.g. Building Blocks – City – 200 Pcs",
    formatHint: "Building Blocks – [Theme] – [Pieces]",
    suggestions: ["Building Blocks – City – 200 Pcs", "Building Blocks – Classic – Starter", "Building Blocks – Space – 500 Pcs", "Building Blocks – Farm – 100 Pcs"],
  },
  {
    label: "Dolls",            value: "Dolls",            code: "DL",  emoji: "🪆",
    placeholder: "e.g. Doll – Barbie – Dream House",
    formatHint: "Doll – [Name] – [Set/Theme]",
    suggestions: ["Doll – Barbie – Dream House", "Doll – Baby – Soft Body", "Doll – Fashion – Deluxe", "Doll – Talking – Interactive"],
  },
  {
    label: "Drones",           value: "Drones",           code: "DR",  emoji: "🚁",
    placeholder: "e.g. Drone – Mini – Foldable",
    formatHint: "Drone – [Size] – [Feature]",
    suggestions: ["Drone – Mini – Foldable", "Drone – Racing – Pro", "Drone – Camera – 4K", "Drone – Glow – Night Edition"],
  },
  {
    label: "Outdoor Toys",     value: "Outdoor Toys",     code: "OUT", emoji: "⚽",
    placeholder: "e.g. Outdoor Toy – Cricket Set – Junior",
    formatHint: "Outdoor Toy – [Type] – [Size/Edition]",
    suggestions: ["Outdoor Toy – Cricket Set – Junior", "Outdoor Toy – Football – Size 5", "Outdoor Toy – Frisbee – Glow", "Outdoor Toy – Badminton – Family Set"],
  },
  {
    label: "Plush Toys",       value: "Plush Toys",       code: "PL",  emoji: "🧸",
    placeholder: "e.g. Plush Toy – Teddy Bear – XL Pink",
    formatHint: "Plush Toy – [Character] – [Size/Colour]",
    suggestions: ["Plush Toy – Teddy Bear – XL Pink", "Plush Toy – Elephant – Soft Grey", "Plush Toy – Unicorn – Rainbow", "Plush Toy – Dinosaur – Green"],
  },
  {
    label: "Puzzles",          value: "Puzzles",          code: "PUZ", emoji: "🧩",
    placeholder: "e.g. Puzzle – Animals – 100 Pcs",
    formatHint: "Puzzle – [Theme] – [Pieces]",
    suggestions: ["Puzzle – Animals – 100 Pcs", "Puzzle – World Map – 500 Pcs", "Puzzle – Dinosaur – 50 Pcs", "Puzzle – 3D Castle – 200 Pcs"],
  },
  {
    label: "Remote Control",   value: "Remote Control",   code: "RC",  emoji: "🚗",
    placeholder: "e.g. Remote Car – Red – Rechargeable",
    formatHint: "Remote [Type] – [Colour] – [Feature]",
    suggestions: ["Remote Car – Red – Rechargeable", "Remote Car – Blue – Drift", "Remote Helicopter – Black – 4CH", "Remote Boat – White – Speed"],
  },
  {
    label: "Teddy Bears",      value: "Teddy Bears",      code: "TB",  emoji: "🐻",
    placeholder: "e.g. Teddy Bear – Pink – 2ft",
    formatHint: "Teddy Bear – [Colour] – [Size]",
    suggestions: ["Teddy Bear – Pink – 2ft", "Teddy Bear – Brown – Soft", "Teddy Bear – White – XL", "Teddy Bear – Grey – Mini"],
  },
  {
    label: "Other / Custom",   value: "__custom__",        code: "OTH", emoji: "🎁",
    placeholder: "Type your category name…",
    formatHint: "Enter any category that fits your product",
    suggestions: [],
  },
] as const;

type CategoryValue = typeof CATEGORIES[number]["value"];

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

/** Generate a 2–4 letter code from a custom category name */
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
  stock:             z.coerce.number().int().min(0, "Stock cannot be negative").optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
  imageUrl:          z.string().optional().or(z.literal("")),
}).refine((d) => {
  if (d.salePrice && typeof d.salePrice === "number") {
    return d.salePrice < d.price;
  }
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

/* ── Component ───────────────────────────────────────────────────── */
interface ApiCategory { id: string; name: string; emoji: string; skuCode: string }

export default function CreateProduct() {
  const [, setLocation] = useLocation();
  const queryClient   = useQueryClient();
  const createProduct = useCreateProduct();

  /* Load categories from the API to pick up custom ones created on /categories */
  const { data: apiCats = [] } = useQuery<ApiCategory[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/categories`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 1000 * 60,
  });

  /* Merge: hardcoded cats keep rich metadata; API-only cats get generic entry */
  const hardcodedNames = new Set(CATEGORIES.filter((c) => c.value !== "__custom__").map((c) => c.value));
  const extraApiCats = apiCats.filter((a) => !(hardcodedNames as Set<string>).has(a.name));

  const [autoSku, setAutoSku]             = useState<string>("");
  const [skuLoading, setSkuLoading]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: "", category: "", customCategory: "", price: undefined as unknown as number, stock: 0, lowStockThreshold: 5, imageUrl: "" },
  });

  const selectedCategory  = form.watch("category") as CategoryValue | "";
  const customCategoryVal = form.watch("customCategory") ?? "";
  const currentName       = form.watch("name");

  const isCustom  = selectedCategory === "__custom__";
  const activeCat = CATEGORIES.find((c) => c.value === selectedCategory) ?? null;

  /* Resolve the final category string for saving */
  const resolvedCategory = isCustom ? customCategoryVal.trim() : (selectedCategory || "");

  /* Auto-generate SKU when category (or custom name) changes */
  useEffect(() => {
    if (!selectedCategory) { setAutoSku(""); return; }
    let code: string;
    if (isCustom) {
      if (!customCategoryVal.trim()) { setAutoSku(""); return; }
      code = codeFromName(customCategoryVal);
    } else {
      const hardcodedCode = CATEGORIES.find((c) => c.value === selectedCategory)?.code;
      const apiCode = apiCats.find((c) => c.name === selectedCategory)?.skuCode;
      code = hardcodedCode ?? apiCode ?? "OTH";
    }
    setSkuLoading(true);
    setAutoSku("");
    fetchNextSku(code)
      .then(setAutoSku)
      .catch(() => toast.error("Could not generate SKU"))
      .finally(() => setSkuLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, isCustom, customCategoryVal, apiCats]);

  const handleNameFocus = () => { if (activeCat && !isCustom) setShowSuggestions(true); };
  const handleNameBlur  = () => {
    setTimeout(() => setShowSuggestions(false), 150);
    const raw = form.getValues("name");
    if (raw.trim()) form.setValue("name", autoFormat(raw), { shouldValidate: true });
  };
  const applySuggestion = (name: string) => {
    form.setValue("name", name, { shouldValidate: true });
    setShowSuggestions(false);
    nameRef.current?.blur();
  };

  const onSubmit = (data: FormValues) => {
    if (!autoSku) { toast.error("Please select a category to generate the SKU first"); return; }
    const finalCategory = isCustom ? (data.customCategory?.trim() || "") : data.category;
    if (!finalCategory) { toast.error("Please enter a custom category name"); return; }
    const salePriceVal = data.salePrice && typeof data.salePrice === "number" ? data.salePrice : undefined;
    createProduct.mutate(
      { data: { name: data.name, category: finalCategory, price: data.price, salePrice: salePriceVal ?? null, stock: data.stock ?? 0, lowStockThreshold: data.lowStockThreshold ?? 5, sku: autoSku, imageUrl: data.imageUrl || null } },
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
      <div className="p-4 md:px-6 border-b flex items-center gap-3 sticky top-0 bg-background z-10">
        <Link href="/products" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">New Product</h1>
      </div>

      <div className="p-4 md:p-6 overflow-y-auto flex-1 pb-32 md:pb-6 md:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Basic Info ── */}
            <div className="p-5 bg-card border rounded-2xl space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Package className="w-5 h-5" />
                <h2>Basic Info</h2>
              </div>

              {/* Category dropdown */}
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-muted-foreground">
                    <Tag className="w-3.5 h-3.5 inline mr-1.5" />Category
                  </FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); form.setValue("customCategory", ""); }} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-14 text-base rounded-xl" data-testid="select-category">
                        <SelectValue placeholder="Select a category…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-72">
                      {CATEGORIES.filter((c) => c.value !== "__custom__").map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="mr-2">{cat.emoji}</span>
                          <span className="font-semibold">{cat.label}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">({cat.code})</span>
                        </SelectItem>
                      ))}
                      {extraApiCats.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>
                          <span className="mr-2">{cat.emoji}</span>
                          <span className="font-semibold">{cat.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">({cat.skuCode})</span>
                        </SelectItem>
                      ))}
                      {/* Always-available custom option */}
                      <SelectItem value="__custom__">
                        <span className="mr-2">🎁</span>
                        <span className="font-semibold">Other / Custom</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Custom category text input — shown only when "Other / Custom" is selected */}
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

              {/* Product name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold text-muted-foreground">Product Name</FormLabel>
                  {activeCat && !isCustom && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                      <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <span>Format: <span className="font-semibold text-foreground">{activeCat.formatHint}</span></span>
                    </div>
                  )}
                  <div className="relative">
                    <FormControl>
                      <Input
                        placeholder={activeCat?.placeholder ?? "Select a category first…"}
                        className="h-14 text-lg rounded-xl"
                        {...field}
                        ref={nameRef}
                        onFocus={handleNameFocus}
                        onBlur={handleNameBlur}
                        disabled={!selectedCategory || (isCustom && !customCategoryVal.trim())}
                        data-testid="input-name"
                      />
                    </FormControl>
                    {showSuggestions && activeCat && !isCustom && activeCat.suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border rounded-xl shadow-xl overflow-hidden">
                        <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Suggestions
                        </p>
                        {activeCat.suggestions.map((s) => (
                          <button key={s} type="button"
                            className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted transition-colors border-t border-border/50 first:border-0"
                            onMouseDown={() => applySuggestion(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                  {currentName && !showSuggestions && (
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
                    <Input type="number" step="0.01" placeholder="0.00" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-price" />
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
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : e.target.value)}
                      data-testid="input-sale-price" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Initial Stock</FormLabel>
                    <FormControl>
                      <Input type="number" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-stock" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-muted-foreground">Alert At</FormLabel>
                    <FormControl>
                      <Input type="number" className="h-14 text-lg rounded-xl font-mono" {...field} data-testid="input-threshold" />
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
              data-testid="button-submit"
            >
              {createProduct.isPending
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating…</>
                : "Save Product"
              }
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
