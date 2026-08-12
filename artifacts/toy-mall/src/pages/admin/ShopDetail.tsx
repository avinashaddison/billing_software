import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAdminTenantDetail } from "./api";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MetricRow, Metric, SectionLabel, Panel, Rows, Row, Tag, count, rupees, Tone, LoadError } from "./ui";

export function ShopDetailDialog({
  shopId, open, onOpenChange,
}: { shopId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useAdminTenantDetail(shopId || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-4xl rounded-lg">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        ) : error ? (
          <div className="p-6">
             <LoadError message={(error as Error).message} />
          </div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center p-6 text-[13px] text-muted-foreground">
            Shop details not found.
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-5">
              <div className="min-w-0">
                <DialogTitle className="text-[22px] font-medium leading-tight tracking-tight text-foreground">{data.shop.name}</DialogTitle>
                <DialogDescription className="mt-1 font-mono text-[11px] text-muted-foreground">{data.shop.id}</DialogDescription>
              </div>
              <div className="shrink-0 text-right">
                <Tag tone={data.shop.isActive ? "positive" : "danger"}>
                  {data.shop.isActive ? "Active" : "Suspended"}
                </Tag>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Created {new Date(data.shop.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1">
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
                      <Rows>
                        {data.topProducts.map((p, i) => (
                          <Row
                            key={i}
                            label={p.name}
                            sub={`${count(p.qty)} sold`}
                            value={rupees(p.revenue)}
                          />
                        ))}
                        {data.topProducts.length === 0 && (
                          <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No sales in the last 30 days</div>
                        )}
                      </Rows>
                    </Panel>
                  </div>

                  <div>
                    <SectionLabel>Recent bills</SectionLabel>
                    <Panel>
                      <Rows>
                        {data.recentBills.slice(0, 5).map((b, i) => {
                          const statusTone: Tone = b.paymentStatus === "PAID" ? "positive" : "danger";
                          return (
                            <Row
                              key={i}
                              label={`#${b.billNumber}`}
                              sub={b.customerName || "Walk-in"}
                              value={
                                <div className="text-right">
                                  <div>{rupees(b.total)}</div>
                                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                                    <Tag tone={statusTone}>{b.paymentStatus}</Tag> · {b.paymentMode.toLowerCase()}
                                  </div>
                                </div>
                              }
                            />
                          );
                        })}
                        {data.recentBills.length === 0 && (
                          <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No bills yet</div>
                        )}
                      </Rows>
                    </Panel>
                  </div>
                </div>

                <div>
                  <SectionLabel>Access &amp; Logins</SectionLabel>
                  <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-[13px] font-medium text-foreground">Owner logins</h3>
                      <Panel>
                        <Rows>
                          {data.users.map((u, i) => (
                            <Row
                              key={i}
                              label={u.email}
                              sub={u.lastLoginAt ? `Last in ${new Date(u.lastLoginAt).toLocaleDateString("en-IN")}` : "Never signed in"}
                              value={<Tag tone={u.isActive ? "positive" : "neutral"}>{u.isActive ? "Active" : "Off"}</Tag>}
                            />
                          ))}
                          {data.users.length === 0 && (
                            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No email logins</div>
                          )}
                        </Rows>
                      </Panel>
                    </div>
                    <div>
                      <h3 className="mb-3 text-[13px] font-medium text-foreground">Staff (PIN)</h3>
                      <Panel>
                        <Rows>
                          {data.staff.map((s, i) => (
                            <Row
                              key={i}
                              label={s.name}
                              sub={s.role}
                              value={<Tag tone={s.isActive ? "positive" : "neutral"}>{s.isActive ? "Active" : "Off"}</Tag>}
                            />
                          ))}
                          {data.staff.length === 0 && (
                            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No staff accounts</div>
                          )}
                        </Rows>
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
  const peak = Math.max(1, ...series.map((d) => d.revenue));
  const total = series.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div>
      <SectionLabel action={<span className="text-sm font-medium tabular-nums text-foreground">{rupees(total)}</span>}>
        Last 14 days
      </SectionLabel>
      <div className="flex h-24 items-end gap-px overflow-hidden rounded-lg border bg-border p-px">
        {series.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col items-center justify-end bg-background">
            <div
              className={`w-full transition-colors ${d.revenue > 0 ? "bg-muted-foreground/30 group-hover:bg-muted-foreground/50" : ""}`}
              style={{ height: d.revenue > 0 ? `${Math.max(4, (d.revenue / peak) * 100)}%` : "0%" }}
              title={`${d.day} — ${rupees(d.revenue)} over ${count(d.bills)} ${d.bills === 1 ? "bill" : "bills"}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{series[0]?.day.slice(5)}</span>
        <span>{series.at(-1)?.day.slice(5)}</span>
      </div>
    </div>
  );
}
