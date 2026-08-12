import { useAdminOverview } from "./api";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewData } from "./types";
import {
  PageHeader, SectionLabel, MetricRow, Metric, Panel, Rows, Row,
  Tag, Notice, EmptyState, LoadError, rupees, count,
} from "./ui";

type Section = "dashboard" | "shops" | "pricing" | "backups" | "audit";
type Shop = OverviewData["shops"][number];

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
      <div>
        <PageHeader title="Platform overview" />
        <Skeleton className="h-[122px] rounded-lg" />
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-lg lg:col-span-3" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Platform overview" />
        <LoadError message={(error as Error)?.message} />
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
    <div className="animate-in fade-in duration-300">
      <PageHeader
        title="Platform overview"
        meta={`${count(totals.shops)} ${totals.shops === 1 ? "shop" : "shops"} · ${rupees(totals.revenueToday)} billed today`}
      />

      <MetricRow>
        <Metric
          label="Shops" value={count(totals.shops)}
          hint={`${totals.activeShops} active · ${totals.suspended} suspended`}
        />
        <Metric
          label="Revenue" value={rupees(totals.revenueAllTime)}
          hint={`${rupees(totals.revenue30d)} last 30 days`}
        />
        <Metric
          label="Bills" value={count(totals.billsAllTime)}
          hint={`${count(totals.bills30d)} last 30 days`}
        />
        <Metric
          label="Products" value={count(totals.products)}
          hint={`Across ${count(totals.shops)} shops`}
        />
      </MetricRow>

      {unassigned && (
        <div className="mt-5">
          <Notice tone="warn">
            {count(unassigned.bills)} {unassigned.bills === 1 ? "bill" : "bills"} worth{" "}
            {rupees(unassigned.revenue)} predate multi-shop support and belong to no shop.
            They are excluded from every total above.
          </Notice>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionLabel
            action={
              <Button
                variant="ghost" size="sm"
                className="-mr-2 h-7 gap-1 text-[13px] font-normal text-muted-foreground"
                onClick={() => onNavigate("shops")}
              >
                All shops <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            }
          >
            Needs attention
          </SectionLabel>

          <Panel>
            {attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All clear"
                hint="Every active shop is trading and none are close to expiring."
              />
            ) : (
              <Rows>
                {attention.map(({ shop, reason }) => (
                  <Row
                    key={shop.id}
                    label={shop.name}
                    sub={shop.ownerEmail || "No email"}
                    value={<Tag tone={reason.urgent ? "danger" : "warn"}>{reason.label}</Tag>}
                    onClick={() => onNavigate("shops")}
                  />
                ))}
              </Rows>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <SectionLabel>Shop activity</SectionLabel>
          <Panel>
            <Rows>
              <Row label="Actively trading"       value={count(totals.tradingShops)} tone="positive" />
              <Row label="Idle (no recent sales)" value={count(idle)}                tone="warn" />
              <Row label="Never sold"             value={count(totals.neverSold)} />
              <Row label="Outstanding dues"       value={rupees(totals.outstanding)} />
            </Rows>
          </Panel>
        </div>
      </div>
    </div>
  );
}
