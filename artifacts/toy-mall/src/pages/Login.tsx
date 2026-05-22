import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth, type StaffRole } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";
import {
  Loader2, Delete, ShieldCheck, ShieldAlert, Clock,
  Sparkles, ScanLine, Receipt, BarChart3, Zap, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useStoreSettings, usePerStaffScannerPrefs } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface StaffMember { id: string; name: string; role: string; isActive: boolean }

function PinDot({ filled }: { filled: boolean }) {
  return (
    <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
      filled
        ? "bg-gradient-to-br from-violet-500 to-cyan-400 border-transparent scale-110 shadow-lg shadow-violet-500/40"
        : "border-foreground/25"
    }`} />
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoggedIn } = useAuth();
  const store = useStoreSettings();

  const [staff, setStaff]           = useState<StaffMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<StaffMember | null>(null);
  const [pin, setPin]               = useState("");
  const [shaking, setShaking]       = useState(false);
  const [checking, setChecking]     = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil]   = useState<Date | null>(null);
  const [lockCountdown, setLockCountdown] = useState("");
  const lastDigitRef = useRef<number>(0);

  /* Redirect if already logged in */
  useEffect(() => {
    if (isLoggedIn) setLocation("/");
  }, [isLoggedIn, setLocation]);

  /* Load staff list */
  useEffect(() => {
    fetch(`${BASE_URL}/api/staff`)
      .then((r) => r.json())
      .then((data) => setStaff(data.filter((s: StaffMember) => s.isActive)))
      .catch(() => toast.error("Could not load staff list"))
      .finally(() => setLoading(false));
  }, []);

  /* Auto-submit when 4 digits entered */
  useEffect(() => {
    if (pin.length === 4 && selected) handleLogin();
  }, [pin]);

  /* Keyboard support for PIN entry */
  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (checking || !!lockedUntil) return;
      if (e.key >= "0" && e.key <= "9") { addDigit(e.key); }
      else if (e.key === "Backspace" || e.key === "Delete") { removeDigit(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, checking, lockedUntil, pin]);

  /* Lockout countdown ticker */
  useEffect(() => {
    if (!lockedUntil) { setLockCountdown(""); return; }
    const tick = () => {
      const ms = lockedUntil.getTime() - Date.now();
      if (ms <= 0) { setLockedUntil(null); setLockCountdown(""); setAttemptsLeft(null); return; }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setLockCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const addDigit = (d: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
  };

  const removeDigit = () => setPin((p) => p.slice(0, -1));

  const handleLogin = async () => {
    if (checking || !selected || lockedUntil) return;
    setChecking(true);
    try {
      const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selected.id, pin }),
      });
      const data = await r.json();

      if (r.status === 429) {
        setPin("");
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setAttemptsLeft(0);
        return;
      }

      if (!r.ok) {
        setPin("");
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        if (data.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft);
        else toast.error(data.message || data.error || "Incorrect PIN");
        return;
      }

      setAttemptsLeft(null);
      setLockedUntil(null);
      login({ id: data.id, name: data.name, role: data.role as StaffRole, permissions: data.permissions as Permissions });

      const pref = usePerStaffScannerPrefs.getState().getPref(data.id);
      if (pref) {
        useStoreSettings.getState().update({ scannerThresholdMs: pref.thresholdMs });
        toast.success(`Scanner set to ${pref.thresholdMs} ms (your saved preference)`);
      }

      setLocation("/");
    } catch {
      toast.error("Login failed. Check connection.");
      setPin("");
    } finally {
      setChecking(false);
    }
  };

  const keypad = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["","0","⌫"],
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5)  return "Working late?";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Good night";
  })();

  const features = [
    { Icon: ScanLine,  label: "Scan & Bill",     hint: "Bills in 3 seconds" },
    { Icon: Receipt,   label: "GST Invoices",    hint: "Print on 80mm thermal" },
    { Icon: BarChart3, label: "Live Reports",    hint: "Daily Telegram digest" },
    { Icon: Zap,       label: "Works Offline",   hint: "Auto-syncs when online" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">

      {/* ── ANIMATED AMBIENT BACKGROUND ─────────────────────────── */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Soft gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-background to-cyan-50 dark:from-violet-950/40 dark:via-background dark:to-cyan-950/40" />

        {/* Floating gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-400/30 blur-3xl animate-[float1_18s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-25%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tr from-cyan-400/40 to-blue-500/30 blur-3xl animate-[float2_22s_ease-in-out_infinite]" />
        <div className="absolute top-[40%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-bl from-amber-300/30 to-rose-400/30 blur-3xl animate-[float3_20s_ease-in-out_infinite]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── KEYFRAMES (scoped via global <style>) ─────────────── */}
      <style>{`
        @keyframes float1 {
          0%,100% { transform: translate(0, 0) scale(1); }
          50%     { transform: translate(6%, 8%) scale(1.05); }
        }
        @keyframes float2 {
          0%,100% { transform: translate(0, 0) scale(1); }
          50%     { transform: translate(-8%, -6%) scale(1.08); }
        }
        @keyframes float3 {
          0%,100% { transform: translate(0, 0) scale(1); }
          50%     { transform: translate(-5%, 6%) scale(1.06); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-8px); }
          40%,80% { transform: translateX(8px); }
        }
        @keyframes fadeUp {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      {/* ── PAGE LAYOUT ──────────────────────────────────────── */}
      <div className="relative min-h-screen flex flex-col lg:flex-row">

        {/* ╔═════════════════════════════════════════════════╗
            ║  LEFT — Brand panel (desktop) / Top bar (mobile) ║
            ╚═════════════════════════════════════════════════╝ */}
        <aside className="lg:flex-1 lg:flex lg:flex-col lg:justify-between px-6 py-8 lg:px-12 lg:py-14">

          {/* Top: brand mark */}
          <div className="flex items-center gap-3" style={{ animation: "fadeUp 600ms ease-out" }}>
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 flex items-center justify-center text-2xl shadow-lg shadow-violet-500/30">
                {store.logoEmoji}
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                {greeting}
              </p>
              <p className="text-sm font-bold leading-tight">{store.name}</p>
            </div>
          </div>

          {/* Middle: hero text + feature grid (desktop only) */}
          <div className="hidden lg:block max-w-xl mt-12" style={{ animation: "fadeUp 700ms 100ms ease-out backwards" }}>
            <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 mb-5">
              <Sparkles className="w-3 h-3" />
              Modern Retail · Indian SMB
            </p>
            <h1 className="text-6xl xl:text-7xl font-black tracking-tight leading-[0.95]">
              Run your shop
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent"
                    style={{ backgroundSize: "200% 100%", animation: "shimmer 6s linear infinite" }}>
                on autopilot.
              </span>
            </h1>
            <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
              Scan, bill, print, and report — all in one place. Built for cashiers
              who need to move fast and owners who need to know everything.
            </p>

            {/* Feature pills */}
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {features.map(({ Icon, label, hint }, i) => (
                <div
                  key={label}
                  className="group flex items-start gap-3 p-3 rounded-2xl border border-foreground/10 bg-card/60 backdrop-blur-sm hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
                  style={{ animation: `fadeUp 700ms ${200 + i * 80}ms ease-out backwards` }}
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-400/15 flex items-center justify-center text-violet-600 dark:text-violet-300 shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black leading-tight">{label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: developer credit (desktop only) */}
          <div className="hidden lg:flex items-center gap-2 mt-10 text-[11px] text-muted-foreground/70">
            <span className="font-bold uppercase tracking-[0.2em]">Developed by</span>
            <span className="font-black bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-wide">
              AddisonX Media
            </span>
          </div>
        </aside>

        {/* ╔═════════════════════════════════════════════════╗
            ║  RIGHT — Login glass card                         ║
            ╚═════════════════════════════════════════════════╝ */}
        <main className="flex-1 flex items-center justify-center px-4 pb-10 lg:px-8 lg:py-14">
          <div
            className="w-full max-w-md"
            style={{ animation: "fadeUp 600ms 80ms ease-out backwards" }}
          >

            {/* Glass card */}
            <div className="relative rounded-3xl border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-2xl shadow-violet-500/10 overflow-hidden">
              {/* Top sheen */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

              <div className="p-7 lg:p-8">

                {!selected ? (
                  /* ═════ Staff selection ═════ */
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-black tracking-tight">Welcome back</h2>
                      <p className="text-sm text-muted-foreground mt-1">Tap your name to sign in</p>
                    </div>

                    {staff.length === 0 ? (
                      <div className="text-center text-muted-foreground p-8 border border-dashed border-foreground/15 rounded-2xl">
                        <p className="font-bold">No staff accounts found</p>
                        <p className="text-sm mt-1">Contact your administrator</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {staff.map((s, i) => {
                          const isOwner = s.role === "owner";
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelected(s)}
                              className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-foreground/10 bg-background/40 hover:border-violet-500/50 hover:bg-violet-500/5 active:scale-[0.98] transition-all group"
                              style={{ animation: `fadeUp 500ms ${i * 60}ms ease-out backwards` }}
                            >
                              <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-base font-black text-white shadow-md shrink-0 ${
                                isOwner
                                  ? "bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 shadow-violet-500/30"
                                  : "bg-gradient-to-br from-slate-600 to-slate-500 shadow-slate-500/30"
                              }`}>
                                {s.name.slice(0, 2).toUpperCase()}
                                {isOwner && (
                                  <span className="absolute -top-1 -right-1 text-[10px]">👑</span>
                                )}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="font-black text-foreground truncate">{s.name}</p>
                                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                                  {isOwner ? "Owner" : "Staff"}
                                </p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  /* ═════ PIN entry ═════ */
                  <>
                    {/* Back + selected name */}
                    <div className="flex items-center gap-3 mb-6">
                      <button
                        onClick={() => { setSelected(null); setPin(""); setAttemptsLeft(null); setLockedUntil(null); }}
                        className="w-9 h-9 rounded-xl bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-muted-foreground transition-colors text-lg shrink-0"
                      >
                        ‹
                      </button>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 ${
                          selected.role === "owner"
                            ? "bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500"
                            : "bg-gradient-to-br from-slate-600 to-slate-500"
                        }`}>
                          {selected.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm leading-tight truncate">{selected.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                            {selected.role === "owner" ? "Owner" : "Staff"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                      Enter your 4-digit PIN
                    </p>

                    {/* Lock banner */}
                    {lockedUntil ? (
                      <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl text-center">
                        <p className="text-sm font-black text-red-700 dark:text-red-400">🔒 Account Locked</p>
                        <p className="text-[11px] text-red-600 dark:text-red-500 mt-0.5">
                          Too many wrong PINs. Try again in
                        </p>
                        <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-1 font-mono tabular-nums">{lockCountdown}</p>
                      </div>
                    ) : attemptsLeft !== null && (
                      <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          Wrong PIN · {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                        </p>
                      </div>
                    )}

                    {/* Dots */}
                    <div className={`flex justify-center gap-5 mb-6 ${shaking ? "animate-[shake_0.5s_ease]" : ""}`}>
                      {[0,1,2,3].map((i) => (
                        <PinDot key={i} filled={i < pin.length} />
                      ))}
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {keypad.flat().map((key, idx) => {
                        if (key === "") return <div key={idx} />;
                        const isDel = key === "⌫";
                        return (
                          <button
                            key={idx}
                            onClick={() => isDel ? removeDigit() : addDigit(key)}
                            disabled={checking || !!lockedUntil}
                            className={`h-14 rounded-2xl text-xl font-black transition-all active:scale-95 ${
                              isDel
                                ? "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                                : "bg-background/60 border border-foreground/10 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-violet-300 shadow-sm"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {isDel ? <Delete className="w-5 h-5 mx-auto" /> : key}
                          </button>
                        );
                      })}
                    </div>

                    {checking && (
                      <div className="flex items-center justify-center gap-2 mt-5 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                      </div>
                    )}
                    {!lockedUntil && !checking && pin.length === 0 && attemptsLeft === null && (
                      <p className="text-center text-[11px] text-muted-foreground mt-4">
                        Auto-submits after 4 digits
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* License badge */}
            <LicenseBadge />

            {/* Mobile-only developer credit (desktop has it in the brand panel) */}
            <div className="lg:hidden mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
              <span className="font-bold uppercase tracking-[0.2em]">By</span>
              <span className="font-black bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-wide">
                AddisonX Media
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ───── License status badge (silent when healthy + >7 days) ───── */
interface LicenseStatusResp {
  valid: boolean;
  mode: "licensed" | "trial" | "expired" | "invalid" | "trial_expired";
  shop: string | null;
  edition: string | null;
  expiry: string | null;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  reason: string | null;
}

function LicenseBadge() {
  const [s, setS] = useState<LicenseStatusResp | null>(null);
  useEffect(() => {
    fetch(`${BASE_URL}/api/license/status`)
      .then((r) => r.ok ? r.json() : null)
      .then(setS)
      .catch(() => { /* ignore — server unreachable, leave silent */ });
  }, []);

  if (!s) return null;

  if (s.mode === "licensed" && (s.expiry === "perpetual" || (s.daysRemaining ?? 0) > 7)) {
    return null;
  }

  const isError = !s.valid;
  const isWarn = s.mode === "trial" || (s.mode === "licensed" && (s.daysRemaining ?? 0) <= 7);

  const cls = isError
    ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
    : isWarn
    ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
    : "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";

  const Icon = isError ? ShieldAlert : isWarn ? Clock : ShieldCheck;
  const title =
    s.mode === "trial"         ? "Trial Mode" :
    s.mode === "trial_expired" ? "Trial ended" :
    s.mode === "expired"       ? "License expired" :
    s.mode === "invalid"       ? "License invalid" :
                                  "Licensed";
  const subtitle =
    s.mode === "trial" && s.daysRemaining != null
      ? `${s.daysRemaining} day${s.daysRemaining === 1 ? "" : "s"} remaining`
      : s.mode === "licensed" && s.daysRemaining != null
      ? `Renews in ${s.daysRemaining} day${s.daysRemaining === 1 ? "" : "s"}`
      : s.reason ?? "Contact your vendor";

  return (
    <div className={`mt-6 mx-auto max-w-xs px-3 py-2 rounded-2xl border flex items-center gap-2.5 backdrop-blur-sm ${cls}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black leading-tight">{title}</p>
        <p className="text-[10px] opacity-80 leading-tight truncate">{subtitle}</p>
      </div>
    </div>
  );
}
