import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, LogOut, RefreshCw, Plus, Search, Building2, Users, Package,
  Receipt, Loader2, AlertTriangle, Mail, Lock, KeyRound, Power, PowerOff,
  CheckCircle2, CalendarClock, Infinity, Pencil, Copy, ScrollText, X, Clock,
  IndianRupee, DatabaseBackup, Download, Eye, Cloud, Send, ArchiveRestore,
  LayoutDashboard, Menu, ChevronRight,
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
  { key: "3d",       label: "3 days"     },
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
          Addison Bill Admin
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
            Addison Bill Media
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
  const [sortBy, setSortBy]   = useState<"newest" | "name" | "expiry">("newest");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "expired">("all");
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [viewingUsers, setViewingUsers] = useState<TenantRow | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`${API}/platform/tenants`, { credentials: "include" }),
        fetch(`${API}/platform/stats`,   { credentials: "include" }),
      ]);
      /* Session expired or revoked → bounce back to the login screen instead
         of leaving the vendor staring at an empty dashboard with a vague error. */
      if (tRes.status === 401 || sRes.status === 401) {
        toast.error("Session expired — please sign in again");
        onLogout();
        return;
      }
      if (!tRes.ok || !sRes.ok) {
        toast.error("Could not load tenants");
        return;
      }
      const t = await tRes.json();
      const s = await sRes.json();
      setTenants(Array.isArray(t.tenants) ? t.tenants : []);
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

  /* Trigger an immediate DB backup → Cloudflare R2 + Telegram (same routine
     as the nightly job). */
  const backupNow = async () => {
    setBackingUp(true);
    const t = toast.loading("Backing up database…");
    try {
      const r = await fetch(`${API}/platform/backup`, { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const dests = [d.destinations?.r2 ? "Cloudflare R2" : null, d.destinations?.telegram ? "Telegram" : null]
          .filter(Boolean).join(" + ") || "?";
        toast.success(`Backup saved to ${dests} — ${d.tables ?? "?"} tables, ${Number(d.totalRows ?? 0).toLocaleString("en-IN")} rows`, { id: t });
      } else {
        toast.error(d.error || "Backup failed", { id: t });
      }
    } catch { toast.error("Server unreachable", { id: t }); }
    finally { setBackingUp(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const isExpired = (t: TenantRow) => !!t.expiresAt && new Date(t.expiresAt).getTime() < now;
    const rows = tenants.filter((t) => {
      if (q
        && !t.id.toLowerCase().includes(q)
        && !t.name.toLowerCase().includes(q)
        && !(t.ownerEmail ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter === "active"    && (!t.isActive || isExpired(t))) return false;
      if (statusFilter === "suspended" && t.isActive)                    return false;
      if (statusFilter === "expired"   && !isExpired(t))                 return false;
      return true;
    });
    /* Lifetime tenants (no expiry) sort to the very end of "expiry soonest". */
    const NEVER = Number.MAX_SAFE_INTEGER;
    return [...rows].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "expiry") {
        const ax = a.expiresAt ? new Date(a.expiresAt).getTime() : NEVER;
        const bx = b.expiresAt ? new Date(b.expiresAt).getTime() : NEVER;
        return ax - bx;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tenants, search, statusFilter, sortBy]);

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
    if (newPwd.length < 8)   { toast.error("Password too short (min 8 characters)"); return; }
    if (newPwd.length > 128) { toast.error("Password too long (max 128 characters)"); return; }
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

  /* ── Sidebar shell ── */
  type Section = "dashboard" | "tenants" | "pricing" | "backups";
  const [section, setSection] = useState<Section>("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const NAV: { key: Section; label: string; icon: React.ElementType; hint: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Overview & quick actions" },
    { key: "tenants",   label: "Tenants",   icon: Building2,       hint: "Manage client shops" },
    { key: "pricing",   label: "Pricing",   icon: IndianRupee,     hint: "Landing-page price" },
    { key: "backups",   label: "Backups",   icon: DatabaseBackup,  hint: "R2, schedule & restore" },
  ];
  const SECTION_META: Record<Section, { title: string; sub: string }> = {
    dashboard: { title: "Dashboard", sub: "Everything at a glance" },
    tenants:   { title: "Tenants",   sub: `${tenants.length} client shop${tenants.length !== 1 ? "s" : ""} on the platform` },
    pricing:   { title: "Subscription Pricing", sub: "Drives the public landing page" },
    backups:   { title: "Database Backups", sub: "Cloudflare R2 · Telegram · restore" },
  };

  const goto = (s: Section) => { setSection(s); setNavOpen(false); };

  /* Tenants that need attention: expired or expiring within 7 days. */
  const attention = useMemo(() => {
    const now = Date.now();
    return tenants
      .filter((t) => t.expiresAt && (new Date(t.expiresAt).getTime() - now) < 7 * 86_400_000)
      .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())
      .slice(0, 6);
  }, [tenants]);

  const SidebarBody = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/40 shrink-0">
          <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black tracking-tight text-white leading-tight">Addison Bill</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/80">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map(({ key, label, icon: Icon, hint }) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => goto(key)}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                active ? "bg-white/10 text-white shadow-inner" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500 transition-all duration-300 ${active ? "h-6 opacity-100" : "h-0 opacity-0"}`} />
              <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold leading-tight">{label}</span>
                <span className={`block text-[10px] leading-tight transition-colors ${active ? "text-violet-200/70" : "text-slate-500 group-hover:text-slate-400"}`}>{hint}</span>
              </span>
              {key === "tenants" && tenants.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${active ? "bg-white/15 text-white" : "bg-white/5 text-slate-400"}`}>
                  {tenants.length}
                </span>
              )}
              {attention.length > 0 && key === "dashboard" && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          );
        })}

        <div className="pt-2 mt-2 border-t border-white/10">
          <button
            onClick={() => { setAuditOpen(true); setNavOpen(false); }}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <ScrollText className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span className="flex-1 text-[13px] font-bold">Audit Log</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        </div>
      </nav>

      {/* User / sign out */}
      <div className="px-3 pb-5 pt-3 border-t border-white/10 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-white/20 flex items-center justify-center text-[11px] font-black text-white shrink-0 uppercase">
            {me.email.slice(0, 1)}
          </div>
          <p className="text-[11px] font-mono text-slate-400 truncate" title={me.email}>{me.email}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 text-[13px] font-bold"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] flex bg-gradient-to-br from-slate-50 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20">

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-[100dvh] bg-slate-950 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-violet-600/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="relative flex flex-col h-full">{SidebarBody}</div>
      </aside>

      {/* ── Sidebar (mobile drawer) ── */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setNavOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-slate-950 flex flex-col animate-in slide-in-from-left duration-300">
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <div className="sticky top-0 z-20 bg-background/70 backdrop-blur-xl border-b">
          <div className="px-4 md:px-8 py-3.5 flex items-center gap-3">
            <button onClick={() => setNavOpen(true)} className="lg:hidden p-2 rounded-xl border bg-card hover:bg-muted transition-colors">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0" key={section}>
              <h1 className="text-lg font-black tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-1 duration-300">
                {SECTION_META[section].title}
              </h1>
              <p className="text-[11px] text-muted-foreground animate-in fade-in duration-500">{SECTION_META[section].sub}</p>
            </div>
            <button onClick={refresh} className="p-2.5 rounded-xl bg-card border hover:bg-muted transition-all active:scale-90" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30 flex items-center gap-1.5 hover:shadow-violet-500/50 hover:-translate-y-px active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Tenant</span>
            </button>
          </div>
        </div>

        {/* Section content */}
        <div key={section} className="flex-1 px-4 md:px-8 py-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-6xl w-full">

          {/* ═══ DASHBOARD ═══ */}
          {section === "dashboard" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Tenants",  value: stats?.totalTenants ?? 0,  gradient: "from-violet-500 to-fuchsia-500", icon: Building2 },
                  { label: "Active Tenants", value: stats?.activeTenants ?? 0, gradient: "from-emerald-500 to-teal-500",   icon: CheckCircle2 },
                  { label: "Auth Users",     value: stats?.totalUsers ?? 0,    gradient: "from-blue-500 to-cyan-500",      icon: Users },
                  { label: "Legacy NULL",    value: stats?.legacyUsers ?? 0,   gradient: "from-amber-500 to-orange-500",   icon: AlertTriangle },
                ].map((s, i) => (
                  <div key={s.label} className="animate-in fade-in zoom-in-95 duration-300" style={{ animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}>
                    <StatCard label={s.label} value={s.value} gradient={s.gradient} icon={s.icon} />
                  </div>
                ))}
              </div>

              {/* Needs attention */}
              {attention.length > 0 && (
                <div className="rounded-2xl border border-amber-300/50 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 md:p-5 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                      <Clock className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black">Needs Attention</h2>
                      <p className="text-[11px] text-muted-foreground">Expired or expiring within 7 days</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {attention.map((t) => {
                      const lbl = expiryLabel(t.expiresAt);
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setSortBy("expiry"); setSearch(""); goto("tenants"); }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card hover:bg-muted hover:-translate-y-px transition-all text-left group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black truncate">{t.name}</p>
                            <p className={`text-[10px] font-bold ${lbl.tone === "bad" ? "text-rose-500" : "text-amber-600 dark:text-amber-400"}`}>{lbl.text}</p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "New Tenant", desc: "Onboard a client", icon: Plus, cls: "from-violet-500 to-fuchsia-600", onClick: () => setCreating(true) },
                  { label: backingUp ? "Backing up…" : "Backup Now", desc: "R2 + Telegram", icon: DatabaseBackup, cls: "from-sky-500 to-indigo-600", onClick: backupNow },
                  { label: "Manage Backups", desc: "Preview & restore", icon: ArchiveRestore, cls: "from-emerald-500 to-teal-600", onClick: () => goto("backups") },
                  { label: "Audit Log", desc: "Every admin action", icon: ScrollText, cls: "from-slate-500 to-slate-700", onClick: () => setAuditOpen(true) },
                ].map((a, i) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    disabled={a.label.startsWith("Backing")}
                    className="rounded-2xl border bg-card p-4 text-left hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 animate-in fade-in zoom-in-95 disabled:opacity-60"
                    style={{ animationDelay: `${250 + i * 60}ms`, animationFillMode: "backwards" }}
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.cls} flex items-center justify-center text-white shadow-lg mb-3`}>
                      <a.icon className={`w-4 h-4 ${a.label.startsWith("Backing") ? "animate-pulse" : ""}`} strokeWidth={2.5} />
                    </div>
                    <p className="text-sm font-black leading-tight">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ═══ PRICING ═══ */}
          {section === "pricing" && <PricingCard />}

          {/* ═══ BACKUPS ═══ */}
          {section === "backups" && <BackupsCard />}

          {/* ═══ TENANTS ═══ */}
          {section === "tenants" && (
            <>
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, id, or owner email…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            title="Filter by status"
            className="px-3 py-2.5 rounded-xl border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            title="Sort tenants"
            className="px-3 py-2.5 rounded-xl border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="expiry">Expiry soonest</option>
          </select>
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
            {filtered.map((t, ti) => (
              <div key={t.id} className="p-4 hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300"
                style={{ animationDelay: `${Math.min(ti * 45, 450)}ms`, animationFillMode: "backwards" }}>
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
                      <button onClick={() => setEditing(t)} className="px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 hover:bg-muted">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => setViewingUsers(t)} className="px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 hover:bg-muted">
                        <Users className="w-3 h-3" /> Users
                      </button>
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
            </>
          )}
        </div>
      </div>

      {creating && <CreateTenantDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void refresh(); }} />}
      {editing && <EditTenantDialog tenant={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
      {viewingUsers && <ViewUsersDialog tenant={viewingUsers} onClose={() => setViewingUsers(null)} />}
      {auditOpen && <AuditLogDialog onClose={() => setAuditOpen(false)} />}
    </div>
  );
}

function StatCard({ label, value, gradient, icon: Icon }: {
  label: string; value: number; gradient: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 relative overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div aria-hidden className={`absolute -top-8 -right-8 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-xl`} />
      <div className={`relative inline-flex w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} items-center justify-center text-white shadow-lg`}>
        <Icon className="w-4 h-4" strokeWidth={2.5} />
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

/* ───────── Subscription Pricing card (global — drives the landing page) ───── */
function PricingCard() {
  const [dealPrice, setDealPrice]         = useState<number | "">("");
  const [originalPrice, setOriginalPrice] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/platform/settings`, { credentials: "include" });
        if (!r.ok) { if (alive) toast.error("Could not load pricing"); return; }
        const d = await r.json();
        if (!alive) return;
        setDealPrice(Number(d?.pricing?.dealPrice ?? 4999));
        setOriginalPrice(Number(d?.pricing?.originalPrice ?? 9999));
      } catch { if (alive) toast.error("Could not load pricing"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const deal = typeof dealPrice === "number" ? dealPrice : 0;
  const perMonth = Math.round(deal / 12);
  const perDay   = Math.round(deal / 365);

  const save = async () => {
    if (typeof dealPrice !== "number" || typeof originalPrice !== "number") {
      toast.error("Enter both prices"); return;
    }
    if (!Number.isInteger(dealPrice) || !Number.isInteger(originalPrice) || dealPrice < 0 || originalPrice < 0) {
      toast.error("Prices must be whole rupee amounts"); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/platform/settings`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealPrice, originalPrice }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error || "Could not save pricing"); return;
      }
      toast.success("Landing-page price updated");
    } catch { toast.error("Server unreachable"); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shrink-0">
          <IndianRupee className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black">Subscription Pricing</h2>
          <p className="text-[11px] text-muted-foreground">Shown on the public landing page. ₹/month &amp; ₹/day auto-calculate from the deal price.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 md:items-end">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Deal price (₹ / year)</span>
              <input
                type="number" min={0} step={1} value={dealPrice}
                onChange={(e) => setDealPrice(e.target.value === "" ? "" : Math.trunc(Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Original — struck-through (₹)</span>
              <input
                type="number" min={0} step={1} value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value === "" ? "" : Math.trunc(Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <button
              onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/30 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-muted/40 border px-4 py-3">
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Landing-page preview</span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm line-through text-muted-foreground tabular-nums">{inr(typeof originalPrice === "number" ? originalPrice : 0)}</span>
              <span className="text-2xl font-black tabular-nums">{inr(deal)}</span>
              <span className="text-xs text-muted-foreground">= <strong className="text-foreground">{inr(perMonth)}/month</strong> · {inr(perDay)}/day</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────── Database Backups card ─────────
 * Configure the nightly backup hour (applied live — no restart), run one now,
 * and browse the backups stored in Cloudflare R2: preview what's inside
 * (tables + row counts) or download the .json.gz. */
interface BackupFile { key: string; filename: string; sizeBytes: number; lastModified: string | null }
interface BackupsInfo {
  r2Configured: boolean;
  telegramConfigured: boolean;
  backupHour: number;
  files: BackupFile[];
  listError?: string;
}
interface BackupPreview {
  key: string;
  sizeBytes: number;
  meta: { generatedAt?: string; date?: string; tables?: number; totalRows?: number };
  tables: { name: string; rows: number }[];
}

const fmtHour = (h: number) => {
  const ampm = h < 12 ? "AM" : "PM";
  const disp = h % 12 === 0 ? 12 : h % 12;
  return `${String(disp).padStart(2, "0")}:30 ${ampm}`;
};
const fmtMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "—";

function BackupsCard() {
  const [info, setInfo]           = useState<BackupsInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [hour, setHour]           = useState(2);
  const [savingHour, setSavingHour] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [preview, setPreview]     = useState<BackupPreview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`${API}/platform/backups`, { credentials: "include" });
      if (!r.ok) { toast.error("Could not load backups"); return; }
      const d: BackupsInfo = await r.json();
      setInfo(d);
      setHour(d.backupHour);
      if (d.listError) toast.error(d.listError);
    } catch { toast.error("Server unreachable"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const saveHour = async () => {
    setSavingHour(true);
    try {
      const r = await fetch(`${API}/platform/backup-settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hour }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Could not save backup time"); return; }
      toast.success(`Nightly backup rescheduled to ${fmtHour(hour)} IST — active immediately`);
      setInfo((i) => (i ? { ...i, backupHour: hour } : i));
    } catch { toast.error("Server unreachable"); }
    finally { setSavingHour(false); }
  };

  const backupNow = async () => {
    setBackingUp(true);
    const t = toast.loading("Backing up database…");
    try {
      const r = await fetch(`${API}/platform/backup`, { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const dests = [d.destinations?.r2 ? "Cloudflare R2" : null, d.destinations?.telegram ? "Telegram" : null]
          .filter(Boolean).join(" + ") || "?";
        toast.success(`Backup saved to ${dests} — ${d.tables ?? "?"} tables, ${Number(d.totalRows ?? 0).toLocaleString("en-IN")} rows`, { id: t });
        await load();
      } else {
        toast.error(d.error || "Backup failed", { id: t });
      }
    } catch { toast.error("Server unreachable", { id: t }); }
    finally { setBackingUp(false); }
  };

  const openPreview = async (f: BackupFile) => {
    setPreviewing(f.key);
    try {
      const r = await fetch(`${API}/platform/backups/preview?key=${encodeURIComponent(f.key)}`, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Preview failed"); return; }
      setPreview(d as BackupPreview);
    } catch { toast.error("Server unreachable"); }
    finally { setPreviewing(null); }
  };

  const doRestore = async () => {
    if (!restoreTarget || restoreConfirm !== "RESTORE" || restoring) return;
    setRestoring(true);
    const t = toast.loading("Restoring database — do not close this tab…");
    try {
      const r = await fetch(`${API}/platform/backups/restore`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: restoreTarget.key, confirm: restoreConfirm }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Restore failed — database unchanged", { id: t }); return; }
      toast.success(
        `Restored ${d.tables} tables (${Number(d.rowsRestored ?? 0).toLocaleString("en-IN")} rows). ` +
        `A safety backup of the previous data was saved first.`,
        { id: t, duration: 8000 },
      );
      setRestoreTarget(null);
      setRestoreConfirm("");
      await load();
    } catch { toast.error("Server unreachable", { id: t }); }
    finally { setRestoring(false); }
  };

  const download = async (f: BackupFile) => {
    setDownloading(f.key);
    try {
      const r = await fetch(`${API}/platform/backups/download?key=${encodeURIComponent(f.key)}`, { credentials: "include" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Download failed"); return;
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = f.filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Server unreachable"); }
    finally { setDownloading(null); }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shrink-0">
          <DatabaseBackup className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black">Database Backups</h2>
          <p className="text-[11px] text-muted-foreground">Nightly automatic backup + on-demand. Stored in Cloudflare R2, copied to Telegram.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${info?.r2Configured ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
            <Cloud className="w-3 h-3" /> R2 {info?.r2Configured ? "✓" : "not set"}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${info?.telegramConfigured ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
            <Send className="w-3 h-3" /> Telegram {info?.telegramConfigured ? "✓" : "not set"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Schedule + backup-now row */}
          <div className="grid md:grid-cols-[auto_auto_1fr] gap-3 md:items-end">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Nightly backup time (IST)
              </span>
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-44 px-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{fmtHour(h)}</option>
                ))}
              </select>
            </label>
            <button
              onClick={saveHour}
              disabled={savingHour || hour === info?.backupHour}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-black text-sm shadow-lg shadow-sky-500/30 disabled:opacity-50"
            >
              {savingHour ? "Saving…" : hour === info?.backupHour ? "Scheduled ✓" : "Save Time"}
            </button>
            <div className="flex md:justify-end">
              <button
                onClick={backupNow}
                disabled={backingUp}
                className="px-5 py-2.5 rounded-xl border font-black text-sm flex items-center gap-2 hover:bg-muted disabled:opacity-50"
              >
                <DatabaseBackup className={`w-4 h-4 ${backingUp ? "animate-pulse" : ""}`} />
                {backingUp ? "Backing up…" : "Backup Now"}
              </button>
            </div>
          </div>

          {/* Stored backups (R2) */}
          <div className="mt-4">
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              Stored backups {info?.r2Configured ? `(Cloudflare R2 — newest ${info.files.length})` : ""}
            </span>
            {!info?.r2Configured ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-500">
                Cloudflare R2 is not configured — add the R2_* env vars to store, preview and download backups here.
                Backups currently go to Telegram only.
              </div>
            ) : info.files.length === 0 ? (
              <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
                No backups in R2 yet — press <b>Backup Now</b> to create the first one.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                  {info.files.map((f) => (
                    <div key={f.key} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/40">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <DatabaseBackup className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold font-mono truncate">{f.filename}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtWhen(f.lastModified)} · {fmtMb(f.sizeBytes)}</p>
                      </div>
                      <button
                        onClick={() => openPreview(f)}
                        disabled={previewing === f.key}
                        className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 hover:bg-muted disabled:opacity-50 shrink-0"
                      >
                        {previewing === f.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        Preview
                      </button>
                      <button
                        onClick={() => download(f)}
                        disabled={downloading === f.key}
                        className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 hover:bg-muted disabled:opacity-50 shrink-0"
                      >
                        {downloading === f.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Download
                      </button>
                      <button
                        onClick={() => { setRestoreTarget(f); setRestoreConfirm(""); }}
                        className="px-2.5 py-1.5 rounded-lg border border-red-500/40 text-[11px] font-bold flex items-center gap-1 text-red-500 hover:bg-red-500/10 shrink-0"
                      >
                        <ArchiveRestore className="w-3 h-3" />
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Restore confirmation dialog ── */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             onClick={(e) => { if (e.target === e.currentTarget && !restoring) { setRestoreTarget(null); setRestoreConfirm(""); } }}>
          <div className="w-full max-w-md bg-card border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-500/30 bg-red-500/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center text-white shrink-0">
                <ArchiveRestore className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-red-500">Restore Database</h3>
                <p className="text-[11px] font-mono text-muted-foreground truncate">{restoreTarget.filename}</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 space-y-1.5 text-xs text-red-500 font-medium">
                <p className="font-black">⚠ This replaces ALL current data — for EVERY tenant.</p>
                <p>Every bill, product, staff account and setting created after
                   {" "}{fmtWhen(restoreTarget.lastModified)} will be gone.</p>
                <p>A safety backup of today's data is taken automatically first, and the
                   restore is all-or-nothing — if anything fails, nothing changes.</p>
                <p>Devices logged in after this backup was taken may need to sign in again.</p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Type <span className="text-red-500">RESTORE</span> to confirm
                </span>
                <input
                  value={restoreConfirm}
                  onChange={(e) => setRestoreConfirm(e.target.value.toUpperCase())}
                  placeholder="RESTORE"
                  disabled={restoring}
                  className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-mono font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </label>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => { setRestoreTarget(null); setRestoreConfirm(""); }}
                disabled={restoring}
                className="py-2.5 rounded-xl border font-bold text-sm hover:bg-muted disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={doRestore}
                disabled={restoreConfirm !== "RESTORE" || restoring}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {restoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring…</> : <><ArchiveRestore className="w-4 h-4" /> Restore</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview dialog ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
             onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-black flex items-center gap-2"><Eye className="w-4 h-4" /> Backup Preview</h3>
                <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{preview.key.replace(/^backups\//, "")}</p>
              </div>
              <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Tables",   value: String(preview.meta.tables ?? preview.tables.length) },
                  { label: "Total rows", value: Number(preview.meta.totalRows ?? preview.tables.reduce((s, t) => s + t.rows, 0)).toLocaleString("en-IN") },
                  { label: "Size (gzip)", value: fmtMb(preview.sizeBytes) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                    <p className="text-sm font-black tabular-nums">{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {preview.meta.generatedAt && (
                <p className="text-[11px] text-muted-foreground">
                  Generated {fmtWhen(String(preview.meta.generatedAt))} IST
                </p>
              )}
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] px-3 py-2 bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>Table</span><span>Rows</span>
                </div>
                <div className="divide-y divide-border/50">
                  {preview.tables.map((t) => (
                    <div key={t.name} className="grid grid-cols-[1fr_auto] px-3 py-1.5 text-xs">
                      <span className="font-mono truncate">{t.name}</span>
                      <span className="font-black tabular-nums">{t.rows.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
  /* On success we flip to a credentials hand-off screen instead of closing
     immediately, so the vendor can copy the login the client will need. */
  const [created, setCreated] = useState<{ name: string; email: string; password: string; pin: string | null } | null>(null);
  /* Access duration — drives `expiresAt` on the server. Defaults to the 3-day
     free trial; bump to a paid duration (e.g. 1 year) once the client pays. */
  const [access, setAccess] = useState<AccessKey>("3d");
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
      const data = await r.json().catch(() => ({}));
      /* Surface the credentials once. The password is the one just typed
         (the API never returns it); the staff PIN comes from the response. */
      setCreated({
        name:     name.trim(),
        email:    email.trim().toLowerCase(),
        password,
        /* Only surface a PIN the server actually returned — never fabricate
           one, or we could hand the client a PIN that isn't really set. */
        pin:      typeof data?.staff?.pin === "string" ? data.staff.pin : null,
      });
      toast.success("Tenant created");
    } catch { toast.error("Server unreachable"); }
    finally { setBusy(false); }
  };

  if (created) {
    const loginUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${BASE}/login`;
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCreated}>
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border bg-card p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black">{created.name} is ready</h2>
              <p className="text-xs text-muted-foreground">Hand these credentials to the client.</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/30 divide-y">
            <CredRow label="Login URL"      value={loginUrl} />
            <CredRow label="Owner Email"    value={created.email} mono />
            <CredRow label="Owner Password" value={created.password} mono />
            {created.pin
              ? <CredRow label="Staff PIN" value={created.pin} mono hint="Default — change it in Staff Management." />
              : (
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Staff PIN</p>
                  <p className="text-sm text-muted-foreground">Unavailable — set it in Staff Management after the owner logs in.</p>
                </div>
              )}
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Copy the password now — it is stored only as a hash and cannot be retrieved later.
            </p>
          </div>

          <button onClick={onCreated} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30">
            Done
          </button>
        </div>
      </div>
    );
  }

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

/* ───────── Credential row with copy-to-clipboard ───────── */
function CredRow({ label, value, mono, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Copy failed — copy it manually"); }
  };
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={`text-sm truncate ${mono ? "font-mono" : ""}`} title={value}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <button type="button" onClick={copy} className="p-2 rounded-lg border bg-card hover:bg-muted shrink-0" title="Copy">
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/* ───────── Edit Tenant Dialog (rename + change owner email) ───────── */
function EditTenantDialog({ tenant, onClose, onSaved }: { tenant: TenantRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tenant.name);
  const [ownerEmail, setOwnerEmail] = useState(tenant.ownerEmail ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== tenant.name) body.name = name.trim();
    if (ownerEmail.trim().toLowerCase() !== (tenant.ownerEmail ?? "").toLowerCase()) {
      body.ownerEmail = ownerEmail.trim();
    }
    if (Object.keys(body).length === 0) { toast.info("No changes to save"); onClose(); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/platform/tenants/${tenant.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error || "Could not save changes");
        return;
      }
      toast.success("Tenant updated");
      onSaved();
    } catch { toast.error("Server unreachable"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border bg-card p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Pencil className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-black">Edit Tenant</h2>
            <p className="text-xs text-muted-foreground font-mono">{tenant.id}</p>
          </div>
        </div>

        <Field label="Shop Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <Field label="Owner Email" hint="Updates the owner's email login used at /login.">
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@shop.com"
            className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </Field>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border bg-card text-sm font-bold hover:bg-muted">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30 disabled:opacity-50">
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface TenantUserRow  { id: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string }
interface TenantStaffRow { id: string; name: string; role: string; isActive: boolean; createdAt: string }

/* ───────── View Users Dialog (email logins + PIN staff) ───────── */
function ViewUsersDialog({ tenant, onClose }: { tenant: TenantRow; onClose: () => void }) {
  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [staff, setStaff] = useState<TenantStaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/platform/tenants/${tenant.id}/users`, { credentials: "include" });
        if (!r.ok) { if (alive) toast.error("Could not load users"); return; }
        const d = await r.json();
        if (!alive) return;
        setUsers(Array.isArray(d.users) ? d.users : []);
        setStaff(Array.isArray(d.staff) ? d.staff : []);
      } catch { if (alive) toast.error("Could not load users"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [tenant.id]);

  const Badge = ({ active }: { active: boolean }) => active
    ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">Active</span>
    : <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">Off</span>;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-3xl border bg-card p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
              <Users className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black">{tenant.name}</h2>
              <p className="text-xs text-muted-foreground">Logins &amp; staff accounts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg border bg-card hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Email Logins ({users.length})</p>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No email logins.</p>
              ) : (
                <div className="rounded-2xl border divide-y">
                  {users.map((u) => (
                    <div key={u.id} className="px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono truncate" title={u.email}>{u.email}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-black uppercase tracking-wider">{u.role}</span>
                      <Badge active={u.isActive} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Staff (PIN) ({staff.length})</p>
              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff profiles.</p>
              ) : (
                <div className="rounded-2xl border divide-y">
                  {staff.map((s) => (
                    <div key={s.id} className="px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" title={s.name}>{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">Added {new Date(s.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-black uppercase tracking-wider">{s.role}</span>
                      <Badge active={s.isActive} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

interface AuditRow {
  id: string;
  action: string;
  actorEmail: string;
  targetTenant: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/* ───────── Audit Log Dialog (recent platform actions) ───────── */
function AuditLogDialog({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/platform/audit?limit=100`, { credentials: "include" });
        if (!r.ok) { if (alive) toast.error("Could not load audit log"); return; }
        const d = await r.json();
        if (alive) setEvents(Array.isArray(d.events) ? d.events : []);
      } catch { if (alive) toast.error("Could not load audit log"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-3xl border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
              <ScrollText className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black">Audit Log</h2>
              <p className="text-xs text-muted-foreground">Most recent platform actions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg border bg-card hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No audit events yet.</p>
          ) : (
            <div className="rounded-2xl border divide-y">
              {events.map((ev) => (
                <div key={ev.id} className="px-3 py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-black uppercase tracking-wider font-mono">{ev.action}</span>
                      {ev.targetTenant && <span className="text-[11px] text-muted-foreground font-mono truncate">→ {ev.targetTenant}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate" title={ev.actorEmail}>
                      {ev.actorEmail}{ev.ip ? ` · ${ev.ip}` : ""}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(ev.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
