import { useState, useEffect } from "react";
import { Truck, Plus, X, Edit3, Check, Phone, Mail, MapPin, FileText, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Supplier {
  id: string; name: string; contact?: string;
  email?: string; phone?: string; address?: string; notes?: string;
  createdAt: string;
}

async function fetchSuppliers(): Promise<Supplier[]> {
  const r = await fetch(`${BASE_URL}/api/suppliers`);
  return r.json();
}

export default function Suppliers() {
  const { role } = useAuth();
  const isAdmin = role === "owner";
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", email: "", phone: "", address: "", notes: "" });

  const load = () => fetchSuppliers().then(setSuppliers).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

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
    if (!confirm(`Delete supplier "${name}"?`)) return;
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
            {filtered.map((s) => (
              <div key={s.id} className="p-4 md:p-5 md:rounded-2xl md:border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-black truncate">{s.name}</h3>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
