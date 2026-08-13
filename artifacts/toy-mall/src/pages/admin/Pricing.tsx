import { useState, useEffect } from "react";
import { useAdminPricing, adminQueryKeys } from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader, MetricRow, Metric, Panel, LoadError, amountExact, PanelSkeleton
} from "./ui";

export default function Pricing() {
  const { data, isLoading, error } = useAdminPricing();
  const queryClient = useQueryClient();
  
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
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.pricing });
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
        <MetricRow cols={2}>
           <Skeleton className="h-[122px] rounded-2xl" />
           <Skeleton className="h-[122px] rounded-2xl" />
        </MetricRow>
        <div className="mt-10 max-w-lg">
           <PanelSkeleton rows={2} header={true} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Subscription pricing" meta="Drives the public landing page" />
        <LoadError 
          message={(error as Error).message} 
          onRetry={() => queryClient.invalidateQueries({ queryKey: adminQueryKeys.pricing })}
        />
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
          <div className="p-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Deal price (₹)</label>
                <Input type="number" min={0} value={dealPrice} onChange={e => setDealPrice(e.target.value)} className="rounded-lg tabular-nums border-gray-200 focus-visible:ring-violet-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Original price (₹)</label>
                <Input type="number" min={0} value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} className="rounded-lg tabular-nums border-gray-200 focus-visible:ring-violet-500" />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-gray-100 p-5 bg-gray-50/50">
               <div>
                 <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Landing page will display</p>
                 <p className="font-bold mt-1.5 tabular-nums flex items-baseline gap-2">
                   <span className="text-[22px] tracking-tight text-gray-900">{amountExact(deal)}</span>
                   <span className="text-[14px] line-through text-gray-400">{amountExact(orig)}</span>
                 </p>
               </div>
               <div className="text-right shrink-0">
                 <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Equivalent to</p>
                 <p className="font-bold tabular-nums mt-1.5 text-[15px] text-gray-900">~ ₹{perMonth}<span className="text-[12px] text-gray-500 font-medium">/mo</span></p>
               </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={busy || !dealPrice || !originalPrice} className="bg-violet-600 hover:bg-violet-700 text-white focus-visible:ring-violet-500">
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
