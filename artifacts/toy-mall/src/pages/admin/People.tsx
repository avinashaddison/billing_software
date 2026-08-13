import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminQueryKeys, useAdminTenantUsers } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { SectionLabel, Panel, Rows, Tag, Notice, LoadError, EmptyState, PanelSkeleton, formatDateTime } from "./ui";
import { Skeleton } from "@/components/ui/skeleton";

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
  const queryClient = useQueryClient();
  const query = useAdminTenantUsers(tenantId || "");
  const { data, isLoading, error } = query;

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
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl rounded-2xl bg-[#F9F9FB] border-gray-100 shadow-xl">
        <DialogHeader className="px-6 py-5 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <DialogTitle className="text-[22px] font-bold leading-tight tracking-tight text-gray-900">People &amp; access</DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] font-medium leading-relaxed text-gray-500">
            Everyone who can sign in{shopName ? ` to ` : ""}{shopName && <span className="font-semibold text-gray-700">{shopName}</span>}. You can set a new PIN or password here, but you
            cannot read the current one.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {issuedPin && (
            <div className="mb-8">
              <Notice tone="positive">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-emerald-900">New PIN for {issuedPin.name}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <span className="font-mono text-[28px] font-bold tracking-[0.2em] tabular-nums leading-none text-emerald-950 bg-white/50 px-3 py-2 rounded-lg border border-emerald-200/50 shadow-sm">{issuedPin.pin}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-9 px-4 text-[13px] font-semibold border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 hover:border-emerald-300 shadow-sm transition-colors" onClick={() => copy(issuedPin.pin)}>Copy</Button>
                      <Button size="sm" variant="ghost" className="h-9 px-4 text-[13px] font-medium text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition-colors" onClick={() => setIssuedPin(null)}>Done</Button>
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] font-medium text-emerald-700/80">Write it down or tell them now — once you close this, it cannot be shown again.</p>
                </div>
              </Notice>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-10">
              <div>
                <Skeleton className="h-5 w-32 mb-4" />
                <PanelSkeleton rows={2} header={false} />
              </div>
              <div>
                <Skeleton className="h-5 w-32 mb-4" />
                <PanelSkeleton rows={3} header={false} />
              </div>
            </div>
          ) : error ? (
            <LoadError message={(error as Error).message} onRetry={refresh} />
          ) : (
            <div className="space-y-10">
              <div>
                <SectionLabel>Email logins</SectionLabel>
                <Panel>
                  {(data?.users ?? []).length === 0 ? (
                    <EmptyState title="No email logins" hint="This shop has no owner or admin accounts with email access." />
                  ) : (
                    <Rows>
                      {(data?.users ?? []).map((u) => {
                        const row: RowDef = { kind: "user", id: u.id, label: u.email };
                        return (
                          <div key={u.id} className="p-5 transition-colors hover:bg-gray-50/50">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <p className="text-[14px] font-bold text-gray-900 truncate max-w-[200px]" title={u.email}>{u.email}</p>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{u.role}</span>
                                  {!u.isActive && <Tag tone="danger">Off</Tag>}
                                </div>
                                <p className="mt-1 text-[12px] font-medium text-gray-500">
                                  {u.lastLoginAt ? `Last in ${formatDateTime(u.lastLoginAt)}` : "Never signed in"}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  size="sm" variant="outline" className="h-8 text-[12px] font-medium bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200 transition-colors"
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
                              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                <label className="text-[12px] font-semibold text-gray-700">New password for {u.email}</label>
                                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                                  <Input
                                    type={showPwd ? "text" : "password"}
                                    value={pwdValue}
                                    onChange={(e) => setPwdValue(e.target.value)}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    className="h-9 text-[13px] w-full max-w-[240px] bg-white border-gray-200 focus-visible:ring-violet-500 shadow-sm"
                                  />
                                  <Button size="sm" variant="outline" className="h-9 px-3 text-[12px] font-medium bg-white border-gray-200 text-gray-600 hover:text-gray-900 transition-colors" onClick={() => setShowPwd((v) => !v)}>
                                    {showPwd ? "Hide" : "Show"}
                                  </Button>
                                  <Button size="sm" className="h-9 px-4 text-[12px] bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm transition-colors" onClick={() => resetPassword(u.id)} disabled={!!busy || pwdValue.length < 8}>
                                    {busy === `pwd-${u.id}` ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : "Set password"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[12px] font-medium text-gray-500 hover:text-gray-900 transition-colors" onClick={() => { setPwdFor(null); setPwdValue(""); }}>Cancel</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Rows>
                  )}
                </Panel>
              </div>

              <div>
                <SectionLabel>Staff (PIN)</SectionLabel>
                <Panel>
                  {(data?.staff ?? []).length === 0 ? (
                    <EmptyState title="No staff accounts" hint="This shop has no staff members using PINs." />
                  ) : (
                    <Rows>
                      {(data?.staff ?? []).map((s) => {
                        const row: RowDef = { kind: "staff", id: s.id, label: s.name };
                        const locked = minutesLeft(s.lockedUntil);
                        return (
                          <div key={s.id} className="p-5 transition-colors hover:bg-gray-50/50">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <p className="text-[14px] font-bold text-gray-900 truncate max-w-[200px]" title={s.name}>{s.name}</p>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.role}</span>
                                  {!s.isActive && <Tag tone="danger">Off</Tag>}
                                  {locked > 0 && <Tag tone="warn">Locked {locked}m</Tag>}
                                </div>
                                <p className="mt-1 text-[12px] font-medium text-gray-500">
                                  {locked > 0
                                    ? `Too many wrong PINs — blocked for ${locked}m`
                                    : s.failedAttempts > 0
                                      ? `${s.failedAttempts} wrong PIN ${s.failedAttempts === 1 ? "try" : "tries"} so far`
                                      : "No sign-in problems"}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {locked > 0 && (
                                  <Button size="sm" variant="outline" className="h-8 text-[12px] font-medium border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 transition-colors" onClick={() => unlock(s.id)} disabled={!!busy}>
                                    {busy === `unlock-${s.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : null}
                                    Unlock
                                  </Button>
                                )}
                                <Button
                                  size="sm" variant="outline" className="h-8 text-[12px] font-medium bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200 transition-colors"
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
                              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                <label className="text-[12px] font-semibold text-gray-700">New PIN for {s.name}</label>
                                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                                  <Input
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={pinValue}
                                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="4 digits"
                                    className="h-9 w-28 bg-white border-gray-200 font-mono font-bold tracking-[0.25em] text-[15px] text-center focus-visible:ring-violet-500 shadow-sm"
                                  />
                                  <Button size="sm" className="h-9 px-4 text-[12px] bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm transition-colors" onClick={() => setNewPin(s.id)} disabled={!!busy}>
                                    {busy === `pin-${s.id}` ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : pinValue ? "Set this PIN" : "Generate random"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-9 px-3 text-[12px] font-medium text-gray-500 hover:text-gray-900 transition-colors" onClick={() => { setPinFor(null); setPinValue(""); }}>Cancel</Button>
                                </div>
                                <p className="mt-2.5 text-[11px] font-medium text-gray-400">Clears any lockout. Old PIN stops working immediately.</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Rows>
                  )}
                </Panel>
              </div>
            </div>
          )}

          {confirmOff && (
            <div className="mt-8">
              <Notice tone="warn">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-amber-900">Stop {confirmOff.label} from signing in?</p>
                  <p className="mt-1 text-[12px] font-medium text-amber-700/80">They will be refused at the login screen until switched back on. Data is not deleted.</p>
                  <div className="mt-3.5 flex items-center gap-2.5">
                    <Button size="sm" className="h-9 px-4 text-[13px] font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm transition-colors" onClick={() => toggle(confirmOff, false)} disabled={!!busy}>
                      {busy === `toggle-${confirmOff.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={2} /> : null}
                      Yes, switch off
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 px-4 text-[13px] font-medium text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors" onClick={() => setConfirmOff(null)}>Cancel</Button>
                  </div>
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
      variant="outline"
      className={`h-8 text-[12px] font-medium transition-colors ${
        active 
          ? "border-red-200 text-red-600 bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-700" 
          : "border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
      }`}
      onClick={active ? onOff : onOn}
      disabled={anyBusy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : active ? "Switch off" : "Switch on"}
    </Button>
  );
}
