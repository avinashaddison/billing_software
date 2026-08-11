import { useState, useEffect } from "react";
import { useAdminPricing } from "./api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IndianRupee, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Pricing() {
  const { data, isLoading, error } = useAdminPricing();
  
  const [dealPrice, setDealPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.pricing) {
      setDealPrice(String(data.pricing.dealPrice));
      setOriginalPrice(String(data.pricing.originalPrice));
    }
  }, [data]);

  const save = async () => {
    const deal = Number(dealPrice);
    const orig = Number(originalPrice);
    
    if (isNaN(deal) || isNaN(orig) || deal < 0 || orig < 0) {
      toast.error("Prices must be valid positive numbers");
      return;
    }
    if (!Number.isInteger(deal) || !Number.isInteger(orig)) {
      toast.error("Prices must be whole rupee amounts");
      return;
    }
    
    setBusy(true);
    const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
    try {
      const r = await fetch(`${BASE}/api/platform/settings`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealPrice: deal, originalPrice: orig }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Could not save pricing"); return;
      }
      toast.success("Landing-page price updated");
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <div className="p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  /* Never show an editable price form seeded with zeroes when the real prices
   * failed to load — saving that would wipe the live landing-page pricing. */
  if (error) {
    return (
      <div className="max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="font-medium text-destructive">Could not load your current pricing</p>
        <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
        <p className="mt-1 text-sm text-muted-foreground">The form stays hidden so a blank value can't overwrite your live prices.</p>
      </div>
    );
  }

  const deal = Number(dealPrice) || 0;
  const perMonth = Math.round(deal / 12);

  return (
    <div className="space-y-6 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription Pricing</h1>
        <p className="text-muted-foreground mt-1">Drives the public landing page</p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <IndianRupee className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Lifetime License</h2>
            <p className="text-sm text-muted-foreground">Adjust the prices shown to new signups.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Deal Price (₹)</label>
              <Input type="number" min={0} value={dealPrice} onChange={e => setDealPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground line-through decoration-muted-foreground/50">Original Price (₹)</label>
              <Input type="number" min={0} value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} />
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground">The landing page will display:</p>
              <p className="font-medium mt-1">
                <span className="text-xl font-bold tracking-tight">₹{deal.toLocaleString('en-IN')}</span>
                <span className="text-sm line-through text-muted-foreground ml-2 mr-2">₹{(Number(originalPrice) || 0).toLocaleString('en-IN')}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Lifetime</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Equivalent to</p>
              <p className="font-semibold text-primary">~ ₹{perMonth}/month</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={busy || !dealPrice || !originalPrice}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
