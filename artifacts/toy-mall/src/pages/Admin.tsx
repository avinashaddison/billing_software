import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, LogOut, RefreshCw, Plus, Search, Building2, Users, Package,
  Receipt, Loader2, AlertTriangle, Mail, Lock, KeyRound, Power, PowerOff,
  CheckCircle2, CalendarClock, Infinity,
} from "lucide-react";
import { toast } from "sonner";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API  = `${BASE}/api`;

interface PlatformMe { id: string; email: string; role: string }
interface TenantRow {
  id: string;
  name: string;
  isActive: boolean;
  /** ISO timestamp. NULL = lifetime / no expiry. */
  expiresAt: string | null;
  createdAt: string;
  ownerEmail: string | null;
  userCount: number;
  staffCount: number;
  productCount: number;
  saleCount: number;
}

/** Access duration choices used in both the create dialog and Extend menu. */
const ACCESS_PRESETS = [
  { key: "7d",       label: "7 days"     },
  { key: "30d",      label: "1 month"    },
  { key: "90d",      label: "3 months"   },
  { key: "180d",     label: "6 months"   },
  { key: "365d",     label: "1 year"     },
  { key: "lifetime", label: "Lifetime"   },
] as const;
type AccessKey = (typeof ACCESS_PRESETS)[number]["key"];

/** Friendly "Expires in 12d" / "Expired 3d ago" / "Lifetime" formatter. */
function expiryLabel(iso: string | null): { text: string; tone: "ok" | "warn" | "bad" | "lifetime" } {
  if (!iso) return { text: "Lifetime", tone: "lifetime" };
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (days < 0)  return { text: `Expired ${Math.abs(days)}d ago`, tone: "bad"  };
  if (days <= 7) return { text: `${days}d left`,                  tone: "warn" };
  return            { text: `${days}d left`,                       tone: "ok"   };
}
interface Stats {
  totalTenants:  number;
  activeTenants: number;
  totalUsers:    number;
  legacyUsers:   number;
}

export default function AdminPage() {
  const [me, setMe]       = useState<PlatformMe | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`${API}/platform/me`, { credentials: "include" })
      .then(async (r) => (r.ok ? (await r.json()) as PlatformMe : null))
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me) return <LoginScreen onAuthed={setMe} />;
  return <Dashboard me={me} onLogout={() => setMe(null)} />;
}

