import { useAdminOverview } from "./api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2, CheckCircle2, IndianRupee, FileText, ArrowRight,
  Package, Clock, Users, AlertTriangle, LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewData } from "./types";

type Section = "dashboard" | "shops" | "pricing" | "backups" | "audit";
type Shop = OverviewData["shops"][number];

/* Tailwind needs whole class names, so tones are looked up, never built by
 * string surgery. */
const TONES = {
  blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Stat({
  label, value, icon: Icon, tone, subtitle,
}: {
  label: string; value: string; icon: LucideIcon;
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

/* What actually deserves a phone call, most urgent first. A suspended shop is
 * not chased — it is already switched off on purpose. */
function attentionReason(s: Shop): { label: string; urgent: boolean } | null {
  if (!s.isActive) return null;
  if (s.access === "expired")  return { label: `Expired ${Math.abs(s.daysLeft ?? 0)}d ago`, urgent: true };
  if (s.access === "expiring") return { label: `${s.daysLeft}d left`, urgent: true };
  if (s.activity === "never_sold") return { label: "Never sold", urgent: false };
  if (s.activity === "idle")       return { label: "No recent sales", urgent: false };
  return null;
}

export default function Dashboard({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { data, isLoading, error } = useAdminOverview();

  if (isLoading || (!data && !error)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="font-medium">Could not load the platform overview</p>
        <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
      </div>
    );
  }

  const { totals, shops, unassigned } = data;

  /* Counted off the shop rows, never inferred by subtracting totals — the
   * activity buckets only cover shops that can trade. */
  const idle = shops.filter((s) => s.activity === "idle").length;

  const attention = shops
    .map((s) => ({ shop: s, reason: attentionReason(s) }))
    .filter((x): x is { shop: Shop; reason: { label: string; urgent: boolean } } => x.reason !== null)
    .sort((a, b) => Number(b.reason.urgent) - Number(a.reason.urgent))
    .slice(0, 6);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-muted-foreground">
          {totals.shops} {totals.shops === 1 ? "shop" : "shops"} &middot; {rupees(totals.revenueToday)} billed today
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Shops" value={totals.shops.toLocaleString("en-IN")} icon={Building2} tone="blue"
          subtitle={`${totals.activeShops} active, ${totals.suspended} suspended`}
        />
        <Stat
          label="Revenue" value={rupees(totals.revenueAllTime)} icon={IndianRupee} tone="emerald"
          subtitle={`${rupees(totals.revenue30d)} last 30 days`}
        />
        <Stat
          label="Bills" value={totals.billsAllTime.toLocaleString("en-IN")} icon={FileText} tone="purple"
          subtitle={`${totals.bills30d.toLocaleString("en-IN")} last 30 days`}
        />
        <Stat
          label="Products" value={totals.products.toLocaleString("en-IN")} icon={Package} tone="amber"
          subtitle={`Across ${totals.shops} shops`}
        />
      </div>

      {unassigned && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {unassigned.bills} {unassigned.bills === 1 ? "bill" : "bills"} worth {rupees(unassigned.revenue)} predate
            multi-shop support and belong to no shop. They are excluded from every total above.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-amber-500" /> Needs attention
            </h2>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("shops")}>
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {attention.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500 opacity-50" />
                <p className="font-medium text-foreground">All clear</p>
                <p className="text-sm text-muted-foreground">
                  Every active shop is trading and none are close to expiring.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {attention.map(({ shop, reason }) => (
                <Card
                  key={shop.id}
                  className="cursor-pointer transition-colors hover:border-primary/50"
                  onClick={() => onNavigate("shops")}
                >
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{shop.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{shop.ownerEmail || "No email"}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                        reason.urgent ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {reason.label}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-primary" /> Shop activity
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              <div className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                <p className="text-sm font-medium">Actively trading</p>
                <p className="font-bold tabular-nums text-emerald-600">{totals.tradingShops}</p>
              </div>
              <div className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                <p className="text-sm font-medium">Idle (no recent sales)</p>
                <p className="font-bold tabular-nums text-amber-600">{idle}</p>
              </div>
              <div className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                <p className="text-sm font-medium">Never sold</p>
                <p className="font-bold tabular-nums text-muted-foreground">{totals.neverSold}</p>
              </div>
              <div className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                <p className="text-sm font-medium">Outstanding dues</p>
                <p className="font-bold tabular-nums">{rupees(totals.outstanding)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
