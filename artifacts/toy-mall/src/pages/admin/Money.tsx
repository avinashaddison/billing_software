import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminMoney,
  useAdminOverview,
  adminMutate,
  adminQueryKeys
} from "./api";
import {
  Wallet, CreditCard, Banknote, Building2, Calendar, CheckCircle2,
  History, TrendingUp, Search, Plus, Trash2, AlertTriangle, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MoneyData, OverviewData } from "./types";

const TONES = {
  blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const;

function Stat({
  label, value, icon: Icon, tone, subtitle,
}: {
  label: string; value: string; icon: React.ElementType;
  tone: keyof typeof TONES; subtitle?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        </div>
        <p className="mt-3 break-words text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        {subtitle && <p className="mt-1.5 text-xs font-medium text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

const rupees = (amount: string | number) => `₹${Math.round(Number(amount)).toLocaleString("en-IN")}`;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", {
  day: "numeric", month: "short", year: "numeric"
});

const formatMonth = (yyyy_mm: string) => {
  const [y, m] = yyyy_mm.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const daysFromNow = (iso: string | null) => {
  if (!iso) return Infinity;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
};

function RenewalBadge({ days, isActive, paid }: { days: number, isActive: boolean, paid: boolean }) {
  if (!isActive) return <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Suspended</span>;
  if (days === Infinity) return <span className="bg-blue-500/10 text-blue-600 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Lifetime</span>;
  if (days < 0) {
    return <span className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Expired {Math.abs(days)}d ago</span>;
  }
  return <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Expiring in {days}d</span>;
}

function RenewalRow({ r, onPay }: { r: any, onPay: (id: string) => void }) {
  return (
    <div className="p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{r.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {r.lastPaidAt ? `Last paid ${formatDate(r.lastPaidAt)}` : "Never paid"}
            <span className="mx-1.5">&middot;</span>
            {rupees(r.paidTotal)} LTV
          </div>
        </div>
        <div className="shrink-0 pt-0.5">
          <RenewalBadge days={daysFromNow(r.expiresAt)} isActive={r.isActive} paid={Number(r.paidTotal) > 0} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
         <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
           ID: {r.id.split("-")[0]}
         </div>
         <Button size="sm" variant="secondary" className="h-7 text-xs px-2 shadow-sm" onClick={() => onPay(r.id)}>
           <Plus className="w-3 h-3 mr-1" /> Log Payment
         </Button>
      </div>
    </div>
  );
}

export default function Money() {
  const { data, isLoading, error } = useAdminMoney();
  const { data: overview, isLoading: overviewLoading } = useAdminOverview();
  const queryClient = useQueryClient();

  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash"|"upi"|"bank"|"card"|"other">("upi");
  const [note, setNote] = useState("");
  const [coversDays, setCoversDays] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [shopSearch, setShopSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const maxMonthVal = useMemo(() => {
    if (!data?.byMonth.length) return 1;
    return Math.max(...data.byMonth.map(m => Number(m.total)));
  }, [data?.byMonth]);

  const sortedRenewals = useMemo(() => {
    if (!data?.renewals) return [];
    return [...data.renewals].sort((a, b) => {
      const dA = daysFromNow(a.expiresAt);
      const dB = daysFromNow(b.expiresAt);
      if (dA !== dB) return dA - dB;
      return Number(b.paidTotal) - Number(a.paidTotal);
    });
  }, [data?.renewals]);

  const loyal = sortedRenewals.filter(r => Number(r.paidTotal) > 0);
  const trials = sortedRenewals.filter(r => Number(r.paidTotal) === 0);

  const filteredShops = useMemo(() => {
    if (!overview?.shops) return [];
    const q = shopSearch.toLowerCase().trim();
    if (!q) return overview.shops.slice(0, 50);
    return overview.shops
      .filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.ownerEmail || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [overview, shopSearch]);

  const openRecord = (shopId?: string) => {
    setSelectedShopId(shopId || null);
    setAmount("");
    setMethod("upi");
    setNote("");
    setCoversDays("");
    setPaidAt(new Date().toISOString().split("T")[0]);
    setShopSearch("");
    setRecordOpen(true);
  };

  const submitPayment = async () => {
    const amt = Number(amount);
    if (!selectedShopId || !amount || !isFinite(amt) || amt <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    setBusy(true);
    try {
      await adminMutate("POST", "/platform/payments", {
        tenantId: selectedShopId,
        amount: amt,
        method,
        note: note || undefined,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        coversDays: coversDays ? Number(coversDays) : undefined
      });
      toast.success("Payment recorded");
      setRecordOpen(false);
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.money });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: string) => {
    setBusyDelete(true);
    try {
      await adminMutate("DELETE", `/platform/payments/${id}`);
      toast.success("Payment deleted");
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.money });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
      setDeleteConfirm(null);
    } catch(err: any) {
      toast.error(err.message || "Failed to delete payment");
    } finally {
      setBusyDelete(false);
    }
  };

  if (isLoading || (!data && !error)) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income Book</h1>
          <p className="mt-1 text-muted-foreground">Track vendor revenue and manage renewals</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="font-medium">Could not load the income book</p>
        <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
      </div>
    );
  }

  const { summary, payments, byMonth } = data;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Income Book</h1>
        <p className="mt-1 text-muted-foreground">Track vendor revenue and manage renewals</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="This Month" value={rupees(summary.thisMonth)} icon={TrendingUp} tone="emerald" subtitle={`${rupees(summary.lastMonth)} last month`} />
        <Stat label="All Time" value={rupees(summary.allTime)} icon={Banknote} tone="blue" subtitle="Lifetime platform revenue" />
        <Stat label="Paying Shops" value={summary.payingShops.toString()} icon={Building2} tone="purple" subtitle="Have made at least one payment" />
        <Stat label="Total Volume" value={summary.count.toString()} icon={History} tone="amber" subtitle="Recorded transactions" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Recent Payments</CardTitle>
                <CardDescription>Latest vendor income</CardDescription>
              </div>
              <Button onClick={() => openRecord()}>
                <Plus className="w-4 h-4 mr-2" /> Record Payment
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-3 opacity-20" />
                  <p>No payments recorded yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {payments.map(p => (
                    <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                          {p.method === "cash" ? <Banknote className="w-5 h-5"/> : 
                           p.method === "card" ? <CreditCard className="w-5 h-5"/> :
                           <Wallet className="w-5 h-5"/>}
                        </div>
                        <div>
                          <div className="font-semibold">{p.shopName || "Unknown Shop"}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{formatDate(p.paidAt)}</span>
                            <span>&middot;</span>
                            <span className="uppercase text-[10px] tracking-wider font-bold bg-muted px-1.5 py-0.5 rounded">{p.method}</span>
                            {p.note && (
                              <>
                                <span>&middot;</span>
                                <span className="italic">"{p.note}"</span>
                              </>
                            )}
                          </div>
                          {p.coversUntil && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Extended to {formatDate(p.coversUntil)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-lg tabular-nums">{rupees(p.amount)}</div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500"/> Revenue by Month</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {byMonth.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No revenue data available.</div>
              ) : (
                <div className="space-y-3">
                  {byMonth.map(m => (
                    <div key={m.month} className="flex items-center gap-4">
                      <div className="w-20 text-sm font-medium">{formatMonth(m.month)}</div>
                      <div className="flex-1 flex items-center h-6 relative group">
                        <div className="h-full bg-emerald-500/20 border border-emerald-500/30 rounded-sm transition-all group-hover:bg-emerald-500/30" style={{ width: `${Math.max((Number(m.total)/maxMonthVal)*100, 1)}%` }} />
                      </div>
                      <div className="w-28 text-right tabular-nums">
                        <div className="text-sm font-bold">{rupees(m.total)}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.count} payments</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Needs Attention</CardTitle>
              <CardDescription>Renewals and chase list</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loyal.length === 0 && trials.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-3 opacity-20 mx-auto" />
                  <p className="font-medium">All Clear</p>
                  <p className="text-sm mt-1">No shops are expiring soon.</p>
                </div>
              )}
              
              {loyal.length > 0 && (
                <>
                  <div className="bg-muted/50 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b">
                    Loyal Customers Lapsing
                  </div>
                  <div className="divide-y border-b last:border-b-0">
                    {loyal.map(r => <RenewalRow key={r.id} r={r} onPay={openRecord} />)}
                  </div>
                </>
              )}
              
              {trials.length > 0 && (
                <>
                  <div className="bg-muted/50 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-t-0">
                    Trial Churn (Never Paid)
                  </div>
                  <div className="divide-y last:border-b-0">
                    {trials.map(r => <RenewalRow key={r.id} r={r} onPay={openRecord} />)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Log an offline or direct payment from a shop.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-4 pr-1">
            {!selectedShopId ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 flex h-full items-center text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Search shops..." 
                    value={shopSearch} 
                    onChange={e => setShopSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                
                {overviewLoading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {filteredShops.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No shops found</div>
                    ) : (
                      filteredShops.map(s => (
                        <button 
                          key={s.id} 
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex justify-between items-center transition-colors"
                          onClick={() => setSelectedShopId(s.id)}
                        >
                          <span className="font-medium truncate mr-2">{s.name}</span>
                          {s.expiresAt && <span className="text-xs text-muted-foreground shrink-0 tabular-nums">Expires {formatDate(s.expiresAt)}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                  <div className="min-w-0 pr-4">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Selected Shop</div>
                    <div className="font-semibold text-sm truncate">{overview?.shops.find(s => s.id === selectedShopId)?.name || selectedShopId}</div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSelectedShopId(null)}>Change</Button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (₹)</label>
                  <Input type="number" min={1} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(["cash", "upi", "bank", "card", "other"] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`h-9 rounded-md text-xs font-bold uppercase tracking-wider border transition-colors ${
                          method === m 
                            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Paid Date</label>
                    <Input type="date" max={new Date().toISOString().split("T")[0]} value={paidAt} onChange={e => setPaidAt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>Add Time</span>
                      <span className="text-[10px] text-muted-foreground uppercase">Days</span>
                    </label>
                    <Input type="number" min={0} value={coversDays} onChange={e => setCoversDays(e.target.value)} placeholder="e.g. 365" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setCoversDays("30")}>+30d</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setCoversDays("90")}>+90d</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setCoversDays("365")}>+1y</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setCoversDays("36500")}>Lifetime</Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center justify-between">
                    <span>Note</span>
                    <span className="text-xs text-muted-foreground font-normal">Optional</span>
                  </label>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Reference number or comment..." />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button disabled={!selectedShopId || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || busy} onClick={submitPayment}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Payment
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete this payment? This will remove the revenue from your records. If this payment granted license time, deleting it will <strong>not</strong> revoke that time.
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => doDelete(deleteConfirm!)} disabled={busyDelete}>
              {busyDelete && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
