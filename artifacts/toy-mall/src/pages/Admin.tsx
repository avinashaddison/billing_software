import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, KeyRound, Plus, Search, RefreshCw, Trash2, Copy, Check,
  Building2, Calendar, Tag, Sparkles, AlertTriangle, Lock, LogOut,
  Activity, CheckCircle2, XCircle, Clock, Infinity as InfinityIcon, Ban, Loader2,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const STORAGE_KEY = "counter-admin-pwd-v1";

interface LicenseRecord {
  id: string;
  shop: string;
  edition: string;
  expiry: string;
  issued: string;
  key: string;
  notes?: string;
  createdAt: string;
  revokedAt?: string | null;
  isRevoked: boolean;
  isExpired: boolean;
  isPerpetual: boolean;
  daysRemaining: number | null;
}

interface Stats {
  total: number; active: number; expired: number;
  expiringSoon: number; perpetual: number; revoked: number;
}

type Tab = "stats" | "generate" | "history" | "verify";

export default function AdminPage() {
  const [adminEnabled, setAdminEnabled] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState<string>(() => sessionStorage.getItem(STORAGE_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("stats");

  /* Check admin mode is enabled on this server */
  useEffect(() => {
    fetch(`${API}/admin/check-mode`)
      .then((r) => r.ok ? r.json() : { enabled: false })
      .then((d) => setAdminEnabled(!!d.enabled))
      .catch(() => setAdminEnabled(false));
  }, []);

  /* Auto-login if we have a saved password */
  useEffect(() => {
    if (!adminEnabled || !pwd) return;
    void tryLogin(pwd, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEnabled]);

  const tryLogin = async (password: string, silent = false) => {
    try {
      const r = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      if (r.ok) {
        sessionStorage.setItem(STORAGE_KEY, password);
        setPwd(password);
        setAuthed(true);
        setLoginError("");
        return true;
      }
      if (!silent) setLoginError("Wrong password");
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    } catch {
      if (!silent) setLoginError("Server unreachable");
      return false;
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPwd("");
    setAuthed(false);
  };

  if (adminEnabled === null) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminEnabled) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 px-6 text-center">
        <Ban className="w-12 h-12 text-muted-foreground" />
        <p className="text-sm font-black">Admin mode is not enabled on this server</p>
        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
          Set <code className="font-mono bg-muted px-1.5 py-0.5 rounded">ADMIN_PASSWORD</code> in the server's <code className="font-mono bg-muted px-1.5 py-0.5 rounded">.env</code> file and restart to enable the vendor admin panel. Customer installs should leave this unset.
        </p>
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onSubmit={tryLogin} error={loginError} />;
  }

  return <AdminDashboard pwd={pwd} tab={tab} setTab={setTab} onLogout={logout} />;
}

/* ───────────── Login Screen ───────────── */
function LoginScreen({ onSubmit, error }: { onSubmit: (pwd: string) => void; error: string }) {
  const [val, setVal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(val);
    setSubmitting(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="relative">
          <div aria-hidden className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-500 opacity-30 blur-2xl" />
          <div className="relative rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-md p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/40">
                <ShieldCheck className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Vendor Admin</h1>
                <p className="text-xs text-slate-400">Counter Billing license control</p>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Password</span>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  type="password"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  placeholder="Enter ADMIN_PASSWORD"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
                />
              </div>
            </label>

            {error && (
              <p className="mt-3 text-xs text-rose-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!val || submitting}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Sign In
            </button>

            <p className="text-[10px] text-slate-500 mt-4 text-center leading-relaxed">
              The password is the value of <span className="font-mono">ADMIN_PASSWORD</span> in your server's <span className="font-mono">.env</span>.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ───────────── Dashboard ───────────── */
function AdminDashboard({ pwd, tab, setTab, onLogout }: {
  pwd: string; tab: Tab; setTab: (t: Tab) => void; onLogout: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = { "x-admin-password": pwd, "Content-Type": "application/json" };

  const refresh = async () => {
    setLoading(true);
    try {
      const [statsR, listR] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers }),
        fetch(`${API}/admin/licenses`, { headers }),
      ]);
      if (statsR.ok) setStats(await statsR.json());
      if (listR.ok) setRecords((await listR.json()).records);
    } catch { toast.error("Could not load admin data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
              <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Vendor Admin</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Counter Billing · License Control</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="p-2 rounded-xl bg-card border hover:bg-muted transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onLogout} className="px-3 py-2 rounded-xl bg-card border text-xs font-bold flex items-center gap-1.5 hover:bg-muted">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex items-center gap-1 -mb-px overflow-x-auto">
          {([
            { id: "stats",    label: "Overview",  icon: Activity   },
            { id: "generate", label: "Generate",  icon: Plus       },
            { id: "history",  label: "History",   icon: Building2  },
            { id: "verify",   label: "Verify",    icon: Search     },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {tab === t.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        {tab === "stats"    && <StatsView stats={stats} loading={loading} />}
        {tab === "generate" && <GenerateView pwd={pwd} onCreated={refresh} setTab={setTab} />}
        {tab === "history"  && <HistoryView records={records} pwd={pwd} loading={loading} onChange={refresh} />}
        {tab === "verify"   && <VerifyView pwd={pwd} />}
      </div>
    </div>
  );
}

/* ───────────── Stats tab ───────────── */
function StatsView({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading || !stats) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  const cards = [
    { label: "Total Issued",   value: stats.total,        icon: KeyRound,    gradient: "from-violet-500 to-fuchsia-500" },
    { label: "Active",         value: stats.active,       icon: CheckCircle2, gradient: "from-emerald-500 to-teal-500" },
    { label: "Expiring ≤7d",   value: stats.expiringSoon, icon: Clock,       gradient: "from-amber-500 to-orange-500" },
    { label: "Expired",        value: stats.expired,      icon: XCircle,     gradient: "from-rose-500 to-red-500" },
    { label: "Lifetime",       value: stats.perpetual,    icon: InfinityIcon, gradient: "from-blue-500 to-cyan-500" },
    { label: "Revoked",        value: stats.revoked,      icon: Ban,         gradient: "from-slate-500 to-slate-700" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border bg-card p-4 relative overflow-hidden">
          <div aria-hidden className={`absolute -top-8 -right-8 w-20 h-20 rounded-full bg-gradient-to-br ${c.gradient} opacity-10 blur-xl`} />
          <div className={`relative inline-flex w-9 h-9 rounded-xl bg-gradient-to-br ${c.gradient} items-center justify-center text-white shadow-lg`}>
            <c.icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums">{c.value}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Generate tab ───────────── */
function GenerateView({ pwd, onCreated, setTab }: { pwd: string; onCreated: () => void; setTab: (t: Tab) => void }) {
  const [shop, setShop]       = useState("");
  const [expiry, setExpiry]   = useState("");
  const [perpetual, setPerpetual] = useState(false);
  const [notes, setNotes]     = useState("");
  const edition = "pro" as const;
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<LicenseRecord | null>(null);

  const submit = async () => {
    if (!shop.trim()) { toast.error("Shop name is required"); return; }
    if (!perpetual && !expiry) { toast.error("Pick an expiry date or tick lifetime"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/admin/licenses`, {
        method: "POST",
        headers: { "x-admin-password": pwd, "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop.trim(),
          expiry: perpetual ? "perpetual" : expiry,
          edition,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Failed"); return; }
      setGenerated(data.record);
      // Auto-copy to clipboard
      navigator.clipboard.writeText(data.record.key).catch(() => {});
      toast.success("License generated and copied to clipboard");
      onCreated();
    } catch { toast.error("Could not reach server"); }
    finally { setSubmitting(false); }
  };

  if (generated) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-3xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black">License Generated</h2>
              <p className="text-xs text-muted-foreground">For <b className="text-foreground">{generated.shop}</b> · {generated.edition} · {generated.expiry === "perpetual" ? "Lifetime" : `expires ${generated.expiry}`}</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-3 font-mono text-[11px] break-all leading-relaxed mb-3">
            {generated.key}
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton text={generated.key} label="Copy Key" />
            <button onClick={() => { setGenerated(null); setShop(""); setExpiry(""); setNotes(""); }}
              className="px-4 py-2 rounded-xl border bg-card text-xs font-bold hover:bg-muted">Generate another</button>
            <button onClick={() => setTab("history")}
              className="px-4 py-2 rounded-xl border bg-card text-xs font-bold hover:bg-muted">View history</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-3xl border bg-card p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-black">Generate License</h2>
            <p className="text-[11px] text-muted-foreground">Creates a signed key + saves it to your local registry.</p>
          </div>
        </div>

        <Field label="Shop Name" hint="Shows in the customer's License page as 'Issued To'">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={shop} onChange={(e) => setShop(e.target.value)}
              placeholder="e.g. Hira & Sons Gift Shop"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </Field>

        <Field label="Expiry">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="date" value={expiry} onChange={(e) => { setExpiry(e.target.value); if (e.target.value) setPerpetual(false); }}
                disabled={perpetual}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-muted/30 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50" />
            </div>
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${perpetual ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300" : "bg-card hover:bg-muted"}`}>
              <input type="checkbox" checked={perpetual} onChange={(e) => { setPerpetual(e.target.checked); if (e.target.checked) setExpiry(""); }} className="sr-only" />
              <InfinityIcon className="w-4 h-4" /> Lifetime
            </label>
          </div>
        </Field>

        <Field label="Edition">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-300 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/40">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-black text-violet-700 dark:text-violet-300">Pro</span>
            <span className="text-[10px] text-muted-foreground ml-auto">Single edition</span>
          </div>
        </Field>

        <Field label="Notes" hint="Private — visible only in your admin panel.">
          <div className="relative">
            <StickyNote className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="e.g. Paid ₹20,000 advance via UPI on 2026-05-09"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
        </Field>

        <button onClick={submit} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all active:scale-[0.98] disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Generate License
        </button>
      </div>
    </div>
  );
}

/* ───────────── History tab ───────────── */
function HistoryView({ records, pwd, loading, onChange }: {
  records: LicenseRecord[]; pwd: string; loading: boolean; onChange: () => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "revoked">("all");

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (q && !r.shop.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === "active"  && (r.isExpired || r.isRevoked)) return false;
      if (filter === "expired" && !r.isExpired) return false;
      if (filter === "revoked" && !r.isRevoked) return false;
      return true;
    });
  }, [records, q, filter]);

  const remove = async (id: string) => {
    if (!confirm("Delete this record from your local history? This cannot be undone.\n\n(The customer's already-installed key keeps working — you can only stop tracking it here.)")) return;
    try {
      const r = await fetch(`${API}/admin/licenses/${id}`, { method: "DELETE", headers: { "x-admin-password": pwd } });
      if (r.ok) { toast.success("Deleted from registry"); onChange(); } else toast.error("Failed");
    } catch { toast.error("Could not reach server"); }
  };

  const revoke = async (id: string) => {
    if (!confirm("Mark this license as revoked in your history?\n\nThis is just a vendor note — it does NOT remotely disable the customer's app. To actually stop them, generate a new short-expiry key or wait for expiry.")) return;
    try {
      const r = await fetch(`${API}/admin/licenses/${id}/revoke`, { method: "POST", headers: { "x-admin-password": pwd } });
      if (r.ok) { toast.success("Marked as revoked"); onChange(); } else toast.error("Failed");
    } catch { toast.error("Could not reach server"); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by shop name…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div className="flex gap-1 bg-card border rounded-xl p-1">
          {(["all", "active", "expired", "revoked"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>{f}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          {records.length === 0 ? "No licenses generated yet — create your first one in the Generate tab." : "No licenses match this filter."}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="divide-y">
            {filtered.map((r) => <LicenseRow key={r.id} r={r} onRevoke={revoke} onDelete={remove} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function LicenseRow({ r, onRevoke, onDelete }: {
  r: LicenseRecord; onRevoke: (id: string) => void; onDelete: (id: string) => void;
}) {
  const status = r.isRevoked
    ? { label: "Revoked", color: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300" }
    : r.isExpired
    ? { label: "Expired", color: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" }
    : r.isPerpetual
    ? { label: "Lifetime", color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" }
    : (r.daysRemaining ?? 0) <= 7
    ? { label: `${r.daysRemaining}d left`, color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" }
    : { label: `${r.daysRemaining}d left`, color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" };

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-sm truncate">{r.shop}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${status.color}`}>{status.label}</span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{r.edition}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Issued {r.issued}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.expiry === "perpetual" ? "Never expires" : `Expires ${r.expiry}`}</span>
          </div>
          {r.notes && <p className="text-[11px] text-muted-foreground mt-1.5 italic">"{r.notes}"</p>}
          <div className="mt-2 flex items-center gap-2">
            <CopyButton text={r.key} label="Copy Key" small />
            {!r.isRevoked && (
              <button onClick={() => onRevoke(r.id)}
                className="px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                <Ban className="w-3 h-3" /> Mark Revoked
              </button>
            )}
            <button onClick={() => onDelete(r.id)}
              className="px-2.5 py-1.5 rounded-lg border bg-card text-[11px] font-bold flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Verify tab ───────────── */
function VerifyView({ pwd }: { pwd: string }) {
  const [key, setKey] = useState("");
  const [result, setResult] = useState<null | { valid: boolean; reason?: string; payload?: { shop: string; expiry: string; issued: string; edition?: string }; isPerpetual?: boolean; isExpired?: boolean; daysRemaining?: number | null }>(null);
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    if (!key.trim()) return;
    setChecking(true);
    try {
      const r = await fetch(`${API}/admin/verify`, {
        method: "POST",
        headers: { "x-admin-password": pwd, "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      setResult(await r.json());
    } catch { toast.error("Could not reach server"); }
    finally { setChecking(false); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-3xl border bg-card p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
            <Search className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-black">Verify Key</h2>
            <p className="text-[11px] text-muted-foreground">Paste any key to inspect its decoded payload + signature validity.</p>
          </div>
        </div>
        <textarea value={key} onChange={(e) => setKey(e.target.value)} rows={3}
          placeholder="Paste a license key…"
          className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
        <button onClick={verify} disabled={checking || !key.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Verify
        </button>
      </div>

      {result && (
        <div className={`rounded-3xl border p-5 ${
          result.valid && !result.isExpired
            ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20"
            : "border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {result.valid ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-600" />}
            <h3 className="font-black">
              {result.valid
                ? (result.isExpired ? "Valid Signature — But Expired" : "Valid License")
                : "Invalid"}
            </h3>
          </div>
          {result.valid && result.payload ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shop</dt><dd className="font-bold">{result.payload.shop}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Edition</dt><dd className="font-bold">{result.payload.edition ?? "—"}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Issued</dt><dd className="font-bold">{result.payload.issued}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expiry</dt><dd className="font-bold">{result.payload.expiry}</dd></div>
              {result.daysRemaining != null && (
                <div className="col-span-2"><dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Days Remaining</dt><dd className={`font-black text-lg ${result.daysRemaining < 0 ? "text-rose-600" : result.daysRemaining < 8 ? "text-amber-600" : "text-emerald-600"}`}>{result.daysRemaining}</dd></div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-rose-700 dark:text-rose-300">{result.reason ?? "Not a valid license key"}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── Reusable bits ───────────── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CopyButton({ text, label, small }: { text: string; label: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error("Could not copy"));
  };
  const Icon = copied ? Check : Copy;
  return (
    <button onClick={copy}
      className={`${small ? "px-2.5 py-1.5 text-[11px]" : "px-4 py-2 text-xs"} rounded-xl border bg-card font-bold hover:bg-muted flex items-center gap-1.5 ${copied ? "text-emerald-600 border-emerald-300" : ""}`}>
      <Icon className={small ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {copied ? "Copied!" : label}
    </button>
  );
}