/* ───────── Login ───────── */
function LoginScreen({ onAuthed }: { onAuthed: (m: PlatformMe) => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/platform/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error || "Invalid platform admin credentials");
        return;
      }
      onAuthed(await r.json());
    } catch {
      setError("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative flex flex-col items-center justify-center p-6 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-black dark:via-zinc-950 dark:to-zinc-900">
      {/* Apple-style ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-blue-400/20 dark:bg-blue-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-violet-400/20 dark:bg-violet-500/15 blur-3xl" />

      {/* Brand header */}
      <div className="relative mb-10 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/25 ring-1 ring-black/5">
          <ShieldCheck className="w-9 h-9 text-white drop-shadow-sm" strokeWidth={2.2} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          AddisonX Admin
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-zinc-400 mt-1">
          Manage all client tenants
        </p>
      </div>

      <form
        onSubmit={submit}
        className="relative w-full max-w-[380px] rounded-[28px] border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] p-6 space-y-3"
      >
        <p className="text-center text-[13px] text-slate-500 dark:text-zinc-400 mb-1">
          Sign in to your vendor account
        </p>

        {error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-3 py-2.5 text-center">
            <p className="text-[13px] text-red-600 dark:text-red-400 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          </div>
        )}

        {/* Email */}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="w-full pl-11 pr-4 h-12 rounded-2xl bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full pl-11 pr-4 h-12 rounded-2xl bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={!email || !password || busy}
          className="w-full h-12 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-medium text-[15px] tracking-[-0.01em] shadow-lg shadow-blue-500/30 ring-1 ring-blue-700/20 active:scale-[0.985] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
        </button>

        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-3 text-center">
          Vendor-only access. Accounts with role <span className="font-mono text-slate-500 dark:text-zinc-400">platform_admin</span> only.
        </p>
      </form>

      {/* Footer */}
      <div className="relative mt-10 flex flex-col items-center gap-1.5">
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 tracking-wide">Developed by</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]">⚡</span>
          <span className="text-[13px] font-medium bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
            AddisonX Media
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────── Dashboard ───────── */
function Dashboard({ me, onLogout }: { me: PlatformMe; onLogout: () => void }) {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch]   = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        fetch(`${API}/platform/tenants`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/platform/stats`,   { credentials: "include" }).then((r) => r.json()),
      ]);
      setTenants(t.tenants ?? []);
      setStats(s);
    } catch {
      toast.error("Could not load tenants");
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const logout = async () => {
    await fetch(`${API}/platform/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    onLogout();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter((t) => t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [tenants, search]);

  const toggleActive = async (t: TenantRow) => {
    const next = !t.isActive;
    if (!confirm(`${next ? "Activate" : "Suspend"} ${t.name}?`)) return;
    const r = await fetch(`${API}/platform/tenants/${t.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    if (r.ok) { toast.success(next ? "Activated" : "Suspended"); void refresh(); }
    else toast.error("Failed");
  };

  /* Per-tenant menu state: which tenant has the "Extend" popover open? */
  const [extendOpenFor, setExtendOpenFor] = useState<string | null>(null);

  const extend = async (t: TenantRow, duration: AccessKey) => {
    setExtendOpenFor(null);
    const r = await fetch(`${API}/platform/tenants/${t.id}/extend`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration }),
    });
    if (r.ok) {
      toast.success(duration === "lifetime"
        ? `${t.name}: set to lifetime access`
        : `${t.name}: extended by ${ACCESS_PRESETS.find((p) => p.key === duration)?.label}`);
      void refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      toast.error(data.error || "Failed to extend");
    }
  };

  const resetOwnerPwd = async (t: TenantRow) => {
    const newPwd = prompt(`New password for the owner of ${t.name} (8–128 chars):`);
    if (!newPwd) return;
    if (newPwd.length < 8) { toast.error("Password too short"); return; }
    const r = await fetch(`${API}/platform/tenants/${t.id}/owner-password`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPwd }),
    });
    if (r.ok) {
      const data = await r.json();
      toast.success(`Password reset for ${data.ownerEmail}`);
    } else {
      const data = await r.json().catch(() => ({}));
      toast.error(data.error || "Failed");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
              <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">AddisonX Admin</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{me.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="p-2 rounded-xl bg-card border hover:bg-muted transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={logout} className="px-3 py-2 rounded-xl bg-card border text-xs font-bold flex items-center gap-1.5 hover:bg-muted">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Tenants"  value={stats?.totalTenants ?? 0}  gradient="from-violet-500 to-fuchsia-500" icon={Building2} />
          <StatCard label="Active Tenants" value={stats?.activeTenants ?? 0} gradient="from-emerald-500 to-teal-500" icon={CheckCircle2} />
          <StatCard label="Auth Users"     value={stats?.totalUsers ?? 0}    gradient="from-blue-500 to-cyan-500" icon={Users} />
          <StatCard label="Legacy NULL"    value={stats?.legacyUsers ?? 0}   gradient="from-amber-500 to-orange-500" icon={AlertTriangle} />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants by name or id…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Tenant
          </button>
        </div>

        {/* Tenants table */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
            {tenants.length === 0 ? "No tenants yet — click 'New Tenant' to onboard your first client." : "No tenants match this search."}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden divide-y">
            {filtered.map((t) => (
              <div key={t.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${t.isActive ? "from-violet-500 to-fuchsia-500" : "from-slate-400 to-slate-600"}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm">{t.name}</p>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{t.id}</span>
                      {t.isActive
                        ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">Active</span>
                        : <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">Suspended</span>
                      }
                      {(() => {
                        const lbl = expiryLabel(t.expiresAt);
                        const tone =
                          lbl.tone === "lifetime" ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" :
                          lbl.tone === "ok"       ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
                          lbl.tone === "warn"     ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" :
                                                    "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300";
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tone}`}
                            title={t.expiresAt ? `Expires ${new Date(t.expiresAt).toLocaleString()}` : "No expiry set"}>
                            {lbl.text}
                          </span>
                        );
                      })()}
                    </div>
                    {t.ownerEmail && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="font-mono truncate" title={t.ownerEmail}>{t.ownerEmail}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Users    className="w-3 h-3" /> {t.userCount} user{t.userCount === 1 ? "" : "s"}</span>
                      <span className="flex items-center gap-1"><Users    className="w-3 h-3" /> {t.staffCount} staff</span>
                      <span className="flex items-center gap-1"><Package  className="w-3 h-3" /> {t.productCount} products</span>
                      <span className="flex items-center gap-1"><Receipt  className="w-3 h-3" /> {t.saleCount} sales</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap relative">
                      <button onClick={() => resetOwnerPwd(t)} className="px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 hover:bg-muted">
                        <KeyRound className="w-3 h-3" /> Reset Owner Password
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setExtendOpenFor(extendOpenFor === t.id ? null : t.id)}
                          className="px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 hover:bg-muted text-violet-700 dark:text-violet-300"
                        >
                          <CalendarClock className="w-3 h-3" /> Extend
                        </button>
                        {extendOpenFor === t.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setExtendOpenFor(null)} />
                            <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-xl border bg-card shadow-xl overflow-hidden">
                              <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">
                                Extend access
                              </p>
                              {ACCESS_PRESETS.map((p) => (
                                <button
                                  key={p.key}
                                  onClick={() => extend(t, p.key)}
                                  className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-muted flex items-center justify-between"
                                >
                                  <span>{p.label}</span>
                                  {p.key === "lifetime" && <Infinity className="w-3 h-3 text-blue-500" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <button onClick={() => toggleActive(t)} className={`px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 ${t.isActive ? "text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30" : "text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}>
                        {t.isActive ? <><PowerOff className="w-3 h-3" /> Suspend</> : <><Power className="w-3 h-3" /> Activate</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <CreateTenantDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void refresh(); }} />}
    </div>
  );
}

function StatCard({ label, value, gradient, icon: Icon }: {
  label: string; value: number; gradient: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 relative overflow-hidden">
      <div aria-hidden className={`absolute -top-8 -right-8 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-xl`} />
      <div className={`relative inline-flex w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} items-center justify-center text-white shadow-lg`}>
        <Icon className="w-4 h-4" strokeWidth={2.5} />
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

/* ───────── Create Tenant Dialog ───────── */
function CreateTenantDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /* Access duration — drives `expiresAt` on the server. Default to 1 year
     since that's the most common paid SaaS subscription length. */
  const [access, setAccess] = useState<AccessKey>("365d");
  /* Track whether the user has manually edited the tenant id. Until they do,
     we keep regenerating it from the shop name on every keystroke. The moment
     they touch the id field we stop syncing so we don't clobber their edit. */
  const [idTouched, setIdTouched] = useState(false);

  /* Slugify: lowercase, strip diacritics, replace runs of non-alnum with "-",
     trim leading/trailing "-", cap at 40 chars (server-side rule). */
  const slugify = (s: string) =>
    s.toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const onNameChange = (next: string) => {
    setName(next);
    if (!idTouched) setId(slugify(next));
  };

  const onIdChange = (next: string) => {
    setIdTouched(true);
    setId(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim().toLowerCase(),
          name: name.trim(),
          ownerEmail: email.trim(),
          ownerPassword: password,
          expiresAt: access,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error || "Could not create tenant");
        return;
      }
      toast.success("Tenant created");
      onCreated();
    } catch { toast.error("Server unreachable"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border bg-card p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-black">Onboard New Client</h2>
            <p className="text-xs text-muted-foreground">Creates the tenant + an owner login.</p>
          </div>
        </div>

        <Field label="Shop Name">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Hira & Sons Gift Shop"
            className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field
          label="Tenant ID"
          hint={idTouched
            ? "Lowercase letters, digits, hyphens. Used in the URL and DB."
            : "Auto-generated from the shop name. Type here to override."}
        >
          <input
            value={id}
            onChange={(e) => onIdChange(e.target.value)}
            placeholder="hira-sons"
            className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Owner Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@shop.com"
            className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Access Duration" hint="When the client's access expires. You can change this later from the tenant row.">
          <div className="grid grid-cols-3 gap-1.5">
            {ACCESS_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setAccess(p.key)}
                className={`px-2.5 py-2 rounded-xl border text-[12px] font-bold transition-colors ${
                  access === p.key
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white border-transparent shadow-sm shadow-violet-500/30"
                    : "bg-card hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Owner Password" hint="They'll use this with their email at /login. 8+ chars.">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border bg-card text-sm font-bold hover:bg-muted">
            Cancel
          </button>
          <button type="submit" disabled={busy || !id || !name || !email || password.length < 8}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30 disabled:opacity-50">
            {busy ? "Creating…" : "Create Tenant"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground block">{hint}</span>}
    </label>
  );
}
