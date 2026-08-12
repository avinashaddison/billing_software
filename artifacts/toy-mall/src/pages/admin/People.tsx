import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminQueryKeys, useAdminTenantUsers } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertTriangle, Copy, Eye, EyeOff, KeyRound, Loader2, Lock, LockOpen,
  Mail, ShieldCheck, UserRound, Check, X,
} from "lucide-react";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

type Row = { kind: "user" | "staff"; id: string; label: string };

function minutesLeft(until: string | null): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 60_000));
}

export function PeopleDialog({
  tenantId, shopName, open, onOpenChange,
}: { tenantId: string | null; shopName?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useAdminTenantUsers(tenantId || "");
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [issuedPin, setIssuedPin] = useState<{ name: string; pin: string } | null>(null);
  const [pwdFor, setPwdFor] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [confirmOff, setConfirmOff] = useState<Row | null>(null);

  /* This dialog is mounted once and reused for every shop, so every bit of
   * in-progress state has to be cleared when a different shop is opened —
   * otherwise a PIN issued for one shop is still on screen for the next. */
  useEffect(() => {
    setBusy(null);
    setPinFor(null); setPinValue(""); setIssuedPin(null);
    setPwdFor(null); setPwdValue(""); setShowPwd(false);
    setConfirmOff(null);
  }, [tenantId, open]);

  const refresh = () => {
    if (tenantId) queryClient.invalidateQueries({ queryKey: adminQueryKeys.users(tenantId) });
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
  };

  /* The dialog is mounted once and reused for every shop, so a reply can
   * land after the vendor has already switched shops. Every request records
   * which shop it was for and is thrown away if that is no longer the one on
   * screen — otherwise one shop's new PIN appears under another shop's name. */
  const tenantRef = useRef(tenantId);
  useEffect(() => { tenantRef.current = tenantId; }, [tenantId]);

  const send = async (
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
    key: string,
  ): Promise<Record<string, unknown> | null> => {
    const forTenant = tenantId;
    setBusy(key);
    try {
      const r = await fetch(`${API}/platform/tenants/${forTenant}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const d = await r.json().catch(() => ({}));
      if (tenantRef.current !== forTenant) return null;
      if (!r.ok) { toast.error(d.error || "That didn't work"); return null; }
      return d;
    } catch {
      if (tenantRef.current === forTenant) toast.error("Server unreachable");
      return null;
    } finally {
      setBusy((b) => (b === key ? null : b));
    }
  };

  const setNewPin = async (staffId: string) => {
    if (pinValue && !/^\d{4}$/.test(pinValue)) { toast.error("A PIN must be exactly 4 digits"); return; }
    const d = await send("POST", `/staff/${staffId}/pin`, pinValue ? { pin: pinValue } : {}, `pin-${staffId}`);
    if (!d) return;
    setIssuedPin({ name: String(d.staffName ?? "Staff"), pin: String(d.pin) });
    setPinFor(null); setPinValue("");
    refresh();
  };

  const unlock = async (staffId: string) => {
    const d = await send("POST", `/staff/${staffId}/unlock`, {}, `unlock-${staffId}`);
    if (!d) return;
    toast.success(`${d.staffName} can sign in again`);
    refresh();
  };

  const toggle = async (row: Row, next: boolean) => {
    const path = row.kind === "staff" ? `/staff/${row.id}` : `/users/${row.id}`;
    const d = await send("PATCH", path, { isActive: next }, `toggle-${row.id}`);
    setConfirmOff(null);
    if (!d) return;
    toast.success(next ? `${row.label} can sign in again` : `${row.label} can no longer sign in`);
    refresh();
  };

  const resetPassword = async (userId: string) => {
    if (pwdValue.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const d = await send("POST", `/users/${userId}/password`, { password: pwdValue }, `pwd-${userId}`);
    if (!d) return;
    toast.success(`New password set for ${d.email}`);
    setPwdFor(null); setPwdValue(""); setShowPwd(false);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Could not copy — read it out instead"),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>People &amp; access</DialogTitle>
          <DialogDescription>
            Everyone who can sign in{shopName ? ` to ${shopName}` : ""}. You can set a new PIN or password here, but you
            cannot read the current one — they are stored scrambled, so nobody can look them up.
          </DialogDescription>
        </DialogHeader>

        {issuedPin && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              New PIN for {issuedPin.name}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] tabular-nums">{issuedPin.pin}</span>
              <Button size="sm" variant="outline" onClick={() => copy(issuedPin.pin)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIssuedPin(null)}>Done</Button>
            </div>
            <p className="mt-2 text-xs text-emerald-700/80 dark:text-emerald-400/80">
              Write it down or tell them now — once you close this, it cannot be shown again.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-destructive">Could not load this shop's people</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-primary" /> Email logins
              </h3>
              <div className="space-y-2">
                {(data?.users ?? []).map((u) => {
                  const row: Row = { kind: "user", id: u.id, label: u.email };
                  return (
                    <div key={u.id} className="rounded-xl border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{u.email}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {u.role}
                            </span>
                            {!u.isActive && (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                                Switched off
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {u.lastLoginAt ? `Last signed in ${new Date(u.lastLoginAt).toLocaleString("en-IN")}` : "Never signed in"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="sm" variant="ghost"
                            disabled={!!busy}
                            onClick={() => { setPwdFor(pwdFor === u.id ? null : u.id); setPwdValue(""); setShowPwd(false); }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Password
                          </Button>
                          <ToggleButton
                            active={u.isActive}
                            busy={busy === `toggle-${u.id}`} anyBusy={!!busy}
                            onOn={() => toggle(row, true)}
                            onOff={() => setConfirmOff(row)}
                          />
                        </div>
                      </div>

                      {pwdFor === u.id && (
                        <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
                          <label className="text-xs font-medium">New password for {u.email}</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showPwd ? "text" : "password"}
                                value={pwdValue}
                                onChange={(e) => setPwdValue(e.target.value)}
                                placeholder="At least 8 characters"
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPwd((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={showPwd ? "Hide password" : "Show password"}
                              >
                                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <Button size="sm" onClick={() => resetPassword(u.id)} disabled={!!busy || pwdValue.length < 8}>
                              {busy === `pwd-${u.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setPwdFor(null); setPwdValue(""); }}>Cancel</Button>
                          </div>
                          <p className="text-xs text-muted-foreground">They will need this to sign in — tell them straight away.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(data?.users ?? []).length === 0 && (
                  <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                    This shop has no email logins
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <UserRound className="h-4 w-4 text-primary" /> Staff (sign in with a 4-digit PIN)
              </h3>
              <div className="space-y-2">
                {(data?.staff ?? []).map((s) => {
                  const row: Row = { kind: "staff", id: s.id, label: s.name };
                  const locked = minutesLeft(s.lockedUntil);
                  return (
                    <div key={s.id} className="rounded-xl border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{s.name}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {s.role}
                            </span>
                            {!s.isActive && (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                                Switched off
                              </span>
                            )}
                            {locked > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                <Lock className="h-3 w-3" /> Locked {locked}m
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {locked > 0
                              ? `Too many wrong PINs — cannot sign in for ${locked} more minute${locked === 1 ? "" : "s"}`
                              : s.failedAttempts > 0
                                ? `${s.failedAttempts} wrong PIN ${s.failedAttempts === 1 ? "try" : "tries"} so far`
                                : "No sign-in problems"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {locked > 0 && (
                            <Button size="sm" variant="outline" onClick={() => unlock(s.id)} disabled={!!busy}>
                              {busy === `unlock-${s.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockOpen className="mr-2 h-4 w-4" />}
                              Unlock
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            disabled={!!busy}
                            onClick={() => { setPinFor(pinFor === s.id ? null : s.id); setPinValue(""); }}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" /> New PIN
                          </Button>
                          <ToggleButton
                            active={s.isActive}
                            busy={busy === `toggle-${s.id}`} anyBusy={!!busy}
                            onOn={() => toggle(row, true)}
                            onOff={() => setConfirmOff(row)}
                          />
                        </div>
                      </div>

                      {pinFor === s.id && (
                        <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
                          <label className="text-xs font-medium">Choose a PIN for {s.name}, or leave it blank for a random one</label>
                          <div className="flex gap-2">
                            <Input
                              inputMode="numeric"
                              maxLength={4}
                              value={pinValue}
                              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                              placeholder="4 digits"
                              className="w-32 font-mono tracking-[0.3em]"
                            />
                            <Button size="sm" onClick={() => setNewPin(s.id)} disabled={!!busy}>
                              {busy === `pin-${s.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : pinValue ? "Set this PIN" : "Generate one"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setPinFor(null); setPinValue(""); }}>Cancel</Button>
                          </div>
                          <p className="text-xs text-muted-foreground">This also clears any lockout. Their old PIN stops working immediately.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(data?.staff ?? []).length === 0 && (
                  <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">
                    This shop has no staff accounts
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {confirmOff && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">
              Stop {confirmOff.label} from signing in?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              They will be refused at the login screen until you switch them back on. Nothing they have already recorded is deleted.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => toggle(confirmOff, false)} disabled={!!busy}>
                {busy === `toggle-${confirmOff.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Yes, switch off
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmOff(null)}>
                <X className="mr-2 h-4 w-4" /> Keep access
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ToggleButton({
  active, busy, anyBusy, onOn, onOff,
}: { active: boolean; busy: boolean; anyBusy: boolean; onOn: () => void; onOff: () => void }) {
  return (
    <Button
      size="sm"
      variant={active ? "ghost" : "outline"}
      className={active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-emerald-600"}
      onClick={active ? onOff : onOn}
      disabled={anyBusy}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? "Switch off" : "Switch on"}
    </Button>
  );
}
