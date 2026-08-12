import { useState, useMemo } from "react";
import { useAdminOverview } from "./api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateTenantDialog, EditTenantDialog, ExtendTenantDialog } from "./TenantDialogs";
import { PeopleDialog } from "./People";
import { ShopDetailDialog } from "./ShopDetail";
import {
  BulkActionDialog, ResetPasswordDialog, ToggleActiveDialog, ForceSignOutDialog, ViewAsDialog,
  type BulkAction, type Shop,
} from "./ShopActions";
import {
  PageHeader, Toolbar, FilterChip, Panel, Tag, LoadError, count, rupees, Tone,
} from "./ui";

const FILTERS = ["all", "active", "suspended", "expired"] as const;
type Filter = (typeof FILTERS)[number];

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
  const [signOutShop, setSignOutShop] = useState<Shop | null>(null);
  const [viewAsShop, setViewAsShop] = useState<Shop | null>(null);
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

  if (isLoading || (!data && !error)) {
    return (
      <div>
        <PageHeader title="Shops" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Shops" />
        <LoadError message={(error as Error)?.message} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader
        title="Shops"
        meta={`${count(data.totals.shops)} ${data.totals.shops === 1 ? "shop" : "shops"} on the platform · ${count(data.totals.tradingShops)} trading`}
        actions={
          <Button size="sm" className="h-8" onClick={() => setCreateOpen(true)}>
            New shop
          </Button>
        }
      />

      <Toolbar>
        <div className="relative w-full max-w-sm flex-1 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Input
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md pl-9 text-[13px]"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          {FILTERS.map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </FilterChip>
          ))}
        </div>
      </Toolbar>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <span className="mr-2 text-[13px] font-medium text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setBulkAction("extend")}>Extend access</Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setBulkAction("activate")}>Reactivate</Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setBulkAction("suspend")}>Suspend</Button>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="border-b text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3 font-medium">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all shops" />
                </th>
                <th className="px-4 py-3 font-medium">Shop</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No shops match this search.
                  </td>
                </tr>
              ) : (
                shops.map((shop) => (
                  <tr key={shop.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(shop.id)}
                        onCheckedChange={() => toggleOne(shop.id)}
                        aria-label={`Select ${shop.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-left" onClick={() => setDetailShopId(shop.id)}>
                        <p className="font-medium text-foreground hover:underline">{shop.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {shop.id} · {shop.ownerEmail || "No email"}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3"><StatusBadge shop={shop} /></td>
                    <td className="px-4 py-3"><ActivityLabel shop={shop} /></td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium tabular-nums">{rupees(shop.revenueAllTime)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{rupees(shop.revenue30d)} (30d)</p>
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
                        onViewAs={setViewAsShop}
                        onSignOut={setSignOutShop}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditTenantDialog tenant={editTenant} open={!!editTenant} onOpenChange={(o) => !o && setEditTenant(null)} />
      <ExtendTenantDialog tenant={extendTenant} open={!!extendTenant} onOpenChange={(o) => !o && setExtendTenant(null)} />
      <PeopleDialog
        tenantId={usersTenantId}
        shopName={data?.shops.find((s) => s.id === usersTenantId)?.name}
        open={!!usersTenantId}
        onOpenChange={(o) => !o && setUsersTenantId(null)}
      />
      <ShopDetailDialog shopId={detailShopId} open={!!detailShopId} onOpenChange={(o) => !o && setDetailShopId(null)} />
      <ToggleActiveDialog shop={toggleShop} open={!!toggleShop} onOpenChange={(o) => !o && setToggleShop(null)} />
      <ResetPasswordDialog shop={pwdShop} open={!!pwdShop} onOpenChange={(o) => !o && setPwdShop(null)} />
      <ForceSignOutDialog shop={signOutShop} open={!!signOutShop} onOpenChange={(o) => !o && setSignOutShop(null)} />
      <ViewAsDialog shop={viewAsShop} open={!!viewAsShop} onOpenChange={(o) => !o && setViewAsShop(null)} />
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
  let tone: Tone = "neutral";
  let label = "";

  if (shop.access === "active") { tone = "positive"; label = "Active"; }
  else if (shop.access === "expiring") { tone = "warn"; label = "Expiring"; }
  else if (shop.access === "expired") { tone = "danger"; label = "Expired"; }
  else if (shop.access === "suspended") { tone = "neutral"; label = "Suspended"; }

  const sub = shop.daysLeft === null ? "Lifetime" : shop.daysLeft > 0 ? `${shop.daysLeft}d left` : `expired ${Math.abs(shop.daysLeft)}d ago`;

  return (
    <div>
      <Tag tone={tone}>{label}</Tag>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function ActivityLabel({ shop }: { shop: Shop }) {
  let tone: Tone = "neutral";
  let label = "";

  if (shop.activity === "trading") { tone = "positive"; label = "Trading"; }
  else if (shop.activity === "idle") { tone = "warn"; label = "Idle"; }
  else { tone = "neutral"; label = "Never sold"; }

  const sub = shop.lastSaleAt ? new Date(shop.lastSaleAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

  return (
    <div>
      <Tag tone={tone}>{label}</Tag>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RowMenu({
  shop, onDetail, onEdit, onExtend, onUsers, onPassword, onToggle, onViewAs, onSignOut,
}: {
  shop: Shop;
  onDetail: (id: string) => void;
  onEdit: (s: Shop) => void;
  onExtend: (s: Shop) => void;
  onUsers: (id: string) => void;
  onPassword: (s: Shop) => void;
  onToggle: (s: Shop) => void;
  onViewAs: (s: Shop) => void;
  onSignOut: (s: Shop) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Actions for ${shop.name}`}>
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 text-[13px]">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDetail(shop.id)}>View details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(shop)}>Edit info</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExtend(shop)}>Extend access</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUsers(shop.id)}>View logins</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPassword(shop)}>Reset password</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onViewAs(shop)}>View as shop</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSignOut(shop)}>Sign out all devices</DropdownMenuItem>
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
