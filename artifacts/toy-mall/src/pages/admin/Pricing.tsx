import { useState, useEffect } from "react";
import { useAdminPricing } from "./api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, MetricRow, Metric, Panel, LoadError, amountExact
} from "./ui";

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
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Subscription pricing" meta="Drives the public landing page" />
        <div className="mt-8 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4 border bg-border rounded-lg h-[114px]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Subscription pricing" meta="Drives the public landing page" />
        <LoadError message={(error as Error).message} />
      </div>
    );
  }

  const deal = Number(dealPrice) || 0;
  const orig = Number(originalPrice) || 0;
  const perMonth = Math.round(deal / 12);

  return (
    <div className="animate-in fade-in duration-300 pb-12">
      <PageHeader title="Subscription pricing" meta="Drives the public landing page" />
      
      <MetricRow cols={2}>
        <Metric label="Deal price" value={amountExact(deal)} hint="Current public price" tone="positive" />
        <Metric label="Original price" value={amountExact(orig)} hint="Shown crossed out" />
      </MetricRow>

      <div className="mt-10 max-w-lg">
        <Panel title="Update pricing">
          <div className="p-5 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Deal price (₹)</label>
                <Input type="number" min={0} value={dealPrice} onChange={e => setDealPrice(e.target.value)} className="rounded-md tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Original price (₹)</label>
                <Input type="number" min={0} value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} className="rounded-md tabular-nums" />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-md border p-4 bg-muted/20">
               <div>
                 <p className="text-[13px] text-muted-foreground">Landing page will display:</p>
                 <p className="font-medium mt-1 tabular-nums">
                   <span className="text-xl font-bold tracking-tight">{amountExact(deal)}</span>
                   <span className="text-[13px] line-through text-muted-foreground ml-2 mr-2">{amountExact(orig)}</span>
                 </p>
               </div>
               <div className="text-right shrink-0">
                 <p className="text-[13px] text-muted-foreground">Equivalent to</p>
                 <p className="font-medium tabular-nums mt-1">~ ₹{perMonth}/mo</p>
               </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={busy || !dealPrice || !originalPrice}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save pricing
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
