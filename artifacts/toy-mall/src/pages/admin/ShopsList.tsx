import { useState, useMemo } from "react";
import { useAdminOverview } from "./api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, MoreHorizontal, CheckCircle2, AlertTriangle, Building2, Store, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateTenantDialog, EditTenantDialog, ExtendTenantDialog, ViewUsersDialog } from "./TenantDialogs";
import { ShopDetailDialog } from "./ShopDetail";
import {
  BulkActionDialog, ResetPasswordDialog, ToggleActiveDialog,
  type BulkAction, type Shop,
} from "./ShopActions";

const FILTERS = ["all", "active", "suspended", "expired"] as const;
type Filter = (typeof FILTERS)[number];

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function ShopsList() {
  const { data, isLoading, error } = useAdminOverview();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* dialog state */
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Shop | null>(null);
  const [extendTenant, setExtendTenant] = useState<Shop | null>(null);
  const [usersTenantId, setUsersTenantId] = useState<string | null>(null);
  const [detailShopId, setDetailShopId] = useState<string | null>(null);
  const [toggleShop, setToggleShop] = useState<Shop | null>(null);
  const [pwdShop, setPwdShop] = useState<Shop | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);

  const shops = useMemo<Shop[]>(() => {
    if (!data?.shops) return [];
    let list = data.shops;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.ownerEmail?.toLowerCase().includes(q) ?? false));
    }
    if (filter !== "all") {
      list = list.filter((s) => s.access === filter || (filter === "active" && s.access === "expiring"));
    }
    return list;
  }, [data, search, filter]);

  /* A selection must survive filtering — suspending 8 shops then typing in the
   * search box should not silently drop them from the bulk action. */
  const selectedShops = useMemo<Shop[]>(
    () => (data?.shops ?? []).filter((s) => selectedIds.has(s.id)),
    [data, selectedIds],
  );

  const allVisibleSelected = shops.length > 0 && shops.every((s) => selectedIds.has(s.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) shops.forEach((s) => next.delete(s.id));
    else shops.forEach((s) => next.add(s.id));
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="font-medium">Could not load shops</p>
        <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shops</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.totals.shops ?? 0} on the platform &middot; {data?.totals.tradingShops ?? 0} trading
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New shop
        </Button>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 gap-2 rounded-lg bg-muted/50 p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="animate-in fade-in slide-in-from-top-2 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 duration-200">
          <span className="mr-1 text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button variant="secondary" size="sm" onClick={() => setBulkAction("extend")}>Extend access</Button>
          <Button variant="secondary" size="sm" onClick={() => setBulkAction("activate")}>Reactivate</Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkAction("suspend")}>Suspend</Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 font-medium text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all shops" />
                </th>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Store className="mx-auto mb-3 h-12 w-12 opacity-20" />
                    No shops match this search.
                  </td>
                </tr>
              ) : (
                shops.map((shop) => (
                  <tr key={shop.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(shop.id)}
                        onCheckedChange={() => toggleOne(shop.id)}
                        aria-label={`Select ${shop.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-3 text-left" onClick={() => setDetailShopId(shop.id)}>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground hover:underline">{shop.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {shop.id} &middot; {shop.ownerEmail || "No email"}
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3"><StatusBadge shop={shop} /></td>
                    <td className="px-4 py-3"><ActivityLabel shop={shop} /></td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">{inr(shop.revenueAllTime)}</p>
                      <p className="text-[10px] text-muted-foreground">{inr(shop.revenue30d)} (30d)</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowMenu
                        shop={shop}
                        onDetail={setDetailShopId}
                        onEdit={setEditTenant}
                        onExtend={setExtendTenant}
                        onUsers={setUsersTenantId}
                        onPassword={setPwdShop}
                        onToggle={setToggleShop}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile cards */}
      <div className="space-y-3 md:hidden">
        {shops.length === 0 ? (
          <div className="rounded-2xl border bg-card px-4 py-12 text-center text-muted-foreground">
            <Store className="mx-auto mb-3 h-12 w-12 opacity-20" />
            No shops match this search.
          </div>
        ) : (
          shops.map((shop) => (
            <div key={shop.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1"
                  checked={selectedIds.has(shop.id)}
                  onCheckedChange={() => toggleOne(shop.id)}
                  aria-label={`Select ${shop.name}`}
                />
                <button className="min-w-0 flex-1 text-left" onClick={() => setDetailShopId(shop.id)}>
                  <p className="truncate font-semibold">{shop.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{shop.id}</p>
                </button>
                <RowMenu
                  shop={shop}
                  onDetail={setDetailShopId}
                  onEdit={setEditTenant}
                  onExtend={setExtendTenant}
                  onUsers={setUsersTenantId}
                  onPassword={setPwdShop}
                  onToggle={setToggleShop}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge shop={shop} />
                <ActivityLabel shop={shop} />
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span>
                  <span className="font-semibold">{inr(shop.revenueAllTime)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{inr(shop.revenue30d)} (30d)</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditTenantDialog tenant={editTenant} open={!!editTenant} onOpenChange={(o) => !o && setEditTenant(null)} />
      <ExtendTenantDialog tenant={extendTenant} open={!!extendTenant} onOpenChange={(o) => !o && setExtendTenant(null)} />
      <ViewUsersDialog tenantId={usersTenantId} open={!!usersTenantId} onOpenChange={(o) => !o && setUsersTenantId(null)} />
      <ShopDetailDialog shopId={detailShopId} open={!!detailShopId} onOpenChange={(o) => !o && setDetailShopId(null)} />
      <ToggleActiveDialog shop={toggleShop} open={!!toggleShop} onOpenChange={(o) => !o && setToggleShop(null)} />
      <ResetPasswordDialog shop={pwdShop} open={!!pwdShop} onOpenChange={(o) => !o && setPwdShop(null)} />
      <BulkActionDialog
        action={bulkAction}
        shops={selectedShops}
        open={!!bulkAction}
        onOpenChange={(o) => !o && setBulkAction(null)}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

function StatusBadge({ shop }: { shop: Shop }) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold";
  return (
    <div>
      {shop.access === "active" && (
        <span className={`${base} bg-emerald-500/10 text-emerald-600`}><CheckCircle2 className="h-3.5 w-3.5" /> Active</span>
      )}
      {shop.access === "expiring" && (
        <span className={`${base} bg-amber-500/10 text-amber-600`}><AlertTriangle className="h-3.5 w-3.5" /> Expiring</span>
      )}
      {shop.access === "expired" && (
        <span className={`${base} bg-destructive/10 text-destructive`}>Expired</span>
      )}
      {shop.access === "suspended" && (
        <span className={`${base} bg-muted text-muted-foreground`}>Suspended</span>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {shop.daysLeft === null ? "Lifetime" : shop.daysLeft > 0 ? `${shop.daysLeft}d left` : `expired ${Math.abs(shop.daysLeft)}d ago`}
      </p>
    </div>
  );
}

function ActivityLabel({ shop }: { shop: Shop }) {
  const tone =
    shop.activity === "trading" ? "text-emerald-600"
    : shop.activity === "idle"  ? "text-amber-600"
    : "text-muted-foreground";
  const label =
    shop.activity === "trading" ? "Trading"
    : shop.activity === "idle"  ? "Idle"
    : "Never sold";
  return (
    <div>
      <span className={`text-xs font-medium ${tone}`}>{label}</span>
      {shop.lastSaleAt && (
        <p className="text-[10px] text-muted-foreground">
          {new Date(shop.lastSaleAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
      )}
    </div>
  );
}

function RowMenu({
  shop, onDetail, onEdit, onExtend, onUsers, onPassword, onToggle,
}: {
  shop: Shop;
  onDetail: (id: string) => void;
  onEdit: (s: Shop) => void;
  onExtend: (s: Shop) => void;
  onUsers: (id: string) => void;
  onPassword: (s: Shop) => void;
  onToggle: (s: Shop) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${shop.name}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDetail(shop.id)}>View details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(shop)}>Edit info</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExtend(shop)}>Extend access</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUsers(shop.id)}>View logins</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPassword(shop)}>Reset password</DropdownMenuItem>
        <DropdownMenuSeparator />
        {shop.isActive ? (
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => onToggle(shop)}
          >
            Suspend shop
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600"
            onClick={() => onToggle(shop)}
          >
            Reactivate shop
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
