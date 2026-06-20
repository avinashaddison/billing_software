import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Truck, Plus, X, Edit3, Check, Phone, Mail, MapPin, FileText, Loader2, Search, Package, ChevronDown, AlertTriangle, Wallet, Trash2, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getCategoryEmoji } from "@/lib/category-colors";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Supplier {
  id: string; name: string; contact?: string;
  email?: string; phone?: string; address?: string; notes?: string;
  createdAt: string;
  totalPaid?: string | number;
  paymentCount?: number;
}

interface ProductLite {
  id: string; name: string; sku: string; category: string;
  price: number; stock: number; lowStockThreshold: number;
  supplierId?: string | null;
}

interface Payment {
  id: string; supplierId: string; amount: string;
  method: string; note?: string | null; paidAt: string; createdAt: string;
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi",  label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];

const inr = (n: number | string) =>
  Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

async function fetchSuppliers(): Promise<Supplier[]> {
  const r = await fetch(`${BASE_URL}/api/suppliers`);
  return r.json();
}

async function fetchProducts(): Promise<ProductLite[]> {
  const r = await fetch(`${BASE_URL}/api/products`);
  if (!r.ok) return [];
  return r.json();
}

async function fetchPayments(supplierId: string): Promise<Payment[]> {
  const r = await fetch(`${BASE_URL}/api/suppliers/${supplierId}/payments`);
  if (!r.ok) return [];
  return r.json();
}

export default function Suppliers() {
  const { role } = useAuth();
  const isAdmin = role === "owner";
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts]   = useState<ProductLite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", contact: "", email: "", phone: "", address: "", notes: "" });

  // ── payment history state ──
  const [payExpanded, setPayExpanded] = useState<Set<string>>(new Set());
  const [paymentsMap, setPaymentsMap] = useState<Record<string, Payment[]>>({});
  const [payLoading, setPayLoading]   = useState<Set<string>>(new Set());
  const [payFormFor, setPayFormFor]   = useState<string | null>(null);
  const [payForm, setPayForm]         = useState({ amount: "", method: "cash", paidAt: "", note: "" });
  const [paySaving, setPaySaving]     = useState(false);

