import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAdminTenantDetail } from "./api";
import { Loader2, Package, IndianRupee, FileText, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function ShopDetailDialog({
  shopId, open, onOpenChange,
}: { shopId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useAdminTenantDetail(shopId || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <DialogTitle className="text-lg">Could not load this shop</DialogTitle>
            <DialogDescription>{(error as Error).message}</DialogDescription>
          </div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">
            Shop details not found.
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 p-6">
              <div className="min-w-0">
                <DialogTitle className="truncate text-2xl font-bold">{data.shop.name}</DialogTitle>
                <DialogDescription className="mt-1 font-mono text-xs">{data.shop.id}</DialogDescription>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    data.shop.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {data.shop.isActive ? "Active" : "Suspended"}
                </span>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Created {new Date(data.shop.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-muted/10 p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <Card>
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4" /> <span className="text-xs font-semibold uppercase">Inventory</span>
                      </div>
                      <p className="text-2xl font-bold tracking-tight tabular-nums">{data.inventory.products.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        products / {data.inventory.stockUnits.toLocaleString("en-IN")} units
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                        <IndianRupee className="h-4 w-4" /> <span className="text-xs font-semibold uppercase">Stock value</span>
                      </div>
                      <p className="text-2xl font-bold tracking-tight tabular-nums text-teal-600">{rupees(data.inventory.stockValue)}</p>
                      <p className="text-[10px] text-muted-foreground">At selling price</p>
                    </CardContent>
                  </Card>
                  <Card className={data.inventory.lowStock > 0 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" /> <span className="text-xs font-semibold uppercase">Low stock</span>
                      </div>
                      <p className={`text-2xl font-bold tracking-tight tabular-nums ${data.inventory.lowStock > 0 ? "text-amber-600" : ""}`}>
                        {data.inventory.lowStock.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Items needing restock</p>
                    </CardContent>
                  </Card>
                  <Card className={data.receivables.outstanding > 0 ? "border-rose-200 bg-rose-50/50 dark:bg-rose-950/20" : ""}>
                    <CardContent className="flex flex-col gap-1 p-4">
                      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" /> <span className="text-xs font-semibold uppercase">Receivables</span>
                      </div>
                      <p className={`text-2xl font-bold tracking-tight tabular-nums ${data.receivables.outstanding > 0 ? "text-rose-600" : ""}`}>
                        {rupees(data.receivables.outstanding)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Across {data.receivables.openBills} bills</p>
                    </CardContent>
                  </Card>
                </div>

                <TrendStrip series={data.series} />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Package className="h-4 w-4 text-primary" /> Top products (30 days)
                    </h3>
                    <div className="space-y-2">
                      {data.topProducts.map((p, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
                          <div className="min-w-0 flex-1 pr-4">
                            <p className="truncate font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                          </div>
                          <p className="shrink-0 font-bold tabular-nums text-emerald-600">{rupees(p.revenue)}</p>
                        </div>
                      ))}
                      {data.topProducts.length === 0 && (
                        <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">No sales in the last 30 days</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-primary" /> Recent bills
                    </h3>
                    <div className="space-y-2">
                      {data.recentBills.slice(0, 5).map((b, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <p className="font-bold">#{b.billNumber}</p>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  b.paymentStatus === "PAID"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                }`}
                              >
                                {b.paymentStatus}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{b.customerName || "Walk-in"}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-bold tabular-nums">{rupees(b.total)}</p>
                            <p className="text-[10px] capitalize text-muted-foreground">{b.paymentMode.toLowerCase()}</p>
                          </div>
                        </div>
                      ))}
                      {data.recentBills.length === 0 && (
                        <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">No bills yet</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4 text-primary" /> Who can sign in
                  </h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner logins</p>
                      {data.users.map((u, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {u.lastLoginAt ? `Last in ${new Date(u.lastLoginAt).toLocaleDateString("en-IN")}` : "Never signed in"}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase ${u.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {u.isActive ? "Active" : "Off"}
                          </span>
                        </div>
                      ))}
                      {data.users.length === 0 && (
                        <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">No email logins</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff (PIN)</p>
                      {data.staff.map((s, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.role}</p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase ${s.isActive ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {s.isActive ? "Active" : "Off"}
                          </span>
                        </div>
                      ))}
                      {data.staff.length === 0 && (
                        <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">No staff accounts</p>
                      )}
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

/** Last 14 days of billing, so a support call starts with "you stopped selling
 *  on Tuesday" rather than a number with no shape to it. */
function TrendStrip({ series }: { series: { day: string; revenue: number; bills: number }[] }) {
  const peak = Math.max(1, ...series.map((d) => d.revenue));
  const total = series.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" /> Last 14 days
        </h3>
        <p className="text-sm font-semibold tabular-nums">{rupees(total)}</p>
      </div>
      <div className="flex h-24 items-end gap-1">
        {series.map((d) => (
          <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-t transition-colors ${d.revenue > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-muted"}`}
              style={{ height: d.revenue > 0 ? `${Math.max(4, (d.revenue / peak) * 100)}%` : "3px" }}
              title={`${d.day} — ${rupees(d.revenue)} over ${d.bills} ${d.bills === 1 ? "bill" : "bills"}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]?.day.slice(5)}</span>
        <span>{series.at(-1)?.day.slice(5)}</span>
      </div>
    </div>
  );
}
