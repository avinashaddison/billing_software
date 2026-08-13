import { useAdminOverview } from "./api";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, Building2, IndianRupee, Receipt, Package, ChevronRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewData } from "./types";
import {
  PageHeader, SectionLabel, MetricRow, Metric, Panel, Rows, Row,
  Tag, Notice, EmptyState, LoadError, rupees, count,
} from "./ui";

type Section = "dashboard" | "shops" | "pricing" | "backups" | "audit" | "notices";
type Shop = OverviewData["shops"][number];

function attentionReason(s: Shop): { label: string; urgent: boolean } | null {
  if (!s.isActive) return null;
  if (s.access === "expired")  return { label: `Expired ${Math.abs(s.daysLeft ?? 0)}d ago`, urgent: true };
  if (s.access === "expiring") return { label: `${s.daysLeft}d left`, urgent: true };
  if (s.activity === "never_sold") return { label: "Never sold", urgent: false };
  if (s.activity === "idle")       return { label: "No recent sales", urgent: false };
  return null;
}

/** Avatar circle using the shop name's first two letters. */
function ShopAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  // Deterministic colour from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bgColors = [
    "bg-violet-100 text-violet-700",
    "bg-teal-100 text-teal-700",
    "bg-green-100 text-green-700",
    "bg-amber-100 text-amber-700",
    "bg-pink-100 text-pink-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700",
  ];
  const cls = bgColors[Math.abs(hash) % bgColors.length]!;
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold ${cls}`}>
      {initials || "?"}
    </div>
  );
}

/** Mini SVG donut for top-shops panel. The centre shows the REAL total —
 *  the nonzero denominator exists only to keep the geometry finite. */
function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const denom = total || 1;
  const r = 52, cx = 60, cy = 60, stroke = 20;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = slices.map((s) => {
    const pct = s.value / denom;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const seg = { ...s, dash, gap, offset };
    offset += dash;
    return seg;
  });
  return (
    <div className="flex items-center gap-5">
      <svg width={120} height={120} viewBox="0 0 120 120">
        {/* background track keeps the ring visible even with tiny slices */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-seg.offset + circumference / 4}
            strokeLinecap="butt"
          />
        ))}
        {/* centre text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-900" style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 700 }}>
          {rupees(total)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="fill-gray-400" style={{ fontFamily: "Inter", fontSize: 9 }}>
          Total Revenue
        </text>
      </svg>
      <div className="min-w-0 space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate text-[12px] text-gray-600">{s.label}</span>
            </div>
            <span className="shrink-0 text-[12px] font-semibold text-gray-700">
              {Math.round((s.value / denom) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6"];

export default function Dashboard({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { data, isLoading, error } = useAdminOverview();

  if (isLoading || (!data && !error)) {
    return (
      <div>
        <PageHeader title="Platform overview" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
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
  const series = data.series ?? [];
  const idle = shops.filter((s) => s.activity === "idle").length;

  const attention = shops
    .map((s) => ({ shop: s, reason: attentionReason(s) }))
    .filter((x): x is { shop: Shop; reason: { label: string; urgent: boolean } } => x.reason !== null)
    .sort((a, b) => Number(b.reason.urgent) - Number(a.reason.urgent))
    .slice(0, 6);

  // Top shops by all-time revenue for donut — zero-revenue shops carry no share
  const topShops = shops
    .filter((s) => s.revenueAllTime > 0)
    .sort((a, b) => b.revenueAllTime - a.revenueAllTime)
    .slice(0, 4);
  const topShopsRevenue = topShops.reduce((s, x) => s + x.revenueAllTime, 0);
  const othersRevenue = Math.max(0, totals.revenueAllTime - topShopsRevenue);
  const donutSlices = [
    ...topShops.map((s, i) => ({ label: s.name, value: s.revenueAllTime, color: DONUT_COLORS[i]! })),
    ...(othersRevenue > 0 ? [{ label: "Others", value: othersRevenue, color: "#E5E7EB" }] : []),
  ];

  const metaText = `${count(totals.shops)} ${totals.shops === 1 ? "shop" : "shops"} • ${rupees(totals.revenueToday)} billed today`;

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader
        title="Platform overview"
        meta={metaText}
      />

      {/* Metric cards */}
      <MetricRow>
        <Metric
          label="Shops"
          value={count(totals.shops)}
          hint={`${totals.activeShops} active · ${totals.suspended} suspended`}
          icon={Building2}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
        />
        <Metric
          label="Revenue"
          value={rupees(totals.revenueAllTime)}
          hint={
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <TrendingUp className="h-3 w-3" strokeWidth={2} />
              {rupees(totals.revenue30d)} last 30 days
            </span>
          }
          icon={IndianRupee}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          spark={series.map((d) => d.revenue)}
          sparkColor="#10B981"
          sparkLabel="Daily billed revenue, last 14 days"
        />
        <Metric
          label="Bills"
          value={count(totals.billsAllTime)}
          hint={`${count(totals.bills30d)} last 30 days`}
          icon={Receipt}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          spark={series.map((d) => d.bills)}
          sparkColor="#3B82F6"
          sparkLabel="Bills per day, last 14 days"
        />
        <Metric
          label="Products"
          value={count(totals.products)}
          hint={`Across ${count(totals.shops)} shops`}
          icon={Package}
          iconBg="bg-orange-100"
          iconColor="text-orange-500"
        />
      </MetricRow>

      {/* Unassigned bills notice */}
      {unassigned && (
        <div className="mt-5">
          <Notice tone="warn">
            {count(unassigned.bills)} {unassigned.bills === 1 ? "bill" : "bills"} worth{" "}
            {rupees(unassigned.revenue)} predate multi-shop support and belong to no shop.
            They are excluded from every total above.{" "}
            <button className="ml-1 font-semibold underline underline-offset-2 hover:no-underline">
              View details
            </button>
          </Notice>
        </div>
      )}

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Needs attention */}
        <div className="lg:col-span-3">
          <SectionLabel
            action={
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 h-7 gap-1 text-[12px] font-medium text-violet-600 hover:text-violet-700"
                onClick={() => onNavigate("shops")}
              >
                View all <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
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
                  <button
                    key={shop.id}
                    onClick={() => onNavigate("shops")}
                    className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-violet-50/50"
                  >
                    <ShopAvatar name={shop.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-gray-900">{shop.name}</p>
                      <p className="truncate text-[12px] text-gray-400">{shop.ownerEmail || "No email"}</p>
                    </div>
                    <Tag tone={reason.urgent ? "danger" : "warn"}>{reason.label}</Tag>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" strokeWidth={1.75} />
                  </button>
                ))}
              </Rows>
            )}

            {/* Promo footer */}
            {attention.length > 0 && (
              <div className="flex items-center gap-4 border-t border-gray-50 bg-gray-50/50 px-5 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                  <Building2 className="h-5 w-5 text-violet-500" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-gray-700">Help your shops grow</p>
                  <p className="text-[11px] text-gray-400">Reach out to inactive shops and help them start billing again.</p>
                </div>
                <button
                  onClick={() => onNavigate("notices")}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  Send reminder
                </button>
              </div>
            )}
          </Panel>
        </div>

        {/* Shop activity */}
        <div className="lg:col-span-2">
          <SectionLabel
            action={
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 h-7 gap-1 text-[12px] font-medium text-violet-600 hover:text-violet-700"
                onClick={() => onNavigate("shops")}
              >
                View full report <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Button>
            }
          >
            Shop activity
          </SectionLabel>

          <Panel>
            <Rows>
              <Row
                label="Actively trading"
                value={<span className="text-emerald-600 font-bold text-[15px]">{count(totals.tradingShops)}</span>}
              />
              <Row
                label="Idle (no recent sales)"
                value={<span className="text-amber-500 font-bold text-[15px]">{count(idle)}</span>}
              />
              <Row
                label="Never sold"
                value={<span className="text-gray-500 font-bold text-[15px]">{count(totals.neverSold)}</span>}
              />
              <Row
                label="Outstanding dues"
                value={<span className="text-red-500 font-bold text-[15px]">{rupees(totals.outstanding)}</span>}
              />
            </Rows>
          </Panel>
        </div>
      </div>

      {/* Bottom row: Revenue + Top shops */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Revenue summary card */}
          <div className="lg:col-span-3">
            <SectionLabel>Revenue summary</SectionLabel>
            <Panel>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Today",    value: rupees(totals.revenueToday),   color: "text-violet-700" },
                    { label: "30 days",  value: rupees(totals.revenue30d),     color: "text-gray-900" },
                    { label: "All time", value: rupees(totals.revenueAllTime), color: "text-gray-900" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-gray-50 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
                      <p className={`mt-1.5 text-[16px] font-bold tabular-nums ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {[
                    { label: "Bills today",   value: count(totals.billsToday) },
                    { label: "Bills 30 days", value: count(totals.bills30d) },
                    { label: "Bills all time",value: count(totals.billsAllTime) },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-gray-50 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
                      <p className="mt-1.5 text-[16px] font-bold tabular-nums text-gray-900">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {/* Top performing shops donut */}
          <div className="lg:col-span-2">
            <SectionLabel>Top performing shops</SectionLabel>
            <Panel>
              {donutSlices.length > 0 ? (
                <div className="flex items-center justify-center p-5">
                  <DonutChart slices={donutSlices} />
                </div>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No revenue yet"
                  hint="Shop revenue share will appear here once bills are recorded."
                />
              )}
            </Panel>
          </div>
      </div>
    </div>
  );
}
