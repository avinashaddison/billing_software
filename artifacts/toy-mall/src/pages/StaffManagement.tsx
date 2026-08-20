import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Shield, User, Key, ChevronDown, ChevronUp,
  Check, X, Loader2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RESOURCES, type AccessLevel, type ResourceKey, DEFAULT_STAFF_PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const api = (path: string) => `${BASE_URL}/api/${path}`;

interface StaffMember {
  id: string; name: string; role: string; isActive: boolean; createdAt: string;
}

type PermissionMap = Record<string, AccessLevel>;

const LEVEL_LABELS: Record<AccessLevel, { label: string; color: string }> = {
  none:  { label: "No Access", color: "bg-muted text-muted-foreground" },
  read:  { label: "Read Only", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  write: { label: "Full Access", color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
};

/* ── Staff form modal ────────────────────────────────────────────── */
function StaffFormModal({ open, initial, onClose, onSave }: {
  open: boolean; initial?: StaffMember; onClose: () => void;
  onSave: (data: { name: string; pin: string; role: string }) => Promise<void>;
}) {
  const [name, setName]     = useState(initial?.name ?? "");
  const [pin, setPin]       = useState("");
  const [role, setRole]     = useState(initial?.role ?? "staff");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) { toast.error("Name must be at least 2 characters"); return; }
    if (!initial && (!/^\d{4}$/.test(pin))) { toast.error("PIN must be exactly 4 digits"); return; }
    if (pin && !/^\d{4}$/.test(pin)) { toast.error("PIN must be exactly 4 digits"); return; }
    setSaving(true);
    try { await onSave({ name: name.trim(), pin, role }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input placeholder="e.g. Ravi Kumar" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{initial ? "New PIN (leave blank to keep)" : "4-Digit PIN *"}</Label>
            <Input
              type="password" inputMode="numeric" maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <p className="text-xs text-muted-foreground">Staff use this PIN to log in to the app</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["staff", "owner"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${role === r ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                  {r === "owner" ? <Shield className="w-4 h-4 text-amber-500" /> : <User className="w-4 h-4 text-blue-500" />}
                  <div className="text-left">
                    <p className="font-bold text-sm capitalize">{r === "owner" ? "Owner" : "Staff"}</p>
                    <p className="text-[10px] text-muted-foreground">{r === "owner" ? "All access" : "Custom access"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : (initial ? "Update" : "Add Staff")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Permission editor ───────────────────────────────────────────── */
function PermissionEditor({ staffId, staffName, onClose }: { staffId: string; staffName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [perms, setPerms] = useState<PermissionMap>({});
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery<PermissionMap>({
    queryKey: ["staff-perms", staffId],
    retry: 1,
    queryFn: async () => {
      const r = await fetch(api(`staff/${staffId}/permissions`));
      // Never enable Save with fabricated defaults on a failed/non-JSON
      // response — that could silently overwrite this member's real
      // permissions. Throw instead so the dialog shows an error and Save stays
      // disabled (gated on `loaded`) until the real permissions load.
      if (!r.ok) throw new Error("Failed to load permissions");
      const raw = await r.json().catch(() => null);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Malformed permissions response");
      }
      const merged = { ...DEFAULT_STAFF_PERMISSIONS, ...raw } as PermissionMap;
      setPerms(merged);
      setLoaded(true);
      return merged;
    },
  });

  const setLevel = (resource: ResourceKey, level: AccessLevel) =>
    setPerms((p) => ({ ...p, [resource]: level }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(api(`staff/${staffId}/permissions`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!r.ok) throw new Error("Failed");
      toast.success(`Permissions updated for ${staffName}`);
      qc.invalidateQueries({ queryKey: ["staff-perms", staffId] });
      onClose();
    } catch { toast.error("Failed to save permissions"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Permissions — {staffName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Control what this staff member can see and do
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !loaded ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm font-bold">Couldn't load permissions</p>
            <p className="text-xs text-muted-foreground px-6">
              Please close and reopen this dialog to try again. Saving is disabled
              until the current permissions load.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 py-2">
            {RESOURCES.filter((r) => r.key !== "staff").map((res) => {
              const current = (perms[res.key] ?? "none") as AccessLevel;
              const levels: readonly AccessLevel[] =
                res.key === "productReports" ? ["none", "read"] : ["none", "read", "write"];
              return (
                <div key={res.key} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-sm">{res.label}</p>
                      <p className="text-xs text-muted-foreground">{res.description}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${LEVEL_LABELS[current].color}`}>
                      {LEVEL_LABELS[current].label}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {levels.map((level) => (
                      <button
                        key={level}
                        onClick={() => setLevel(res.key as ResourceKey, level)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          current === level
                            ? level === "none"  ? "bg-muted border-muted-foreground/30 text-foreground"
                            : level === "read"  ? "bg-blue-500 border-blue-500 text-white"
                            :                     "bg-green-500 border-green-500 text-white"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {level === "none" ? "None" : level === "read" ? "Read" : "Write"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Staff management (special) */}
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-bold text-sm">Staff Management</p>
                  <p className="text-xs text-muted-foreground">Manage staff accounts & permissions</p>
                </div>
                <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">Owner Only</span>
              </div>
              <p className="text-xs text-muted-foreground italic">Only owners can manage staff. This cannot be granted to regular staff.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !loaded}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Check className="w-4 h-4 mr-1.5" /> Save Permissions</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function StaffManagement() {
  const qc = useQueryClient();
  const { staffId: myId } = useAuth();
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<StaffMember | null>(null);
  const [delTarget, setDelTarget] = useState<StaffMember | null>(null);
  const [permTarget, setPermTarget] = useState<StaffMember | null>(null);

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: async () => { const r = await fetch(api("staff")); return r.json(); },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["staff"] });

  const createMut = useMutation({
    mutationFn: async (data: { name: string; pin: string; role: string }) => {
      const r = await fetch(api("staff"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => { toast.success("Staff member added"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; pin: string; role: string }) => {
      const body: Record<string, unknown> = { name: data.name, role: data.role };
      if (data.pin) body.pin = data.pin;
      const r = await fetch(api(`staff/${id}`), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => { toast.success("Staff member updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const r = await fetch(api(`staff/${id}`), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => { invalidate(); },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(api(`staff/${id}`), { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast.success("Staff member removed"); invalidate(); setDelTarget(null); },
    onError: () => { toast.error("Failed to delete"); setDelTarget(null); },
  });

  const owners = staff.filter((s) => s.role === "owner");
  const members = staff.filter((s) => s.role !== "owner");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Staff Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {staff.length} member{staff.length !== 1 ? "s" : ""} · Control who can access what
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
          <Plus size={16} /> Add Staff
        </Button>
      </div>

      {/* Owners */}
      {owners.length > 0 && (
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-500" /> Owners — Full Access
          </p>
          <div className="space-y-2">
            {owners.map((s) => (
              <div key={s.id} className="rounded-2xl border bg-gradient-to-r from-amber-50 to-card dark:from-amber-950/20 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-lg font-black text-amber-700 dark:text-amber-300">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{s.name}</p>
                    {s.id === myId && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">You</span>}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3 h-3 text-amber-500" /> Owner · All permissions
                  </p>
                </div>
                <button onClick={() => { setEditing(s); setFormOpen(true); }}
                  className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors">
                  <Pencil size={14} className="text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Staff */}
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Staff Members
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 flex flex-col items-center py-12 text-center gap-2">
            <Users size={32} className="text-muted-foreground/40" />
            <p className="font-bold text-muted-foreground">No staff members yet</p>
            <p className="text-sm text-muted-foreground/70">Add staff to control who can access the system</p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-2 gap-1.5">
              <Plus size={14} /> Add First Staff Member
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((s) => (
              <div key={s.id} className={`rounded-2xl border bg-card p-4 transition-all ${!s.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${s.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground">{s.name}</p>
                      {!s.isActive && <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">Inactive</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Staff · PIN login required</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setPermTarget(s)}
                      title="Edit permissions"
                      className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 flex items-center justify-center transition-colors">
                      <Key size={14} className="text-blue-600 dark:text-blue-400" />
                    </button>
                    <button
                      onClick={() => { setEditing(s); setFormOpen(true); }}
                      title="Edit"
                      className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors">
                      <Pencil size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => toggleActiveMut.mutate({ id: s.id, isActive: !s.isActive })}
                      title={s.isActive ? "Deactivate" : "Activate"}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${s.isActive ? "bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 text-amber-600" : "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 text-green-600"}`}>
                      {s.isActive ? <X size={14} /> : <Check size={14} />}
                    </button>
                    {s.id !== myId && (
                      <button
                        onClick={() => setDelTarget(s)}
                        title="Remove"
                        className="w-8 h-8 rounded-lg bg-muted hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors text-muted-foreground hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Permission guide */}
      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <p className="font-bold text-sm">Access Level Guide</p>
        {(["none", "read", "write"] as const).map((level) => (
          <div key={level} className="flex items-center gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-20 text-center ${LEVEL_LABELS[level].color}`}>
              {LEVEL_LABELS[level].label}
            </span>
            <span className="text-muted-foreground">
              {level === "none"  && "Menu is hidden — staff cannot visit this page"}
              {level === "read"  && "Staff can view data but not create, edit, or delete"}
              {level === "write" && "Full access — view, create, edit, and delete"}
            </span>
          </div>
        ))}
      </div>

      {/* Create/Edit form */}
      {formOpen && (
        <StaffFormModal
          open={formOpen}
          initial={editing ?? undefined}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={async (data) => {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, ...data });
            } else {
              await createMut.mutateAsync(data);
            }
          }}
        />
      )}

      {/* Permission editor */}
      {permTarget && (
        <PermissionEditor
          staffId={permTarget.id}
          staffName={permTarget.name}
          onClose={() => setPermTarget(null)}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{delTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the staff member and all their permissions. They will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => delTarget && deleteMut.mutate(delTarget.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
