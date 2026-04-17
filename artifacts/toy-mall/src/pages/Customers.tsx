import { useState, useEffect } from "react";
import { Users, Phone, ChevronRight, ArrowLeft, IndianRupee, ShoppingBag, Clock, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface CustomerSummary {
  phone: string; totalSpent: number; visitCount: number; lastVisit: string;
}
interface BillItem { productName: string; productSku: string; quantity: number; price: number; subtotal: number; }
interface Bill { id: string; totalAmount: number; itemsCount: number; paymentMode: string; createdAt: string; items: BillItem[]; }
interface CustomerDetail { phone: string; totalSpent: number; visitCount: number; bills: Bill[]; }

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/customers`)
      .then((r) => r.json())
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  const openCustomer = async (phone: string) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/customers/${phone}`);
      setSelected(await r.json());
    } finally { setDetailLoading(false); }
  };

  const filtered = customers.filter(
    (c) => !search || c.phone.includes(search) || c.phone.includes(search.replace(/\s/g, ""))
  );

  if (selected) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-black text-lg">+91 {selected.phone}</h1>
            <p className="text-xs text-muted-foreground">{selected.visitCount} visit{selected.visitCount !== 1 ? "s" : ""} · ₹{selected.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })} total spent</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 p-4 md:px-6">
            {[
              { label: "Total Spent", value: `₹${selected.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: IndianRupee, color: "text-green-600 dark:text-green-400" },
              { label: "Visits",      value: String(selected.visitCount), icon: ShoppingBag, color: "text-blue-600 dark:text-blue-400" },
              { label: "Avg/Visit",   value: `₹${(selected.totalSpent / Math.max(1, selected.visitCount)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: IndianRupee, color: "text-purple-600 dark:text-purple-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="p-3 bg-card border rounded-2xl text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className={`text-lg font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          {/* Bill history */}
          <div className="px-4 md:px-6">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Purchase History</h2>
            <div className="space-y-3">
              {selected.bills.map((bill) => {
                const dt = new Date(bill.createdAt);
                return (
                  <div key={bill.id} className="p-4 bg-card border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-base">₹{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground">
                          {dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                          {dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bill.paymentMode === "upi" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                          {bill.paymentMode?.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">#{bill.id.slice(0, 6).toUpperCase()}</span>
                      </div>
                    </div>
                    {bill.items.length > 0 && (
                      <div className="border-t pt-2 space-y-1">
                        {bill.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex-1 truncate">{item.productName}</span>
                            <span className="font-mono text-xs text-muted-foreground mx-2">×{item.quantity}</span>
                            <span className="font-bold">₹{item.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Customers
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{customers.length} customer{customers.length !== 1 ? "s" : ""} on record</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by phone…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-muted/50 border-transparent" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center px-6">
            <Users className="w-12 h-12 opacity-30 mb-3" />
            <p className="font-bold">{search ? "No customers match" : "No customers yet"}</p>
            <p className="text-xs mt-1">Customers with phone numbers at checkout appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => {
              const dt = new Date(c.lastVisit);
              return (
                <button key={c.phone} onClick={() => openCustomer(c.phone)} disabled={detailLoading}
                  className="w-full flex items-center gap-4 p-4 md:px-6 hover:bg-muted/50 active:bg-muted transition-colors text-left">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black">+91 {c.phone}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Last visit: {dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-green-600 dark:text-green-400 text-sm">₹{c.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground">{c.visitCount} visit{c.visitCount !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
