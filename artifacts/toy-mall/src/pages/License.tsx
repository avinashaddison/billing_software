import { useState, useEffect } from "react";
import { KeyRound, ShieldCheck, ShieldAlert, Clock, Copy, RotateCcw, Building2, Tag, CalendarClock, Loader2, ChevronDown, ChevronUp, AlertTriangle, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface LicenseStatus {
  valid: boolean;
  mode: "licensed" | "trial" | "expired" | "invalid" | "trial_expired";
  shop: string | null;
  edition: string | null;
  expiry: string | null;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  reason: string | null;
}

const VENDOR_EMAIL = "addisonxmedia@gmail.com";

export default function LicensePage() {
  const [status, setStatus]       = useState<LicenseStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHelp, setShowHelp]   = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/license/status`);
      if (r.ok) setStatus(await r.json());
    } catch { /* server unreachable, status stays */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  // The actual key isn't returned by the status endpoint (it lives in .env on
  // the server). For convenience we expose a masked preview if the user pastes
  // their key into the textarea below — purely client-side.
  const maskKey = (key: string) => {
    if (!key || key.length < 16) return key;
    return key.slice(0, 12) + "…" + key.slice(-8);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API}/license/refresh`, { method: "POST" });
      await load();
      toast.success("License re-checked from .env");
    } catch {
      toast.error("Could not reach server");
    } finally {
      setRefreshing(false);
    }
  };

  const copyKey = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Could not copy"));
  };

  if (loading && !status) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-bold">Checking license…</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-amber-600 px-6 text-center">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm font-bold">License status unknown</p>
        <p className="text-xs text-muted-foreground">The server is unreachable. Check that the app is running and try again.</p>
        <button onClick={load} className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">Retry</button>
      </div>
    );
  }

  const isOk    = status.valid;
  const isWarn  = status.mode === "trial" || (status.mode === "licensed" && (status.daysRemaining ?? 99) <= 7);
  const isError = !isOk;

  const banner = isError
    ? { Icon: ShieldAlert, label: "License Not Valid", color: "from-red-500 via-rose-500 to-pink-500", textShadow: "shadow-rose-500/30" }
    : isWarn
    ? { Icon: Clock,       label: status.mode === "trial" ? "Trial Mode" : "Renewal Due Soon", color: "from-amber-500 via-orange-500 to-red-500", textShadow: "shadow-orange-500/30" }
    : { Icon: ShieldCheck, label: "Licensed",          color: "from-emerald-500 via-green-500 to-teal-500", textShadow: "shadow-emerald-500/30" };

  const modeLabels: Record<LicenseStatus["mode"], string> = {
    licensed:      "Active license",
    trial:         "Free trial",
    expired:       "License has expired",
    invalid:       "Invalid license key",
    trial_expired: "Trial period has ended",
  };

  const trialMaxDays = 14;
  const trialUsed    = status.mode === "trial" && status.daysRemaining != null
    ? Math.max(0, trialMaxDays - status.daysRemaining)
    : null;
  const trialPct = trialUsed != null ? Math.min(100, Math.round((trialUsed / trialMaxDays) * 100)) : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" /> License
          </h1>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-muted/70 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Re-check
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 md:max-w-3xl space-y-5">

        {/* Hero status banner */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${banner.color} text-white p-6 shadow-lg ${banner.textShadow}`}>
          <div aria-hidden className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 ring-2 ring-white/30">
              <banner.Icon className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-black leading-tight drop-shadow">{banner.label}</p>
              <p className="text-sm opacity-90 mt-0.5">{modeLabels[status.mode]}</p>
              {status.reason && (status.mode === "expired" || status.mode === "invalid" || status.mode === "trial_expired") && (
                <p className="text-xs mt-2 px-2.5 py-1 rounded-lg bg-white/20 inline-block">{status.reason}</p>
              )}
            </div>
          </div>
        </div>

        {/* Trial progress bar — only when in trial */}
        {status.mode === "trial" && trialPct != null && status.daysRemaining != null && (
          <div className="bg-card border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Trial Progress</p>
              <p className="text-xs font-bold">
                <span className={status.daysRemaining <= 3 ? "text-red-600" : "text-amber-600"}>{status.daysRemaining}</span>
                <span className="text-muted-foreground"> / {trialMaxDays} days left</span>
              </p>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  status.daysRemaining <= 3
                    ? "bg-gradient-to-r from-red-500 to-rose-500"
                    : "bg-gradient-to-r from-amber-400 to-orange-500"
                }`}
                style={{ width: `${trialPct}%` }}
              />
            </div>
            {status.trialEndsAt && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                <CalendarClock className="w-3 h-3" />
                Trial ends {new Date(status.trialEndsAt).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* Detail cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DetailCard icon={Building2} label="Issued To" value={status.shop ?? "— (trial mode)"} />
          <DetailCard icon={Tag}       label="Edition"  value={status.edition ?? "—"} />
          <DetailCard
            icon={CalendarClock}
            label="Expiry"
            value={
              status.expiry === "perpetual"
                ? "Never (perpetual)"
                : status.expiry
                ? new Date(status.expiry).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                : status.trialEndsAt
                ? `${new Date(status.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} (trial)`
                : "—"
            }
          />
          <DetailCard
            icon={Clock}
            label="Days Remaining"
            value={
              status.expiry === "perpetual"
                ? "∞"
                : status.daysRemaining != null
                ? `${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"}`
                : "—"
            }
            highlight={status.daysRemaining != null && status.daysRemaining <= 7}
          />
        </div>

        {/* License key inspector */}
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">License Key</p>
            <p className="text-[11px] text-muted-foreground">
              The active key lives in the server's <span className="font-mono bg-muted px-1 rounded">.env</span> file.
              Paste it below to preview the masked form & verify it matches what you sent the customer — it never leaves this browser.
            </p>
          </div>
          <textarea
            value={licenseKey ?? ""}
            onChange={(e) => setLicenseKey(e.target.value)}
            rows={3}
            placeholder="Paste a license key to inspect (optional)…"
            className="w-full px-3 py-2 rounded-xl border bg-muted/30 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          {licenseKey && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border">
              <code className="flex-1 text-xs font-mono truncate">{maskKey(licenseKey)}</code>
              <button
                onClick={() => copyKey(licenseKey)}
                className="p-1.5 rounded-lg hover:bg-background transition-colors"
                title="Copy key"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Help / How-to */}
        <div className="bg-card border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              How to update or renew your license
            </span>
            {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHelp && (
            <div className="px-4 pb-4 space-y-3 text-xs text-muted-foreground border-t bg-muted/20 leading-relaxed">
              <Step n={1} title="Get a license key">
                Email the vendor at <a href={`mailto:${VENDOR_EMAIL}`} className="text-primary font-bold underline">{VENDOR_EMAIL}</a> with your shop name to request a key (or a renewal).
              </Step>
              <Step n={2} title="Open the .env file on this PC">
                On the cashier PC, open <code className="font-mono bg-background px-1 rounded">C:\Counter\.env</code> in Notepad.
              </Step>
              <Step n={3} title="Paste the key">
                Find the line that starts with <code className="font-mono bg-background px-1 rounded">LICENSE_KEY=</code> and replace its value with the new key (keep the quotes).
              </Step>
              <Step n={4} title="Re-check from this page">
                Save the file, then click the <b className="text-foreground">Re-check</b> button at the top of this page. The status above will refresh.
              </Step>
              <div className="pt-2 mt-3 border-t border-border/50 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                <a href={`mailto:${VENDOR_EMAIL}?subject=License%20Request%20-%20Counter%20Billing`} className="text-primary font-bold inline-flex items-center gap-1 hover:underline">
                  Contact vendor <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function DetailCard({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-card"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${highlight ? "bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className={`text-base font-black truncate ${highlight ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">{n}</div>
      <div className="flex-1">
        <p className="text-xs font-bold text-foreground mb-0.5">{title}</p>
        <div className="text-[11px]">{children}</div>
      </div>
    </div>
  );
}
