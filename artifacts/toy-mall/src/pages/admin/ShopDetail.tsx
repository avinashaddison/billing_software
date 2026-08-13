import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAdminTenantDetail } from "./api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MetricRow, Metric, SectionLabel, Panel, Rows, Row, Tag, count, rupees, Tone, LoadError, EmptyState, PanelSkeleton, formatDay } from "./ui";
import { Skeleton } from "@/components/ui/skeleton";

export function ShopDetailDialog({
  shopId, open, onOpenChange,
}: { shopId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useAdminTenantDetail(shopId || "");
  const { data, isLoading, error } = query;
  const refetch = (query as any).refetch as (() => void) | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-4xl rounded-2xl bg-white border-gray-100 shadow-xl">
        {isLoading ? (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-5 bg-white">
              <div className="space-y-2.5">
                <Skeleton className="h-7 w-48 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
              <div className="space-y-2.5 flex flex-col items-end">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24 rounded-md" />
              </div>
            </div>
            <div className="flex-1 p-6 md:p-8 bg-[#F9F9FB]">
               <div className="mx-auto w-full max-w-3xl space-y-10">
                 <MetricRow cols={4}>
                   <Skeleton className="h-[120px] rounded-2xl" />
                   <Skeleton className="h-[120px] rounded-2xl" />
                   <Skeleton className="h-[120px] rounded-2xl" />
                   <Skeleton className="h-[120px] rounded-2xl" />
                 </MetricRow>
                 <div>
                   <Skeleton className="h-5 w-32 mb-3" />
                   <Skeleton className="h-24 w-full rounded-xl" />
                 </div>
                 <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                   <div><Skeleton className="h-5 w-32 mb-3" /><PanelSkeleton rows={4} header={false} /></div>
                   <div><Skeleton className="h-5 w-32 mb-3" /><PanelSkeleton rows={4} header={false} /></div>
                 </div>
               </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 bg-[#F9F9FB]">
             <LoadError message={(error as Error).message} onRetry={refetch} />
          </div>
        ) : !data ? (
          <div className="flex h-full items-center justify-center p-6 bg-[#F9F9FB]">
            <EmptyState title="Shop not found" hint="The shop details could not be loaded or do not exist." />
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-5 bg-white z-10 shadow-sm relative">
              <div className="min-w-0 pr-4">
                <DialogTitle className="text-[22px] font-bold leading-tight tracking-tight text-gray-900 truncate block" title={data.shop.name}>{data.shop.name}</DialogTitle>
                <DialogDescription className="mt-1 font-mono text-[12px] font-medium text-gray-500 truncate block" title={data.shop.id}>{data.shop.id}</DialogDescription>
              </div>
              <div className="shrink-0 text-right">
                <Tag tone={data.shop.isActive ? "positive" : "danger"}>
                  {data.shop.isActive ? "Active" : "Suspended"}
                </Tag>
                <p className="mt-1.5 text-[11px] font-medium text-gray-400">
                  Created {formatDay(data.shop.createdAt)}
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-[#F9F9FB]">
              <div className="mx-auto w-full max-w-3xl space-y-10 p-6 md:p-8">
                
                <MetricRow cols={4}>
                  <Metric label="Inventory" value={count(data.inventory.products)} hint={`products / ${count(data.inventory.stockUnits)} units`} />
                  <Metric label="Stock value" value={rupees(data.inventory.stockValue)} hint="At selling price" />
                  <Metric label="Low stock" value={count(data.inventory.lowStock)} hint="Items needing restock" tone={data.inventory.lowStock > 0 ? "warn" : "neutral"} />
                  <Metric label="Receivables" value={rupees(data.receivables.outstanding)} hint={`Across ${count(data.receivables.openBills)} bills`} tone={data.receivables.outstanding > 0 ? "danger" : "neutral"} />
                </MetricRow>

                <TrendStrip series={data.series} />

                <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                  <div>
                    <SectionLabel>Top products (30d)</SectionLabel>
                    <Panel>
                      {data.topProducts.length === 0 ? (
                        <EmptyState title="No recent sales" hint="No products were sold in the last 30 days." />
                      ) : (
                        <Rows>
                          {data.topProducts.map((p, i) => (
                            <Row
                              key={i}
                              label={<span className="block truncate max-w-[200px]" title={p.name}>{p.name}</span>}
                              sub={`${count(p.qty)} sold`}
                              value={rupees(p.revenue)}
                            />
                          ))}
                        </Rows>
                      )}
                    </Panel>
                  </div>

                  <div>
                    <SectionLabel>Recent bills</SectionLabel>
                    <Panel>
                      {data.recentBills.length === 0 ? (
                        <EmptyState title="No bills yet" hint="This shop hasn't generated any bills." />
                      ) : (
                        <Rows>
                          {data.recentBills.slice(0, 5).map((b, i) => {
                            const statusTone: Tone = b.paymentStatus === "PAID" ? "positive" : "danger";
                            return (
                              <Row
                                key={i}
                                label={`#${b.billNumber}`}
                                sub={<span className="block truncate max-w-[150px]" title={b.customerName || "Walk-in"}>{b.customerName || "Walk-in"}</span>}
                                value={
                                  <div className="text-right">
                                    <div className="font-semibold text-gray-900 tabular-nums">{rupees(b.total)}</div>
                                    <div className="mt-1 text-[10px] font-medium text-gray-500 flex items-center justify-end gap-1.5">
                                      <Tag tone={statusTone}>{b.paymentStatus}</Tag> <span className="uppercase tracking-widest">{b.paymentMode}</span>
                                    </div>
                                  </div>
                                }
                              />
                            );
                          })}
                        </Rows>
                      )}
                    </Panel>
                  </div>
                </div>

                <div>
                  <SectionLabel>Access &amp; Logins</SectionLabel>
                  <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-[13px] font-semibold text-gray-900">Owner logins</h3>
                      <Panel>
                        {data.users.length === 0 ? (
                          <EmptyState title="No email logins" hint="No owners or admins have email access." />
                        ) : (
                          <Rows>
                            {data.users.map((u, i) => (
                              <Row
                                key={i}
                                label={<span className="block truncate max-w-[200px]" title={u.email}>{u.email}</span>}
                                sub={u.lastLoginAt ? `Last in ${formatDay(u.lastLoginAt)}` : "Never signed in"}
                                value={<Tag tone={u.isActive ? "positive" : "neutral"}>{u.isActive ? "Active" : "Off"}</Tag>}
                              />
                            ))}
                          </Rows>
                        )}
                      </Panel>
                    </div>
                    <div>
                      <h3 className="mb-3 text-[13px] font-semibold text-gray-900">Staff (PIN)</h3>
                      <Panel>
                        {data.staff.length === 0 ? (
                          <EmptyState title="No staff accounts" hint="No staff members using PINs." />
                        ) : (
                          <Rows>
                            {data.staff.map((s, i) => (
                              <Row
                                key={i}
                                label={<span className="block truncate max-w-[200px]" title={s.name}>{s.name}</span>}
                                sub={<span className="uppercase tracking-widest text-[10px] font-bold text-gray-400">{s.role}</span>}
                                value={<Tag tone={s.isActive ? "positive" : "neutral"}>{s.isActive ? "Active" : "Off"}</Tag>}
                              />
                            ))}
                          </Rows>
                        )}
                      </Panel>
                    </div>
                  </div>
                </div>
                
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrendStrip({ series }: { series: { day: string; revenue: number; bills: number }[] }) {
  if (!series || series.length === 0) return null;

  const peak = Math.max(1, ...series.map((d) => d.revenue));
  const total = series.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div>
      <SectionLabel action={<span className="text-[15px] font-bold tabular-nums text-gray-900">{rupees(total)}</span>}>
        Last 14 days
      </SectionLabel>
      <div className="flex h-24 items-end gap-[1px] overflow-hidden rounded-xl border border-gray-100 bg-white p-[1px] shadow-sm">
        {series.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
            <div
              className={`w-full rounded-t-[2px] transition-colors ${d.revenue > 0 ? "bg-violet-200 group-hover:bg-violet-300" : ""}`}
              style={{ height: d.revenue > 0 ? `${Math.max(4, (d.revenue / peak) * 100)}%` : "0%" }}
              title={`${formatDay(d.day)} — ${rupees(d.revenue)} over ${count(d.bills)} ${d.bills === 1 ? "bill" : "bills"}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-gray-400">
        <span>{formatDay(series[0]?.day || "")}</span>
        <span>{formatDay(series.at(-1)?.day || "")}</span>
      </div>
    </div>
  );
}
