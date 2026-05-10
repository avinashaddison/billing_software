import { useState, useEffect } from "react";
import {
  KeyRound, ShieldCheck, ShieldAlert, Clock, Copy, RotateCcw,
  Building2, Tag, CalendarClock, Loader2, AlertTriangle, Mail,
  Sparkles, CheckCircle2, XCircle, Trash2, Power,
} from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const VENDOR_EMAIL = "addisonxmedia@gmail.com";

interface LicenseStatus {
  valid: boolean;
  mode: "licensed" | "trial" | "expired" | "invalid" | "trial_expired";
  shop: string | null;
  edition: string | null;
  expiry: string | null;
  issued: string | null;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  reason: string | null;
}

const TRIAL_DAYS = 14;

export default function LicensePage() {
  const [status, setStatus]         = useState<LicenseStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyInput, setKeyInput]     = useState("");
  const [activating, setActivating] = useState(false);
  const [removing, setRemoving]     = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/license/status`);
      if (r.ok) setStatus(await r.json());
    } catch { /* keep prior */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API}/license/refresh`, { method: "POST" });
      await load();
      toast.success("License re-checked");
    } catch { toast.error("Could not reach server"); }
    finally { setRefreshing(false); }
  };

  const activate = async () => {
    const key = keyInput.trim();
    if (!key) { toast.error("Paste a license key first"); return; }
    setActivating(true);
    try {
      const r = await fetch(`${API}/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Activation failed"); return; }
      setKeyInput("");
      setStatus(data.status);
      toast.success("License activated!");
    } catch { toast.error("Could not reach server"); }
    finally { setActivating(false); }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      const r = await fetch(`${API}/license/remove`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Could not remove key"); return; }
      setStatus(data.status);
      setShowRemoveConfirm(false);
      toast.success("License key removed");
    } catch { toast.error("Could not reach server"); }
    finally { setRemoving(false); }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(VENDOR_EMAIL)
      .then(() => toast.success("Vendor email copied"))
      .catch(() => { /* ignore */ });
  };

  if (loading && !status) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">Checking license…</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm font-black">License status unknown</p>
        <p className="text-xs text-muted-foreground max-w-sm">Server unreachable — check your connection.</p>
        <button onClick={load} className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">Retry</button>
      </div>
    );
  }

  const isLicensed = status.mode === "licensed";
  const isTrial    = status.mode === "trial";
  const isError    = !status.valid;
  const isExpiringSoon = isLicensed && (status.daysRemaining ?? 99) <= 7;

  // Theme tokens — premium feel: subtle surfaces, single accent gradient
  const theme = isError
    ? { gradient: "from-rose-500 via-red-500 to-orange-500", soft: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900", text: "text-red-700 dark:text-red-300", accent: "text-red-600", Icon: ShieldAlert }
    : isTrial
    ? { gradient: "from-amber-400 via-orange-500 to-rose-500", soft: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900", text: "text-amber-700 dark:text-amber-300", accent: "text-amber-600", Icon: Clock }
    : isExpiringSoon
    ? { gradient: "from-amber-400 via-orange-400 to-yellow-500", soft: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900", text: "text-amber-700 dark:text-amber-300", accent: "text-amber-600", Icon: Clock }
    : { gradient: "from-emerald-400 via-teal-500 to-cyan-500", soft: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900", text: "text-emerald-700 dark:text-emerald-300", accent: "text-emerald-600", Icon: ShieldCheck };

  const heroTitle = isError
    ? (status.mode === "trial_expired" ? "Trial ended" : status.mode === "expired" ? "License expired" : "License invalid")
    : isTrial ? "Free Trial" : isLicensed ? "Licensed" : "—";
  const heroSubtitle = isError
    ? (status.reason ?? "Activate a license key below to continue using the platform.")
    : isTrial && status.daysRemaining != null
    ? `${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"} remaining`
    : isLicensed
    ? `Issued to ${status.shop ?? "this shop"}`
    : "";

  const trialUsed    = isTrial && status.daysRemaining != null ? Math.max(0, TRIAL_DAYS - status.daysRemaining) : null;
  const trialPct     = trialUsed != null ? Math.min(100, Math.round((trialUsed / TRIAL_DAYS) * 100)) : null;

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <div className="px-4 md:px-8 py-4 border-b sticky top-0 bg-background/95 backdrop-blur-md z-10">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
            <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-lg shadow-primary/20`}>
              <KeyRound className="w-4.5 h-4.5" />
            </span>
            License
          </h1>
          <button onClick={refresh} disabled={refreshing}
            className="px-3 py-2 rounded-xl border bg-card text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-muted transition-colors disabled:opacity-50">
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Re-check
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* ── Premium Hero Card ── */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
            {/* Animated gradient ribbon at the top */}
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.gradient}`} />
            {/* Soft ambient blob */}
            <div aria-hidden className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${theme.gradient} opacity-[0.08] blur-3xl`} />
            <div aria-hidden className={`absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-gradient-to-br ${theme.gradient} opacity-[0.06] blur-3xl`} />

            <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5">
              {/* Status emblem */}
              <div className="shrink-0 self-start">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${theme.gradient} blur-xl opacity-50`} />
                  <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-2xl ring-4 ring-background`}>
                    <theme.Icon className="w-10 h-10" strokeWidth={2.5} />
                  </div>
                  {isLicensed && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center ring-4 ring-background">
                      <Sparkles className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-black tracking-tight text-foreground">{heroTitle}</p>
                  {isLicensed && status.edition && (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black uppercase tracking-wider">{status.edition}</span>
                  )}
                </div>
                <p className={`text-sm font-semibold mt-1 ${theme.text}`}>{heroSubtitle}</p>

                {/* Trial progress bar */}
                {isTrial && trialPct != null && status.daysRemaining != null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trial Usage</span>
                      <span className="text-[11px] font-bold tabular-nums">{trialUsed} / {TRIAL_DAYS} days</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} transition-all duration-700`} style={{ width: `${trialPct}%` }} />
                    </div>
                  </div>
                )}

                {/* Days remaining counter for licensed */}
                {isLicensed && status.daysRemaining != null && (
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className={`text-4xl font-black tabular-nums ${isExpiringSoon ? "text-amber-600" : "text-emerald-600"}`}>{status.daysRemaining}</span>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">days remaining</span>
                  </div>
                )}
                {isLicensed && status.expiry === "perpetual" && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-xs font-black tracking-wide">Lifetime License</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Activate New Key (always shown) ── */}
          <div className="rounded-3xl border bg-card overflow-hidden">
            <div className="p-5 md:p-6 border-b bg-gradient-to-br from-muted/40 to-muted/0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Power className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-black">{isLicensed ? "Replace License Key" : "Activate License Key"}</h2>
                  <p className="text-[11px] text-muted-foreground">Paste the key from your vendor email and click Activate.</p>
                </div>
              </div>
            </div>
            <div className="p-5 md:p-6 space-y-3">
              <textarea
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                rows={3}
                placeholder="eyJzaG9wIjoiU2hvcCBOYW1lIi…"
                className="w-full px-4 py-3 rounded-2xl border bg-muted/30 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={activate}
                  disabled={activating || !keyInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {activating ? "Activating…" : "Activate"}
                </button>
                {keyInput && (
                  <button
                    onClick={() => setKeyInput("")}
                    className="px-4 py-3 rounded-2xl border bg-card text-muted-foreground hover:bg-muted text-sm font-bold flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── License Details (only when licensed) ── */}
          {isLicensed && (
            <div className="rounded-3xl border bg-card overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b">
                <h2 className="text-sm font-black">License Details</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
                <DetailCell icon={Building2}    label="Issued To" value={status.shop ?? "—"} />
                <DetailCell icon={Tag}          label="Edition"   value={status.edition ?? "—"} />
                <DetailCell icon={CalendarClock} label="Issued"   value={fmtDate(status.issued)} />
                <DetailCell icon={CalendarClock} label="Expires"  value={status.expiry === "perpetual" ? "Never" : fmtDate(status.expiry)} highlight={isExpiringSoon} />
              </div>
            </div>
          )}

          {/* ── Trial details ── */}
          {isTrial && (
            <div className={`rounded-3xl border ${theme.soft} p-5 md:p-6`}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className={`w-4 h-4 ${theme.accent}`} />
                <h2 className={`text-sm font-black ${theme.text}`}>Trial Information</h2>
              </div>
              <p className={`text-xs ${theme.text} opacity-90 leading-relaxed`}>
                You're using the free 14-day trial. After it ends the platform will lock until you activate a license key.
                {status.trialEndsAt && (
                  <> Trial ends on <span className="font-black">{fmtDate(status.trialEndsAt)}</span>.</>
                )}
              </p>
            </div>
          )}

          {/* ── Vendor contact + Remove section ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Get a key */}
            <div className="rounded-3xl border bg-card p-5 md:p-6 flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-black">Need a key?</h3>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Email the vendor with your shop name to request a new key or a renewal.
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border">
                <code className="flex-1 text-xs font-mono truncate">{VENDOR_EMAIL}</code>
                <button onClick={copyEmail} className="p-1.5 rounded-lg hover:bg-background transition-colors" title="Copy email">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <a
                href={`mailto:${VENDOR_EMAIL}?subject=License%20Request%20-%20Counter%20Billing`}
                className="text-center px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 transition-opacity"
              >
                Email Vendor
              </a>
            </div>

            {/* Remove */}
            {isLicensed && (
              <div className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 p-5 md:p-6 flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <h3 className="text-sm font-black text-red-700 dark:text-red-300">Remove License</h3>
                  </div>
                  <p className="text-[11px] text-red-700/80 dark:text-red-400/90 leading-relaxed">
                    The platform will lock immediately. Use this when retiring a key or moving to a new license.
                  </p>
                </div>

                {!showRemoveConfirm ? (
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-card text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                  >
                    Remove License Key
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={remove}
                      disabled={removing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Confirm Remove
                    </button>
                    <button
                      onClick={() => setShowRemoveConfirm(false)}
                      disabled={removing}
                      className="px-4 py-2.5 rounded-xl border bg-card text-muted-foreground text-xs font-bold hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-[10px] text-muted-foreground/60 pb-4">
            Counter Billing · License management
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailCell({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`p-4 ${highlight ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3 h-3 ${highlight ? "text-amber-600" : "text-muted-foreground"}`} />
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className={`text-sm font-black truncate ${highlight ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`} title={value}>{value}</p>
    </div>
  );
}
