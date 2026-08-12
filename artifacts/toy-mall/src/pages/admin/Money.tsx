import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminMoney,
  useAdminOverview,
  adminMutate,
  adminQueryKeys
} from "./api";
import { Plus, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  PageHeader, SectionLabel, MetricRow, Metric, Panel, Rows, Row,
  Tag, EmptyState, LoadError, rupees, count, type Tone
} from "./ui";

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
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Income book" meta="Track vendor revenue and manage renewals" />
        <Skeleton className="h-[122px] rounded-lg mt-8" />
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-lg lg:col-span-3" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Income book" meta="Track vendor revenue and manage renewals" />
        <LoadError message={(error as Error)?.message} />
      </div>
    );
  }

  const { summary, payments, byMonth } = data;

  return (
    <div className="animate-in fade-in duration-300 pb-12">
      <PageHeader title="Income book" meta="Track vendor revenue and manage renewals" />

      <MetricRow>
        <Metric label="This month" value={rupees(Number(summary.thisMonth))} hint={`${rupees(Number(summary.lastMonth))} last month`} tone="positive" />
        <Metric label="All time" value={rupees(Number(summary.allTime))} hint="Lifetime platform revenue" />
        <Metric label="Paying shops" value={count(summary.payingShops)} hint="Have made at least one payment" />
        <Metric label="Total volume" value={count(summary.count)} hint="Recorded transactions" />
      </MetricRow>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-8">
          <div>
            <SectionLabel action={
              <Button variant="ghost" size="sm" className="-mr-2 h-7 gap-1 text-[13px] font-normal text-muted-foreground" onClick={() => openRecord()}>
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Record payment
              </Button>
            }>
              Recent payments
            </SectionLabel>
            <Panel>
              {payments.length === 0 ? (
                <EmptyState title="No payments" hint="No payments recorded yet" />
              ) : (
                <Rows>
                  {payments.map(p => (
                    <Row
                      key={p.id}
                      label={p.shopName || "Unknown shop"}
                      sub={
                        <>
                          {formatDate(p.paidAt)} · {p.method.toUpperCase()}
                          {p.coversUntil && ` · Extended to ${formatDate(p.coversUntil)}`}
                          {p.note && ` · "${p.note}"`}
                        </>
                      }
                      value={
                        <div className="flex items-center gap-4">
                          <span>{rupees(Number(p.amount))}</span>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p.id); }} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      }
                    />
                  ))}
                </Rows>
              )}
            </Panel>
          </div>

          <div>
            <SectionLabel>Revenue by month</SectionLabel>
            <Panel>
              {byMonth.length === 0 ? (
                <EmptyState title="No revenue data" hint="No revenue data available" />
              ) : (
                <Rows>
                  {byMonth.map(m => (
                    <Row
                      key={m.month}
                      label={formatMonth(m.month)}
                      sub={`${count(m.count)} payments`}
                      value={rupees(Number(m.total))}
                    />
                  ))}
                </Rows>
              )}
            </Panel>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div>
            <SectionLabel>Needs attention</SectionLabel>
            <Panel>
              {loyal.length === 0 && trials.length === 0 ? (
                <EmptyState title="All clear" hint="No shops are expiring soon." />
              ) : (
                <div className="flex flex-col">
                  {loyal.length > 0 && (
                    <div>
                      <div className="bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground border-b">
                        Loyal customers lapsing
                      </div>
                      <Rows>
                        {loyal.map(r => {
                          const days = daysFromNow(r.expiresAt);
                          let tone: Tone = "neutral";
                          let label = "";
                          if (!r.isActive) { tone = "neutral"; label = "Suspended"; }
                          else if (days === Infinity) { tone = "neutral"; label = "Lifetime"; }
                          else if (days < 0) { tone = "danger"; label = `Expired ${Math.abs(days)}d ago`; }
                          else { tone = "warn"; label = `Expiring in ${days}d`; }

                          return (
                            <Row
                              key={r.id}
                              label={r.name}
                              sub={`${r.lastPaidAt ? `Last paid ${formatDate(r.lastPaidAt)}` : "Never paid"} · ${rupees(Number(r.paidTotal))} LTV`}
                              value={<Tag tone={tone}>{label}</Tag>}
                              onClick={() => openRecord(r.id)}
                            />
                          );
                        })}
                      </Rows>
                    </div>
                  )}
                  
                  {trials.length > 0 && (
                    <div className={loyal.length > 0 ? "border-t" : ""}>
                      <div className="bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground border-b">
                        Trial churn
                      </div>
                      <Rows>
                        {trials.map(r => {
                          const days = daysFromNow(r.expiresAt);
                          let tone: Tone = "neutral";
                          let label = "";
                          if (!r.isActive) { tone = "neutral"; label = "Suspended"; }
                          else if (days === Infinity) { tone = "neutral"; label = "Lifetime"; }
                          else if (days < 0) { tone = "danger"; label = `Expired ${Math.abs(days)}d ago`; }
                          else { tone = "warn"; label = `Expiring in ${days}d`; }

                          return (
                            <Row
                              key={r.id}
                              label={r.name}
                              sub={`${r.lastPaidAt ? `Last paid ${formatDate(r.lastPaidAt)}` : "Never paid"} · ${rupees(Number(r.paidTotal))} LTV`}
                              value={<Tag tone={tone}>{label}</Tag>}
                              onClick={() => openRecord(r.id)}
                            />
                          );
                        })}
                      </Rows>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">Record payment</DialogTitle>
            <DialogDescription className="text-sm">
              Log an offline or direct payment from a shop.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!selectedShopId ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  <Input 
                    placeholder="Search shops..." 
                    value={shopSearch} 
                    onChange={e => setShopSearch(e.target.value)}
                    className="pl-9 rounded-md"
                    autoFocus
                  />
                </div>
                
                {overviewLoading ? (
                  <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="border rounded-md divide-y max-h-[40vh] overflow-y-auto">
                    {filteredShops.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No shops found</div>
                    ) : (
                      filteredShops.map(s => (
                        <button 
                          key={s.id} 
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-[13px] flex justify-between items-center transition-colors"
                          onClick={() => setSelectedShopId(s.id)}
                        >
                          <span className="font-medium truncate mr-2">{s.name}</span>
                          {s.expiresAt && <span className="text-muted-foreground shrink-0 tabular-nums">Expires {formatDate(s.expiresAt)}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                  <div className="min-w-0 pr-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-0.5">Selected shop</div>
                    <div className="font-medium text-[13px] truncate">{overview?.shops.find(s => s.id === selectedShopId)?.name || selectedShopId}</div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs" onClick={() => setSelectedShopId(null)}>Change</Button>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Amount (₹)</label>
                  <Input type="number" min={1} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus className="rounded-md tabular-nums" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Payment method</label>
                  <div className="flex flex-wrap gap-2">
                    {(["cash", "upi", "bank", "card", "other"] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`h-8 rounded-md px-3 text-[11px] font-medium uppercase tracking-[0.14em] border transition-colors ${
                          method === m 
                            ? "bg-foreground text-background border-foreground" 
                            : "bg-transparent text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Paid date</label>
                    <Input type="date" max={new Date().toISOString().split("T")[0]} value={paidAt} onChange={e => setPaidAt(e.target.value)} className="rounded-md" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Add time (days)</label>
                    <Input type="number" min={0} value={coversDays} onChange={e => setCoversDays(e.target.value)} placeholder="e.g. 365" className="rounded-md tabular-nums" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="h-7 text-[11px] flex-1 rounded-md" onClick={() => setCoversDays("30")}>+30d</Button>
                  <Button type="button" variant="outline" className="h-7 text-[11px] flex-1 rounded-md" onClick={() => setCoversDays("90")}>+90d</Button>
                  <Button type="button" variant="outline" className="h-7 text-[11px] flex-1 rounded-md" onClick={() => setCoversDays("365")}>+1y</Button>
                  <Button type="button" variant="outline" className="h-7 text-[11px] flex-1 rounded-md" onClick={() => setCoversDays("36500")}>Lifetime</Button>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Note</span>
                    <span className="font-normal opacity-70 tracking-normal capitalize">Optional</span>
                  </label>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Reference number or comment..." className="rounded-md" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button disabled={!selectedShopId || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || busy} onClick={submitPayment}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-destructive">Delete payment</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete this payment? This will remove the revenue from your records. If this payment granted license time, deleting it will not revoke that time.
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
