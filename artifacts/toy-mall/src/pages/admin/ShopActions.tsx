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
import { Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "./api";
import { ACCESS_PRESETS, AccessKey, OverviewData } from "./types";

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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {suspending ? `Suspend ${shop?.name}?` : `Reactivate ${shop?.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {suspending
              ? "Everyone at this shop will be locked out at their next sign-in and cannot bill until you reactivate them. Their data is left untouched."
              : "Staff and owners at this shop will be able to sign in and bill again straight away."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {suspending && shop?.activity === "trading" && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This shop is actively trading — it last billed {shop.lastSaleAt ? new Date(shop.lastSaleAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "recently"}.</span>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant={suspending ? "destructive" : "default"} disabled={busy} onClick={run}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Reset owner password</DialogTitle>
            <DialogDescription>
              Sets a new sign-in password for the owner of {shop?.name}
              {shop?.ownerEmail ? ` (${shop.ownerEmail})` : ""}. Their current password stops working immediately, so make sure you can pass this on to them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-5">
            <div className="space-y-2">
              <Label htmlFor="new-owner-pwd">New password</Label>
              <div className="relative">
                <Input
                  id="new-owner-pwd"
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {tooShort && <p className="text-xs text-destructive">Use at least 8 characters.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-owner-pwd">Confirm password</Label>
              <Input
                id="confirm-owner-pwd"
                type={show ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Type it again"
                autoComplete="new-password"
              />
              {mismatch && <p className="text-xs text-destructive">The two passwords do not match.</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={!valid || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action ? VERB[action] : ""} {count} {count === 1 ? "shop" : "shops"}?
          </DialogTitle>
          <DialogDescription>
            {action === "suspend" && "Everyone at these shops will be locked out at their next sign-in and cannot bill until you reactivate them. Their data is left untouched."}
            {action === "activate" && "These shops will be able to sign in and bill again straight away."}
            {action === "extend" && "Adds the same amount of time to every selected shop, counted from whichever is later: today or their current expiry."}
          </DialogDescription>
        </DialogHeader>

        {failures ? (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">These shops were not changed:</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {failures.map((f) => (
                <div key={f.id} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <p className="font-medium">{nameOf(f.id)}</p>
                  <p className="text-xs text-muted-foreground">{f.error || "Unknown error"}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {action === "extend" && (
              <div className="space-y-2">
                <Label>Add</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as AccessKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCESS_PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action === "suspend" && trading.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {trading.length === 1
                    ? `${trading[0].name} is actively trading.`
                    : `${trading.length} of these shops are actively trading.`}
                </span>
              </div>
            )}

            <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-3">
              <ul className="space-y-1 text-sm">
                {shops.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          {failures ? (
            <Button onClick={() => { onDone(); onOpenChange(false); }}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button
                variant={action === "suspend" ? "destructive" : "default"}
                onClick={run}
                disabled={busy || count === 0}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {action ? VERB[action] : ""} {count}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
