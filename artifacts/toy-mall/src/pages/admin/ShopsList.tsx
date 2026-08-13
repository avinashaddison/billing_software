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
  DataTable, Th, Td, EmptyState, PanelSkeleton, formatDay
} from "./ui";

const FILTERS = ["all", "active", "suspended", "expired"] as const;
type Filter = (typeof FILTERS)[number];

export default function ShopsList() {
  const query = useAdminOverview();
  const { data, isLoading, error } = query;
  const refetch = (query as any).refetch as (() => void) | undefined;

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
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Shops" />
        <Toolbar>
          <div className="relative w-full max-w-sm flex-1 sm:w-64">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-16 rounded-full" />
            ))}
          </div>
        </Toolbar>
        <PanelSkeleton rows={10} header={false} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Shops" />
        <LoadError message={(error as Error)?.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader
        title="Shops"
        meta={`${count(data.totals.shops)} ${data.totals.shops === 1 ? "shop" : "shops"} on the platform · ${count(data.totals.tradingShops)} trading`}
        actions={
          <Button size="sm" className="h-8 font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-colors" onClick={() => setCreateOpen(true)}>
            New shop
          </Button>
        }
      />

      <Toolbar>
        <div className="relative w-full max-w-sm flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={2} />
          <Input
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg pl-9 text-[13px] bg-white border-gray-200 focus-visible:ring-violet-500 shadow-sm"
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </FilterChip>
          ))}
        </div>
      </Toolbar>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-2.5 shadow-sm transition-all animate-in fade-in duration-200">
          <span className="mr-2 text-[13px] font-semibold text-violet-700">
            {selectedIds.size} selected
          </span>
          <Button variant="outline" size="sm" className="h-8 text-[12px] font-medium bg-white border-violet-200 text-violet-700 hover:bg-violet-100 hover:text-violet-800 transition-colors" onClick={() => setBulkAction("extend")}>Extend access</Button>
          <Button variant="outline" size="sm" className="h-8 text-[12px] font-medium bg-white border-violet-200 text-violet-700 hover:bg-violet-100 hover:text-violet-800 transition-colors" onClick={() => setBulkAction("activate")}>Reactivate</Button>
          <Button variant="outline" size="sm" className="h-8 text-[12px] font-medium bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors" onClick={() => setBulkAction("suspend")}>Suspend</Button>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" className="h-8 text-[12px] font-medium text-violet-600 hover:text-violet-800 hover:bg-violet-100/50" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <Panel>
        <DataTable>
          <thead>
            <tr>
              <Th className="w-10">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all shops" className="border-gray-300 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600" />
              </Th>
              <Th>Shop</Th>
              <Th>Status</Th>
              <Th>Activity</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="w-10"></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {shops.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-16">
                  <EmptyState title="No shops found" hint="Try adjusting your search or filters to find what you're looking for." />
                </Td>
              </tr>
            ) : (
              shops.map((shop) => (
                <tr key={shop.id} className="transition-colors hover:bg-violet-50/50">
                  <Td>
                    <Checkbox
                      checked={selectedIds.has(shop.id)}
                      onCheckedChange={() => toggleOne(shop.id)}
                      aria-label={`Select ${shop.name}`}
                      className="border-gray-300 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                    />
                  </Td>
                  <Td>
                    <button className="text-left outline-none rounded-[2px] ring-offset-2 focus-visible:ring-2 focus-visible:ring-violet-500 block max-w-[200px] sm:max-w-[320px]" onClick={() => setDetailShopId(shop.id)}>
                      <p className="font-semibold text-gray-900 hover:text-violet-700 truncate transition-colors" title={shop.name}>{shop.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-gray-400 truncate" title={`${shop.id} · ${shop.ownerEmail || "No email"}`}>
                        {shop.id} · {shop.ownerEmail || "No email"}
                      </p>
                    </button>
                  </Td>
                  <Td><StatusBadge shop={shop} /></Td>
                  <Td><ActivityLabel shop={shop} /></Td>
                  <Td className="text-right">
                    <p className="font-semibold text-gray-900 tabular-nums">{rupees(shop.revenueAllTime)}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-400 tabular-nums">{rupees(shop.revenue30d)} (30d)</p>
                  </Td>
                  <Td className="text-right">
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
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
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
    <div className="flex flex-col items-start min-w-[100px]">
      <Tag tone={tone}>{label}</Tag>
      <p className="mt-1.5 text-[11px] font-medium text-gray-400">{sub}</p>
    </div>
  );
}

function ActivityLabel({ shop }: { shop: Shop }) {
  let tone: Tone = "neutral";
  let label = "";

  if (shop.activity === "trading") { tone = "positive"; label = "Trading"; }
  else if (shop.activity === "idle") { tone = "warn"; label = "Idle"; }
  else { tone = "neutral"; label = "Never sold"; }

  const sub = shop.lastSaleAt ? formatDay(shop.lastSaleAt) : "";

  return (
    <div className="flex flex-col items-start min-w-[100px]">
      <Tag tone={tone}>{label}</Tag>
      {sub && <p className="mt-1.5 text-[11px] font-medium text-gray-400">{sub}</p>}
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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 hover:bg-gray-100/50 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset outline-none rounded-md" aria-label={`Actions for ${shop.name}`}>
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 text-[13px] font-medium text-gray-700">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onDetail(shop.id)}>View details</DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onEdit(shop)}>Edit info</DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onExtend(shop)}>Extend access</DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onUsers(shop.id)}>View logins</DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onPassword(shop)}>Reset password</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onViewAs(shop)}>View as shop</DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-violet-50 focus:text-violet-700 cursor-pointer" onClick={() => onSignOut(shop)}>Sign out all devices</DropdownMenuItem>
        <DropdownMenuSeparator />
        {shop.isActive ? (
          <DropdownMenuItem
            className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer"
            onClick={() => onToggle(shop)}
          >
            Suspend shop
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer"
            onClick={() => onToggle(shop)}
          >
            Reactivate shop
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
