import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminQueryKeys, useAdminTenantUsers } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { SectionLabel, Panel, Rows, Tag, Notice, LoadError } from "./ui";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

type RowDef = { kind: "user" | "staff"; id: string; label: string };

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
  const [confirmOff, setConfirmOff] = useState<RowDef | null>(null);

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

  const toggle = async (row: RowDef, next: boolean) => {
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl rounded-lg">
        <DialogHeader className="px-6 py-5 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-[22px] font-medium leading-tight tracking-tight text-foreground">People &amp; access</DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] text-muted-foreground">
            Everyone who can sign in{shopName ? ` to ${shopName}` : ""}. You can set a new PIN or password here, but you
            cannot read the current one.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {issuedPin && (
            <div className="mb-8">
              <Notice tone="positive">
                <p className="text-[13px] font-medium text-foreground">New PIN for {issuedPin.name}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <span className="font-mono text-[26px] font-medium tracking-[0.2em] tabular-nums leading-none text-foreground">{issuedPin.pin}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copy(issuedPin.pin)}>Copy</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIssuedPin(null)}>Done</Button>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-muted-foreground">Write it down or tell them now — once you close this, it cannot be shown again.</p>
              </Notice>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} /></div>
          ) : error ? (
            <LoadError message={(error as Error).message} />
          ) : (
            <div className="space-y-8">
              <div>
                <SectionLabel>Email logins</SectionLabel>
                <Panel>
                  <Rows>
                    {(data?.users ?? []).map((u) => {
                      const row: RowDef = { kind: "user", id: u.id, label: u.email };
                      return (
                        <div key={u.id} className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate">{u.email}</p>
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{u.role}</span>
                                {!u.isActive && <Tag tone="danger">Off</Tag>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {u.lastLoginAt ? `Last in ${new Date(u.lastLoginAt).toLocaleString("en-IN")}` : "Never signed in"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs"
                                disabled={!!busy}
                                onClick={() => { setPwdFor(pwdFor === u.id ? null : u.id); setPwdValue(""); setShowPwd(false); }}
                              >
                                Password
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
                            <div className="mt-4 rounded-md bg-muted/40 p-3">
                              <label className="text-xs font-medium text-foreground">New password for {u.email}</label>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Input
                                  type={showPwd ? "text" : "password"}
                                  value={pwdValue}
                                  onChange={(e) => setPwdValue(e.target.value)}
                                  placeholder="At least 8 characters"
                                  autoComplete="new-password"
                                  className="h-8 text-[13px] w-full max-w-[200px]"
                                />
                                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => setShowPwd((v) => !v)}>
                                  {showPwd ? "Hide" : "Show"}
                                </Button>
                                <Button size="sm" className="h-8 text-xs" onClick={() => resetPassword(u.id)} disabled={!!busy || pwdValue.length < 8}>
                                  {busy === `pwd-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} /> : "Set"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setPwdFor(null); setPwdValue(""); }}>Cancel</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(data?.users ?? []).length === 0 && (
                      <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">This shop has no email logins</div>
                    )}
                  </Rows>
                </Panel>
              </div>

              <div>
                <SectionLabel>Staff (PIN)</SectionLabel>
                <Panel>
                  <Rows>
                    {(data?.staff ?? []).map((s) => {
                      const row: RowDef = { kind: "staff", id: s.id, label: s.name };
                      const locked = minutesLeft(s.lockedUntil);
                      return (
                        <div key={s.id} className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.role}</span>
                                {!s.isActive && <Tag tone="danger">Off</Tag>}
                                {locked > 0 && <Tag tone="warn">Locked {locked}m</Tag>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {locked > 0
                                  ? `Too many wrong PINs — blocked for ${locked}m`
                                  : s.failedAttempts > 0
                                    ? `${s.failedAttempts} wrong PIN ${s.failedAttempts === 1 ? "try" : "tries"} so far`
                                    : "No sign-in problems"}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              {locked > 0 && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => unlock(s.id)} disabled={!!busy}>
                                  {busy === `unlock-${s.id}` ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" strokeWidth={1.75} /> : null}
                                  Unlock
                                </Button>
                              )}
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs"
                                disabled={!!busy}
                                onClick={() => { setPinFor(pinFor === s.id ? null : s.id); setPinValue(""); }}
                              >
                                New PIN
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
                            <div className="mt-4 rounded-md bg-muted/40 p-3">
                              <label className="text-xs font-medium text-foreground">New PIN for {s.name}</label>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Input
                                  inputMode="numeric"
                                  maxLength={4}
                                  value={pinValue}
                                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                  placeholder="4 digits"
                                  className="h-8 w-24 font-mono tracking-[0.2em] text-[13px]"
                                />
                                <Button size="sm" className="h-8 text-xs" onClick={() => setNewPin(s.id)} disabled={!!busy}>
                                  {busy === `pin-${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} /> : pinValue ? "Set this PIN" : "Generate random"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setPinFor(null); setPinValue(""); }}>Cancel</Button>
                              </div>
                              <p className="mt-2 text-[11px] text-muted-foreground">Clears any lockout. Old PIN stops working immediately.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(data?.staff ?? []).length === 0 && (
                      <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">This shop has no staff accounts</div>
                    )}
                  </Rows>
                </Panel>
              </div>
            </div>
          )}

          {confirmOff && (
            <div className="mt-8">
              <Notice tone="warn">
                <p className="text-[13px] font-medium text-foreground">Stop {confirmOff.label} from signing in?</p>
                <p className="mt-1 text-xs text-muted-foreground">They will be refused at the login screen until switched back on. Data is not deleted.</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => toggle(confirmOff, false)} disabled={!!busy}>
                    {busy === `toggle-${confirmOff.id}` ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" strokeWidth={1.75} /> : null}
                    Yes, switch off
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmOff(null)}>Cancel</Button>
                </div>
              </Notice>
            </div>
          )}
        </div>
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
      variant="ghost"
      className={`h-7 text-xs ${active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"}`}
      onClick={active ? onOff : onOn}
      disabled={anyBusy}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} /> : active ? "Switch off" : "Switch on"}
    </Button>
  );
}
