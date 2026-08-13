/* Confirmation + credential dialogs for shop actions.
 *
 * Every action in here is destructive or account-changing, so none of them may
 * fire straight off a menu click: each one names the shop (or the exact number
 * of shops) it is about to affect before anything is sent.
 */
import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff, LogOut, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "./api";
import { ACCESS_PRESETS, type AccessKey, type OverviewData } from "./types";
import { Notice, Rows, Row, formatDay } from "./ui";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

export type Shop = OverviewData["shops"][number];

/* ─────────────── suspend / activate a single shop ─────────────── */

export function ToggleActiveDialog({
  shop, open, onOpenChange,
}: { shop: Shop | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const suspending = !!shop?.isActive;

  const run = async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${shop.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !shop.isActive }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Could not update this shop");
        return;
      }
      toast.success(suspending ? `${shop.name} suspended` : `${shop.name} reactivated`);
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
      onOpenChange(false);
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[18px] font-bold text-gray-900">
            {suspending ? `Suspend ${shop?.name}?` : `Reactivate ${shop?.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-gray-500 leading-relaxed">
            {suspending
              ? "Everyone at this shop will be locked out at their next sign-in and cannot bill until you reactivate them. Their data is left untouched."
              : "Staff and owners at this shop will be able to sign in and bill again straight away."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {suspending && shop?.activity === "trading" && (
          <div className="my-2">
            <Notice tone="danger">
              This shop is actively trading — it last billed {shop.lastSaleAt ? formatDay(shop.lastSaleAt) : "recently"}.
            </Notice>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="font-semibold rounded-lg">Cancel</AlertDialogCancel>
          <Button variant={suspending ? "destructive" : "default"} disabled={busy} onClick={run} className="font-semibold rounded-lg">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
            {suspending ? "Suspend shop" : "Reactivate shop"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─────────────── reset the owner's password ─────────────── */

export function ResetPasswordDialog({
  shop, open, onOpenChange,
}: { shop: Shop | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setPwd(""); setConfirmPwd(""); setShow(false); }
  }, [open]);

  const tooShort = pwd.length > 0 && pwd.length < 8;
  const mismatch = confirmPwd.length > 0 && pwd !== confirmPwd;
  const valid = pwd.length >= 8 && pwd.length <= 128 && pwd === confirmPwd;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !valid) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${shop.id}/owner-password`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Could not reset the password"); return; }
      toast.success(`New password set for ${d.ownerEmail ?? shop.name}`);
      onOpenChange(false);
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-gray-900">Reset owner password</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500 leading-relaxed">
              Sets a new sign-in password for the owner of {shop?.name}
              {shop?.ownerEmail ? ` (${shop.ownerEmail})` : ""}. Their current password stops working immediately, so make sure you can pass this on to them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-5">
            <div className="space-y-2">
              <Label htmlFor="new-owner-pwd" className="text-[12px] font-bold uppercase tracking-wider text-gray-500">New password</Label>
              <div className="relative">
                <Input
                  id="new-owner-pwd"
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="pr-10 rounded-lg focus-visible:ring-violet-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                </button>
              </div>
              {tooShort && <p className="text-[12px] font-medium text-red-600">Use at least 8 characters.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-owner-pwd" className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Confirm password</Label>
              <Input
                id="confirm-owner-pwd"
                type={show ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Type it again"
                autoComplete="new-password"
                className="rounded-lg focus-visible:ring-violet-500/40"
              />
              {mismatch && <p className="text-[12px] font-medium text-red-600">The two passwords do not match.</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="font-semibold">Cancel</Button>
            <Button type="submit" disabled={!valid || busy} className="font-semibold rounded-lg">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Set password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── bulk activate / suspend / extend ─────────────── */

export type BulkAction = "activate" | "suspend" | "extend";

type BulkResult = { id: string; ok: boolean; error?: string };

const VERB: Record<BulkAction, string> = {
  activate: "Reactivate",
  suspend:  "Suspend",
  extend:   "Extend access for",
};

export function BulkActionDialog({
  action, shops, open, onOpenChange, onDone,
}: {
  action: BulkAction | null;
  shops: Shop[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [duration, setDuration] = useState<AccessKey>("30d");
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<BulkResult[] | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) { setFailures(null); setDuration("30d"); }
  }, [open]);

  const count = shops.length;
  const trading = shops.filter((s) => s.activity === "trading");

  const run = async () => {
    if (!action || count === 0) return;
    setBusy(true);
    setFailures(null);
    try {
      const r = await fetch(`${API}/platform/tenants/bulk`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: shops.map((s) => s.id),
          action,
          ...(action === "extend" ? { expiresAt: duration } : {}),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Bulk action failed"); return; }

      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });

      const results: BulkResult[] = Array.isArray(d.results) ? d.results : [];
      const failed = results.filter((x) => !x.ok);
      const updated = typeof d.updated === "number" ? d.updated : count - failed.length;

      if (failed.length === 0) {
        toast.success(`${updated} ${updated === 1 ? "shop" : "shops"} updated`);
        onDone();
        onOpenChange(false);
        return;
      }
      // Partial success: keep the dialog open so the failures are actually read.
      toast.warning(`${updated} of ${count} updated — ${failed.length} failed`);
      setFailures(failed);
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => shops.find((s) => s.id === id)?.name ?? id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-gray-900">
            {action ? VERB[action] : ""} {count} {count === 1 ? "shop" : "shops"}?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-gray-500 leading-relaxed">
            {action === "suspend" && "Everyone at these shops will be locked out at their next sign-in and cannot bill until you reactivate them. Their data is left untouched."}
            {action === "activate" && "These shops will be able to sign in and bill again straight away."}
            {action === "extend" && "Adds the same amount of time to every selected shop, counted from whichever is later: today or their current expiry."}
          </DialogDescription>
        </DialogHeader>

        {failures ? (
          <div className="space-y-3 py-4">
            <p className="text-[13px] font-semibold text-gray-900">These shops were not changed:</p>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-red-100 bg-red-50/50 shadow-sm">
              <Rows>
                {failures.map((f) => (
                  <Row 
                    key={f.id} 
                    label={<span className="font-semibold text-gray-900">{nameOf(f.id)}</span>} 
                    sub={<span className="text-red-600 font-medium">{f.error || "Unknown error"}</span>} 
                  />
                ))}
              </Rows>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-4">
            {action === "extend" && (
              <div className="space-y-2">
                <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Add</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as AccessKey)}>
                  <SelectTrigger className="rounded-lg focus-visible:ring-violet-500/40"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {ACCESS_PRESETS.map((p) => <SelectItem key={p.key} value={p.key} className="rounded-lg">{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action === "suspend" && trading.length > 0 && (
              <Notice tone="danger">
                {trading.length === 1
                  ? `${trading[0].name} is actively trading.`
                  : `${trading.length} of these shops are actively trading.`}
              </Notice>
            )}

            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 shadow-sm">
              <Rows>
                {shops.map((s) => (
                  <Row 
                    key={s.id} 
                    label={<span className="font-semibold text-gray-900">{s.name}</span>} 
                    value={<span className="font-mono text-gray-500 bg-white border border-gray-100 px-1.5 py-0.5 rounded text-[11px] truncate max-w-[120px]" title={s.id}>{s.id}</span>} 
                  />
                ))}
              </Rows>
            </div>
          </div>
        )}

        <DialogFooter>
          {failures ? (
            <Button onClick={() => { onDone(); onOpenChange(false); }} className="font-semibold rounded-lg w-full sm:w-auto">Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="font-semibold">Cancel</Button>
              <Button
                variant={action === "suspend" ? "destructive" : "default"}
                onClick={run}
                disabled={busy || count === 0}
                className="font-semibold rounded-lg"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
                {action ? VERB[action] : ""} {count}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── kick every device off ─────────────── */

export function ForceSignOutDialog({
  shop, open, onOpenChange,
}: { shop: Shop | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${shop.id}/signout-all`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Could not sign those devices out"); return; }
      const n = typeof d.devices === "number" ? d.devices : 0;
      toast.success(
        n === 0
          ? `No one was signed in at ${shop.name}`
          : `${n} ${n === 1 ? "device" : "devices"} signed out of ${shop.name}`,
      );
      onOpenChange(false);
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[18px] font-bold text-gray-900">Sign every device out of {shop?.name}?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-gray-500 leading-relaxed">
            Every phone, tablet and computer currently signed in at this shop is signed out
            straight away, including any half-finished bill on screen. Nobody is locked out —
            they can sign back in with their usual PIN or password. Use this when a device is
            lost or someone has left.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {shop?.activity === "trading" && (
          <div className="my-2">
            <Notice tone="danger">
              This shop is trading right now — someone may be mid-bill at the counter.
            </Notice>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="font-semibold rounded-lg">Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={run} className="font-semibold rounded-lg">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} /> : <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />}
            Sign out all devices
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─────────────── open the shop read-only ─────────────── */

export function ViewAsDialog({
  shop, open, onOpenChange,
}: { shop: Shop | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ as: string; minutes: number } | null>(null);

  /* Reset on open or the previous shop's ready session is offered for this one. */
  useEffect(() => { if (open) { setReady(null); setBusy(false); } }, [open, shop?.id]);

  const start = async () => {
    if (!shop) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${shop.id}/view-as`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Could not open this shop"); return; }
      setReady({ as: typeof d.as === "string" ? d.as : "", minutes: typeof d.minutes === "number" ? d.minutes : 60 });
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  /* Two-step flow: the session is created first, then the tab opens from a
   * direct click so the browser does not treat it as a pop-up. */
  const openShop = () => {
    window.open(`${BASE}/`, "_blank", "noopener");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold text-gray-900">Open {shop?.name} read-only</DialogTitle>
          <DialogDescription className="text-[13px] text-gray-500 leading-relaxed">
            Opens the shop&apos;s own app exactly as their staff see it, so you can follow a
            problem through their screens instead of asking them to describe it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Notice tone="neutral">
            <div className="space-y-1.5 text-gray-900">
              <p className="font-bold text-[13px]">While the session is open:</p>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 text-[13px]">
                <li>You can look at everything. You cannot change anything — saving, billing and deleting are all refused.</li>
                <li>It ends by itself after an hour.</li>
                <li>The shop can see it in their own device list, listed as vendor support.</li>
              </ul>
            </div>
          </Notice>

          <p className="text-[13px] leading-relaxed text-gray-500">
            This signs this browser into <span className="font-semibold text-gray-900">{shop?.name}</span>. If you were signed into another shop in
            this browser, that session is replaced. Your admin console stays signed in.
          </p>

          {ready && (
            <Notice tone="positive">
              <div className="text-gray-900">
                <p className="font-bold">Ready{ready.as ? ` — viewing as ${ready.as}` : ""}</p>
                <p className="mt-1 text-[13px] text-emerald-700">Expires in {ready.minutes} minutes.</p>
              </div>
            </Notice>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="font-semibold">Cancel</Button>
          {ready ? (
            <Button onClick={openShop} className="font-semibold rounded-lg">
              <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Open shop app
            </Button>
          ) : (
            <Button onClick={start} disabled={busy} className="font-semibold rounded-lg">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Start read-only session
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
