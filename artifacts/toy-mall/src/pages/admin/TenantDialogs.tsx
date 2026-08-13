import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCESS_PRESETS, type AccessKey } from "./types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "./api";
import { Rows, Row, Notice } from "./ui";

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
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-gray-900">Shop created</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              Share these credentials securely with the client. The password will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50 shadow-sm">
              <Rows>
                <Row label="Shop name" value={<span className="font-bold text-gray-900">{created.name}</span>} />
                <Row label="Owner email" value={<span className="font-mono text-gray-600 break-all select-all">{created.email}</span>} />
                <Row label="Password" value={<span className="font-mono font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded select-all">{created.password}</span>} />
                {created.pin && <Row label="Staff PIN" value={<span className="font-mono font-bold text-gray-900 tracking-widest bg-gray-200 px-2 py-0.5 rounded select-all">{created.pin}</span>} />}
              </Rows>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto font-semibold rounded-lg" onClick={() => { setCreated(null); onOpenChange(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-gray-900">New shop</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">Create a new tenant workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-5">
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Shop name</Label>
              <Input required autoFocus value={name} onChange={e => onNameChange(e.target.value)} placeholder="Hira & Sons" className="rounded-lg focus-visible:ring-violet-500/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">URL slug / ID</Label>
              <Input required value={id} onChange={e => { setId(e.target.value); setIdTouched(true); }} placeholder="hira-sons" className="rounded-lg focus-visible:ring-violet-500/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Owner email</Label>
              <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@shop.com" className="rounded-lg focus-visible:ring-violet-500/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Owner password</Label>
              <Input required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars" minLength={8} className="rounded-lg focus-visible:ring-violet-500/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Access duration</Label>
              <Select value={duration} onValueChange={(v: AccessKey) => setDuration(v)}>
                <SelectTrigger className="rounded-lg focus-visible:ring-violet-500/40"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {ACCESS_PRESETS.map(p => <SelectItem key={p.key} value={p.key} className="rounded-lg">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="font-semibold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="font-semibold rounded-lg" disabled={busy || !name || !id || !email || password.length < 8}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
              Create shop
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
  const [maxStaff, setMaxStaff] = useState("");
  const [maxProducts, setMaxProducts] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && tenant) {
      setName(tenant.name || "");
      setEmail(tenant.ownerEmail || "");
      setMaxStaff(tenant.maxStaff == null ? "" : String(tenant.maxStaff));
      setMaxProducts(tenant.maxProducts == null ? "" : String(tenant.maxProducts));
    }
  }, [open, tenant?.id, tenant?.name, tenant?.ownerEmail, tenant?.maxStaff, tenant?.maxProducts]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    const body: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== tenant.name) body.name = name.trim();
    if (email.trim().toLowerCase() !== (tenant.ownerEmail || "").toLowerCase()) body.ownerEmail = email.trim();

    const capChanged = (typed: string, current: number | null | undefined) =>
      (typed.trim() === "" ? null : Number(typed)) !== (current ?? null);
    if (capChanged(maxStaff, tenant.maxStaff)) body.maxStaff = maxStaff.trim() === "" ? null : Number(maxStaff);
    if (capChanged(maxProducts, tenant.maxProducts)) body.maxProducts = maxProducts.trim() === "" ? null : Number(maxProducts);
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
      <DialogContent className="sm:max-w-md sm:rounded-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-gray-900">Edit shop info</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Shop name</Label>
              <Input required autoFocus value={name} onChange={e => setName(e.target.value)} className="rounded-lg focus-visible:ring-violet-500/40" />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Staff limit</Label>
                  <Input type="number" min={1} inputMode="numeric" placeholder="No limit"
                         value={maxStaff} onChange={e => setMaxStaff(e.target.value)} className="rounded-lg focus-visible:ring-violet-500/40" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Product limit</Label>
                  <Input type="number" min={1} inputMode="numeric" placeholder="No limit"
                         value={maxProducts} onChange={e => setMaxProducts(e.target.value)} className="rounded-lg focus-visible:ring-violet-500/40" />
                </div>
              </div>
              <Notice tone="neutral">
                Leave blank for no limit. The shop is told to contact you when it reaches a limit; nothing it has already added is removed.
              </Notice>
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Owner email</Label>
              <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-lg focus-visible:ring-violet-500/40" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="font-semibold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="font-semibold rounded-lg" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
              Save changes
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
      <DialogContent className="sm:max-w-sm sm:rounded-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-gray-900">Extend access</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">Add time to {tenant?.name}'s subscription.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-2">
            <Label className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Duration</Label>
            <Select value={duration} onValueChange={(v: AccessKey) => setDuration(v)}>
              <SelectTrigger className="rounded-lg focus-visible:ring-violet-500/40"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {ACCESS_PRESETS.map(p => <SelectItem key={p.key} value={p.key} className="rounded-lg">{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="font-semibold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="font-semibold rounded-lg" disabled={busy}>Extend</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
