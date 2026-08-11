import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCESS_PRESETS, AccessKey, OverviewData } from "./types";
import { toast } from "sonner";
import { AlertTriangle, Loader2, CheckCircle2, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys, useAdminTenantUsers } from "./api";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function CreateTenantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [duration, setDuration] = useState<AccessKey>("3d");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const queryClient = useQueryClient();

  const onNameChange = (val: string) => {
    setName(val);
    if (!idTouched) setId(slugify(val));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim().toLowerCase(),
          name: name.trim(),
          ownerEmail: email.trim(),
          ownerPassword: password,
          expiresAt: duration,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(data.error || "Could not create tenant"); return; }
      
      setCreated({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        pin: typeof data?.staff?.pin === "string" ? data.staff.pin : null,
      });
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <Dialog open={open} onOpenChange={() => { setCreated(null); onOpenChange(false); }}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl">Shop Created</DialogTitle>
            <DialogDescription>Share these credentials securely with the client.</DialogDescription>
            
            <div className="w-full bg-muted rounded-xl p-4 space-y-3 text-left">
              <div><p className="text-xs text-muted-foreground">Shop Name</p><p className="font-semibold">{created.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Owner Email</p><p className="font-mono">{created.email}</p></div>
              <div><p className="text-xs text-muted-foreground">Password</p><p className="font-mono">{created.password}</p></div>
              {created.pin && <div><p className="text-xs text-muted-foreground">Staff PIN</p><p className="font-mono text-lg tracking-widest">{created.pin}</p></div>}
            </div>
            <Button className="w-full" onClick={() => { setCreated(null); onOpenChange(false); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New Shop</DialogTitle>
            <DialogDescription>Create a new tenant workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input required autoFocus value={name} onChange={e => onNameChange(e.target.value)} placeholder="Hira & Sons" />
            </div>
            <div className="space-y-2">
              <Label>URL Slug / ID</Label>
              <Input required value={id} onChange={e => { setId(e.target.value); setIdTouched(true); }} placeholder="hira-sons" />
            </div>
            <div className="space-y-2">
              <Label>Owner Email</Label>
              <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@shop.com" />
            </div>
            <div className="space-y-2">
              <Label>Owner Password</Label>
              <Input required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars" minLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Access Duration</Label>
              <Select value={duration} onValueChange={(v: AccessKey) => setDuration(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_PRESETS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !name || !id || !email || password.length < 8}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Shop
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditTenantDialog({ tenant, open, onOpenChange }: { tenant: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  /* This dialog is mounted once and reused for every shop, so the useState
   * initialisers above run against a null tenant and never again. Without
   * this re-seed the form opens blank, and worse, text typed for one shop is
   * still sitting there when the next shop is opened. */
  useEffect(() => {
    if (open && tenant) {
      setName(tenant.name || "");
      setEmail(tenant.ownerEmail || "");
    }
  }, [open, tenant?.id, tenant?.name, tenant?.ownerEmail]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    const body: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== tenant.name) body.name = name.trim();
    if (email.trim().toLowerCase() !== (tenant.ownerEmail || "").toLowerCase()) body.ownerEmail = email.trim();
    if (Object.keys(body).length === 0) { toast.info("No changes"); onOpenChange(false); return; }
    
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${tenant.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Could not save"); return;
      }
      toast.success("Shop updated");
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
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
            <DialogTitle>Edit Shop Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input required autoFocus value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owner Email</Label>
              <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExtendTenantDialog({ tenant, open, onOpenChange }: { tenant: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [duration, setDuration] = useState<AccessKey>("30d");

  /* Same reuse problem as the edit dialog: without this, the duration picked
   * for the last shop is pre-selected for the next one. */
  useEffect(() => {
    if (open) setDuration("30d");
  }, [open, tenant?.id]);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${tenant.id}/extend`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Could not extend"); return;
      }
      toast.success(`Extended access by ${ACCESS_PRESETS.find(p => p.key === duration)?.label}`);
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.overview });
      onOpenChange(false);
    } catch {
      toast.error("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Extend Access</DialogTitle>
            <DialogDescription>Add time to {tenant?.name}'s subscription.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Select value={duration} onValueChange={(v: AccessKey) => setDuration(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCESS_PRESETS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>Extend</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ViewUsersDialog({ tenantId, open, onOpenChange }: { tenantId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useAdminTenantUsers(tenantId || "");
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Logins & Staff</DialogTitle>
          <DialogDescription>Users with access to this shop.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-destructive">Could not load this shop's logins</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Owner & Admin Logins (Email)</h3>
              <div className="space-y-2">
                {data?.users?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-semibold text-sm">{u.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {u.isActive ? "Active" : "Off"}
                    </span>
                  </div>
                ))}
                {!data?.users?.length && <p className="text-sm text-muted-foreground">No users found.</p>}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-3">Staff Accounts (PIN)</h3>
              <div className="space-y-2">
                {data?.staff?.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-widest">{s.role}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {s.isActive ? "Active" : "Off"}
                    </span>
                  </div>
                ))}
                {!data?.staff?.length && <p className="text-sm text-muted-foreground">No staff found.</p>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