  const load = () => Promise.all([fetchSuppliers(), fetchProducts()])
    .then(([s, p]) => { setSuppliers(s); setProducts(p); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const productsBySupplier = useMemo(() => {
    const map = new Map<string, ProductLite[]>();
    for (const p of products) {
      if (!p.supplierId) continue;
      const list = map.get(p.supplierId) ?? [];
      list.push(p);
      map.set(p.supplierId, list);
    }
    return map;
  }, [products]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadPayments = async (id: string) => {
    setPayLoading((s) => new Set(s).add(id));
    const list = await fetchPayments(id);
    setPaymentsMap((m) => ({ ...m, [id]: list }));
    setPayLoading((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const togglePayments = (id: string) => {
    setPayExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); if (!paymentsMap[id]) loadPayments(id); }
      return next;
    });
  };

  const openPayForm = (id: string) => {
    setPayForm({ amount: "", method: "cash", paidAt: new Date().toISOString().slice(0, 10), note: "" });
    setPayFormFor(id);
    setPayExpanded((prev) => new Set(prev).add(id));
    if (!paymentsMap[id]) loadPayments(id);
  };

  const handleAddPayment = async (supplierId: string) => {
    const amt = Number(payForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setPaySaving(true);
    try {
      const body: Record<string, unknown> = { amount: amt, method: payForm.method };
      if (payForm.note.trim()) body.note = payForm.note.trim();
      if (payForm.paidAt) body.paidAt = payForm.paidAt;
      const r = await fetch(`${BASE_URL}/api/suppliers/${supplierId}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
      toast.success("Payment recorded");
      setPayFormFor(null);
      setPayForm({ amount: "", method: "cash", paidAt: "", note: "" });
      await loadPayments(supplierId);
      load();
    } catch (e: any) { toast.error(e.message || "Failed to record payment"); }
    finally { setPaySaving(false); }
  };

  const handleDeletePayment = async (supplierId: string, paymentId: string) => {
    if (!confirm("Delete this payment record?")) return;
    const r = await fetch(`${BASE_URL}/api/suppliers/${supplierId}/payments/${paymentId}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Delete failed"); return; }
    toast.success("Payment deleted");
    await loadPayments(supplierId);
    load();
  };

  const filtered = suppliers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) || s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => { setForm({ name: "", contact: "", email: "", phone: "", address: "", notes: "" }); setEditId(null); setShowForm(false); };

  const startEdit = (s: Supplier) => {
    setForm({ name: s.name, contact: s.contact ?? "", email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "", notes: s.notes ?? "" });
    setEditId(s.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Supplier name is required"); return; }
    setSaving(true);
    try {
      const url    = editId ? `${BASE_URL}/api/suppliers/${editId}` : `${BASE_URL}/api/suppliers`;
      const method = editId ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      toast.success(editId ? "Supplier updated" : "Supplier added");
      resetForm();
      load();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"? This also removes its payment history.`)) return;
    await fetch(`${BASE_URL}/api/suppliers/${id}`, { method: "DELETE" });
    toast.success("Supplier deleted");
    load();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Truck className="w-6 h-6 text-primary" /> Suppliers
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} on record</p>
          </div>
          {isAdmin && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md">
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background" />
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="border-b bg-primary/5 p-4 md:px-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-black text-base">{editId ? "Edit Supplier" : "New Supplier"}</h2>
            <button onClick={resetForm} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              ["name", "Supplier Name *", "text", "e.g. ABC Toys Wholesale"],
              ["contact", "Contact Person", "text", "e.g. Ramesh Kumar"],
              ["phone", "Phone", "tel",  "e.g. 98765 43210"],
              ["email", "Email", "email","e.g. supplier@example.com"],
            ] as const).map(([key, label, type, ph]) => (
              <div key={key}>
                <p className="text-xs font-bold text-muted-foreground mb-1">{label}</p>
                <Input type={type} placeholder={ph} value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">Address</p>
            <Input placeholder="Full address…" value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="h-11 rounded-xl" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">Notes</p>
            <Input placeholder="Any notes…" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="h-11 rounded-xl" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 bg-primary text-primary-foreground rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> {editId ? "Save Changes" : "Add Supplier"}</>}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center px-6">
            <Truck className="w-12 h-12 opacity-30 mb-3" />
            <p className="font-bold">{search ? "No suppliers match your search" : "No suppliers yet"}</p>
            {!search && isAdmin && <p className="text-xs mt-1">Click Add to add your first supplier</p>}
          </div>
        ) : (
          <div className="divide-y divide-border md:p-4 md:space-y-3 md:divide-none">
            {filtered.map((s) => {
              const supplierProducts = productsBySupplier.get(s.id) ?? [];
              const productCount = supplierProducts.length;
              const isExpanded = expanded.has(s.id);
              const isPayOpen = payExpanded.has(s.id);
              const payList = paymentsMap[s.id] ?? [];
              const isPayLoading = payLoading.has(s.id);
              const totalPaid = Number(s.totalPaid ?? 0);
              const payCount = s.paymentCount ?? 0;
              return (
                <div key={s.id} className="md:rounded-2xl md:border bg-card hover:bg-muted/30 transition-colors overflow-hidden">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4 text-primary" />
                          </div>
                          <h3 className="font-black truncate">{s.name}</h3>
                          <button
                            onClick={() => toggleExpanded(s.id)}
                            disabled={productCount === 0}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                              productCount > 0
                                ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                                : "bg-muted text-muted-foreground cursor-default"
                            }`}
                          >
                            <Package className="w-3 h-3" />
                            {productCount} product{productCount !== 1 ? "s" : ""}
                            {productCount > 0 && (
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            )}
                          </button>
                          <button
                            onClick={() => togglePayments(s.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                              payCount > 0
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                          >
                            <Wallet className="w-3 h-3" />
                            {payCount > 0 ? <>₹{inr(totalPaid)} paid</> : <>Payments</>}
                            <ChevronDown className={`w-3 h-3 transition-transform ${isPayOpen ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        <div className="pl-10 space-y-0.5">
                          {s.contact  && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="w-3 h-3" /> {s.contact}</p>}
                          {s.phone    && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" /> {s.phone}</p>}
                          {s.email    && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> {s.email}</p>}
                          {s.address  && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {s.address}</p>}
                          {s.notes    && <p className="text-xs text-muted-foreground italic mt-1">"{s.notes}"</p>}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(s)} className="w-8 h-8 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(s.id, s.name)} className="w-8 h-8 rounded-full bg-muted hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors">
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && productCount > 0 && (
                    <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
                      {supplierProducts.map((p) => {
                        const isLow = p.stock <= p.lowStockThreshold;
                        return (
                          <Link
                            key={p.id}
                            href={`/product?sku=${encodeURIComponent(p.sku)}`}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-background active:scale-[0.99] transition-all"
                          >
                            <span className="text-base shrink-0">{getCategoryEmoji(p.category)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{p.name}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">{p.sku}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">₹{inr(p.price)}</p>
                              <p className={`text-[11px] font-bold flex items-center justify-end gap-1 ${isLow ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                {isLow && <AlertTriangle className="w-3 h-3" />}
                                {p.stock} in stock
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Payment history ── */}
                  {isPayOpen && (
                    <div className="border-t bg-emerald-500/5 px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5" /> Payment History
                        </p>
                        {isAdmin && payFormFor !== s.id && (
                          <button onClick={() => openPayForm(s.id)}
                            className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all">
                            <Plus className="w-3 h-3" /> Add Payment
                          </button>
                        )}
                      </div>

                      {/* Add payment form */}
                      {isAdmin && payFormFor === s.id && (
                        <div className="bg-card border rounded-2xl p-3 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[11px] font-bold text-muted-foreground mb-1">Amount (₹) *</p>
                              <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 5000" value={payForm.amount}
                                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                                className="h-10 rounded-xl" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-muted-foreground mb-1">Date</p>
                              <Input type="date" value={payForm.paidAt}
                                onChange={(e) => setPayForm((f) => ({ ...f, paidAt: e.target.value }))}
                                className="h-10 rounded-xl" />
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-muted-foreground mb-1">Method</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PAYMENT_METHODS.map((pm) => (
                                <button key={pm.value} type="button"
                                  onClick={() => setPayForm((f) => ({ ...f, method: pm.value }))}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    payForm.method === pm.value
                                      ? "bg-emerald-600 text-white"
                                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                                  }`}>
                                  {pm.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-muted-foreground mb-1">Note (optional)</p>
                            <Input placeholder="e.g. part payment for June stock" value={payForm.note}
                              onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                              className="h-10 rounded-xl" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setPayFormFor(null); }}
                              className="flex-1 h-10 rounded-xl bg-muted font-bold text-sm hover:bg-muted/70 transition-all">
                              Cancel
                            </button>
                            <button onClick={() => handleAddPayment(s.id)} disabled={paySaving}
                              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
                              {paySaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Payment</>}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* History list */}
                      {isPayLoading ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                      ) : payList.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No payments recorded yet.</p>
                      ) : (
                        <>
                          <div className="space-y-1">
                            {payList.map((p) => (
                              <div key={p.id} className="flex items-center gap-3 bg-card border rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black">₹{inr(p.amount)}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground uppercase">{methodLabel(p.method)}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <CalendarDays className="w-3 h-3" /> {fmtDate(p.paidAt)}
                                    {p.note && <span className="italic truncate"> · {p.note}</span>}
                                  </p>
                                </div>
                                {isAdmin && (
                                  <button onClick={() => handleDeletePayment(s.id, p.id)}
                                    className="w-7 h-7 rounded-full bg-muted hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center shrink-0 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between px-1 pt-1">
                            <span className="text-xs font-bold text-muted-foreground">{payList.length} payment{payList.length !== 1 ? "s" : ""}</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Total ₹{inr(totalPaid)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
