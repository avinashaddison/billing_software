/**
 * Admin console → API keys — vendor-issued keys for the public API (/api/v1).
 *
 * Shop owners cannot create keys themselves (by design, for now): the vendor
 * issues a key per shop from here and hands it to the shop. The raw key is
 * shown exactly ONCE after creation; afterwards only the prefix is visible.
 * Revoking is final.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Check, Ban, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch, adminMutate, adminQueryKeys, useAdminTenantsLite } from "./api";
import {
  PageHeader, SectionLabel, Panel, Rows, Row, Tag, EmptyState, LoadError,
  PanelSkeleton, formatDay,
} from "./ui";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scope: "read" | "write";
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export default function ApiKeys() {
  const queryClient = useQueryClient();

  const shopsQuery = useAdminTenantsLite();
  const shops = shopsQuery.data?.tenants ?? [];

  const [selectedShop, setSelectedShop] = useState("");
  const shopId = selectedShop || shops[0]?.id || "";
  const shop = shops.find((s) => s.id === shopId);

  const keysQuery = useQuery<ApiKeyRow[]>({
    queryKey: adminQueryKeys.apiKeys(shopId),
    queryFn: () => adminFetch(`${API}/platform/tenants/${shopId}/api-keys`),
    enabled: !!shopId,
  });

  /* Create dialog — fields reset every time it OPENS: a permanently-mounted
     dialog keeps its previous state otherwise. */
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const openCreate = () => { setName(""); setScope("read"); setCreateOpen(true); };

  /* Reveal-once dialog — carries the SHOP the key was created for, bound at
     creation time: if the picker is switched while the request is in flight,
     the dialog must still attribute the credential to the right shop. */
  const [revealed, setRevealed] = useState<{ key: string; shopName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  /* Revoke confirm — tenant bound when the dialog opens, same reason. */
  const [revokeTarget, setRevokeTarget] = useState<{ row: ApiKeyRow; tenantId: string } | null>(null);

  /* Both mutations take the tenant as a VARIABLE (not from current UI state)
     so request, success handling and cache invalidation all stay tied to the
     shop the action started on, no matter what the picker does meanwhile. */
  const createKey = useMutation({
    mutationFn: (vars: { tenantId: string; shopName: string; name: string; scope: "read" | "write" }) =>
      adminMutate("POST", `/platform/tenants/${vars.tenantId}/api-keys`, {
        name: vars.name, scope: vars.scope,
      }) as Promise<{ key: string; apiKey: ApiKeyRow }>,
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys(vars.tenantId) });
      setCreateOpen(false);
      setCopied(false);
      setRevealed({ key: data.key, shopName: vars.shopName });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: (vars: { tenantId: string; keyId: string }) =>
      adminMutate("POST", `/platform/tenants/${vars.tenantId}/api-keys/${vars.keyId}/revoke`),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys(vars.tenantId) });
      setRevokeTarget(null);
      toast.success("Key revoked — it stops working immediately");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyKey = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.key);
      setCopied(true);
      toast.success("Key copied");
    } catch {
      toast.error("Could not copy — select the key text and copy it manually");
    }
  };

  const keys = keysQuery.data ?? [];
  const activeKeys  = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div>
      <PageHeader
        title="API keys"
        meta={shop ? shop.name : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={shopId}
              onChange={(e) => setSelectedShop(e.target.value)}
              disabled={shops.length === 0 || createKey.isPending || revokeKey.isPending}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isActive ? "" : " (suspended)"}
                </option>
              ))}
            </select>
            <Button
              onClick={openCreate}
              disabled={!shopId}
              className="h-9 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[13px] font-semibold text-white shadow-md shadow-violet-900/10 hover:opacity-90"
            >
              <Plus className="mr-1 h-4 w-4" /> New key
            </Button>
          </div>
        }
      />

      <p className="-mt-4 mb-6 max-w-2xl text-[13px] leading-relaxed text-gray-500">
        A key lets outside software read (or update) one shop's products, stock, suppliers
        and bills through the public API. Only you can issue keys — shop owners can't.
        Hand the key to the shop once; it's shown a single time.{" "}
        <a
          href="/developers"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-violet-600 hover:text-violet-700"
        >
          <BookOpen className="h-3.5 w-3.5" /> API reference
        </a>
      </p>

      {shop && !shop.isActive && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-medium text-amber-700">
          This shop is suspended — its keys are paused and will work again once you activate the shop.
        </p>
      )}

      {shopsQuery.isLoading || (keysQuery.isLoading && !!shopId) ? (
        <PanelSkeleton rows={3} header={false} />
      ) : shopsQuery.error ? (
        <LoadError message={(shopsQuery.error as Error).message} onRetry={() => shopsQuery.refetch()} />
      ) : shops.length === 0 ? (
        <EmptyState title="No shops yet" hint="Create a shop first, then issue keys for it." />
      ) : keysQuery.error ? (
        <LoadError message={(keysQuery.error as Error).message} onRetry={() => keysQuery.refetch()} />
      ) : (
        <div className="space-y-8">
          <div>
            <SectionLabel>Active keys</SectionLabel>
            <Panel>
              {activeKeys.length === 0 ? (
                <EmptyState
                  title="No API keys"
                  hint="Create one to let outside software use this shop's data."
                />
              ) : (
                <Rows>
                  {activeKeys.map((k) => (
                    <Row
                      key={k.id}
                      label={
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold" title={k.name}>{k.name}</span>
                          <Tag tone={k.scope === "write" ? "warn" : "positive"}>
                            {k.scope === "write" ? "read & write" : "read only"}
                          </Tag>
                        </span>
                      }
                      sub={
                        <span className="font-mono text-[11px]">
                          {k.keyPrefix}… · created {formatDay(k.createdAt)} ·{" "}
                          {k.lastUsedAt ? `last used ${formatDay(k.lastUsedAt)}` : "never used"}
                        </span>
                      }
                      value={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setRevokeTarget({ row: k, tenantId: shopId })}
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" /> Revoke
                        </Button>
                      }
                    />
                  ))}
                </Rows>
              )}
            </Panel>
          </div>

          {revokedKeys.length > 0 && (
            <div>
              <SectionLabel>Revoked keys</SectionLabel>
              <Panel>
                <Rows>
                  {revokedKeys.map((k) => (
                    <Row
                      key={k.id}
                      label={<span className="truncate text-gray-400 line-through" title={k.name}>{k.name}</span>}
                      sub={
                        <span className="font-mono text-[11px]">
                          {k.keyPrefix}… · revoked {k.revokedAt ? formatDay(k.revokedAt) : ""}
                        </span>
                      }
                      value={<Tag tone="neutral">Revoked</Tag>}
                    />
                  ))}
                </Rows>
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New API key{shop ? ` for ${shop.name}` : ""}</DialogTitle>
            <DialogDescription>
              Name it after the software that will use it, so you know what to revoke later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-key-name">Key name</Label>
              <Input
                id="admin-key-name"
                placeholder="e.g. Website sync"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Permission</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("read")}
                  className={
                    "rounded-xl border p-3 text-left transition-colors " +
                    (scope === "read" ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:bg-gray-50")
                  }
                >
                  <p className="text-sm font-bold">Read only</p>
                  <p className="text-xs text-gray-500">View products, stock, suppliers, bills</p>
                </button>
                <button
                  type="button"
                  onClick={() => setScope("write")}
                  className={
                    "rounded-xl border p-3 text-left transition-colors " +
                    (scope === "write" ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:bg-gray-50")
                  }
                >
                  <p className="text-sm font-bold">Read &amp; write</p>
                  <p className="text-xs text-gray-500">Also add products, update stock &amp; suppliers</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createKey.mutate({
                tenantId: shopId,
                shopName: shop?.name ?? shopId,
                name: name.trim(),
                scope,
              })}
              disabled={!name.trim() || createKey.isPending}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90"
            >
              {createKey.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal-once dialog ── */}
      <Dialog
        open={revealed !== null}
        onOpenChange={(open) => { if (!open) { setRevealed(null); setCopied(false); } }}
      >
        <DialogContent className="rounded-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>New API key for {revealed?.shopName}</DialogTitle>
            <DialogDescription>
              This key belongs to <span className="font-semibold">{revealed?.shopName}</span> only.
              Copy it now and pass it to that shop securely — for security, it can never be
              shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="select-all break-all rounded-xl bg-gray-100 p-3 font-mono text-xs">
              {revealed?.key}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              If it's lost, revoke this key and create a new one.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyKey}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy key"}
            </Button>
            <Button onClick={() => { setRevealed(null); setCopied(false); }}>
              I've saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke confirm ── */}
      <Dialog open={revokeTarget !== null} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Revoke "{revokeTarget?.row.name}"?</DialogTitle>
            <DialogDescription>
              Any software using this key stops working immediately. This cannot be undone —
              you'd create a new key instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => revokeTarget && revokeKey.mutate({
                tenantId: revokeTarget.tenantId,
                keyId: revokeTarget.row.id,
              })}
              disabled={revokeKey.isPending}
            >
              {revokeKey.isPending ? "Revoking…" : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
