import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Layers, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api/${path}`; }

interface Category {
  id: string;
  name: string;
  emoji: string;
  skuCode: string;
  productCount: number;
  totalStock: number;
  createdAt: string;
}

const EMOJI_SUGGESTIONS = [
  "🎁","🦸","🎲","🧱","🪆","🚁","⚽","🧸","🧩","🚗","🐻",
  "🎯","🎪","🎨","🚀","🦄","🐉","🎠","🏆","🎮","🛸","🤖",
  "🎻","🪁","🏹","🎭","🎬","🧲","🌊","🎪",
];

function codeFromName(name: string) {
  return name.replace(/[^a-zA-Z ]/g, "").split(" ")
    .map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 6) || "OTH";
}

const PALETTE = [
  "bg-red-100 text-red-700 border-red-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-lime-100 text-lime-700 border-lime-200",
  "bg-orange-100 text-orange-700 border-orange-200",
];

function cardColor(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

function FormModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Partial<Category>;
  onClose: () => void;
  onSave: (data: { name: string; emoji: string; skuCode: string }) => Promise<void>;
}) {
  const [name, setName]       = useState(initial?.name ?? "");
  const [emoji, setEmoji]     = useState(initial?.emoji ?? "🎁");
  const [skuCode, setSkuCode] = useState(initial?.skuCode ?? "");
  const [saving, setSaving]   = useState(false);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!initial?.skuCode) setSkuCode(codeFromName(v));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Category name is required"); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), emoji, skuCode: skuCode || codeFromName(name) });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Category Name *</Label>
            <Input
              placeholder="e.g. Action Figures"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>SKU Prefix (auto-generated, editable)</Label>
            <Input
              placeholder="e.g. ACT"
              value={skuCode}
              maxLength={6}
              onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">
              Used to generate product codes like <span className="font-mono font-semibold">{skuCode || "ACT"}-001</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Emoji Icon</Label>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl border">
                {emoji}
              </div>
              <Input
                className="w-20 text-center text-xl"
                value={emoji}
                maxLength={2}
                onChange={(e) => setEmoji(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_SUGGESTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg text-lg hover:bg-muted transition-colors ${emoji === e ? "ring-2 ring-primary bg-primary/10" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : initial?.id ? "Update" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Categories() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen]       = useState(false);
  const [editing, setEditing]         = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(apiUrl("categories"));
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const createMut = useMutation({
    mutationFn: async (data: { name: string; emoji: string; skuCode: string }) => {
      const r = await fetch(apiUrl("categories"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => { toast.success("Category created"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; emoji: string; skuCode: string }) => {
      const r = await fetch(apiUrl(`categories/${id}`), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => { toast.success("Category updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(apiUrl(`categories/${id}`), { method: "DELETE" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => { toast.success("Category deleted"); invalidate(); setDeleteTarget(null); },
    onError: (e: Error) => { toast.error(e.message); setDeleteTarget(null); },
  });

  const totalProducts = categories.reduce((s, c) => s + (c.productCount ?? 0), 0);
  const totalStock    = categories.reduce((s, c) => s + (c.totalStock ?? 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organise products into groups · {categories.length} categories · {totalProducts} products · {totalStock} units in stock
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
          <Plus size={16} /> Add Category
        </Button>
      </div>

      {/* Summary row */}
      {categories.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Categories", value: categories.length, icon: Layers, color: "text-violet-500 bg-violet-100" },
            { label: "Total Products", value: totalProducts, icon: Package, color: "text-blue-500 bg-blue-100" },
            { label: "Total Stock Units", value: totalStock.toLocaleString("en-IN"), icon: Package, color: "text-green-500 bg-green-100" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-black">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-3xl">🎁</div>
          <div>
            <p className="font-bold text-foreground">No categories yet</p>
            <p className="text-sm text-muted-foreground">Create your first category to start organising products</p>
          </div>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2 mt-1">
            <Plus size={15} /> Add Category
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="rounded-2xl border bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow relative group"
            >
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${cardColor(idx)}`}>
                  {cat.emoji}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(cat); setFormOpen(true); }}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-red-100 flex items-center justify-center text-muted-foreground hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Name + sku */}
              <div>
                <p className="font-bold text-base text-foreground">{cat.name}</p>
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full bg-muted text-[10px] font-mono font-semibold text-muted-foreground">
                  {cat.skuCode}-###
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm border-t pt-3">
                <div>
                  <p className="font-bold text-foreground">{cat.productCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Products</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">{(cat.totalStock ?? 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground">In Stock</p>
                </div>
              </div>

              {cat.productCount > 0 && (
                <a
                  href={`/products?category=${encodeURIComponent(cat.name)}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View products →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Warning for categories with no products */}
      {categories.some((c) => c.productCount === 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            {categories.filter((c) => c.productCount === 0).length} empty{" "}
            {categories.filter((c) => c.productCount === 0).length === 1 ? "category" : "categories"} — they'll appear in the dropdown when adding products.
          </span>
        </div>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <FormModal
          open={formOpen}
          initial={editing ?? undefined}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, ...data });
            } else {
              await createMut.mutateAsync(data);
            }
          }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.productCount
                ? `This category has ${deleteTarget.productCount} product(s). Deleting it won't remove those products, but they'll lose their category grouping.`
                : "This category is empty and can be safely deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
