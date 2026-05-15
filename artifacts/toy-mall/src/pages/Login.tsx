import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth, type StaffRole } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";
import { Loader2, Delete, Mail, Lock, Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useStoreSettings, usePerStaffScannerPrefs } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface StaffMember { id: string; name: string; role: string; isActive: boolean }
interface EmailUser    { id: string; email: string; role: string; tenantId: string | null }

function PinDot({ filled }: { filled: boolean }) {
  return (
    <div className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${filled ? "bg-primary border-primary scale-110" : "border-muted-foreground/40"}`} />
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoggedIn } = useAuth();
  const store = useStoreSettings();

  /* Email-login state (step 1) */
  const [emailUser, setEmailUser]   = useState<EmailUser | null>(null);
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  /* Staff-list + PIN state (steps 2 + 3) */
  const [staff, setStaff]           = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
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
    if (isLoggedIn) setLocation("/dashboard");
  }, [isLoggedIn, setLocation]);

  /* Rehydrate the email-login step from the server cookie on mount, so a
     page refresh between Step 1 (email/password) and Step 3 (PIN) keeps
     the user at the staff-selection screen instead of bouncing them back
     to re-enter their password. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BASE_URL}/api/auth/me`);
        if (!r.ok) return;
        const me = await r.json();
        if (cancelled) return;
        if (me?.kind === "email" && me.id) {
          setEmailUser({ id: me.id, email: me.email, role: me.role, tenantId: me.tenantId ?? null });
          /* Cookie says we're already attached to a tenant — pull that
             tenant's settings (name/logo/etc.) so the picker shows the
             real shop branding instead of the persisted defaults. */
          void useStoreSettings.getState().hydrateFromServer();
        }
      } catch { /* offline — silently leave the email form visible */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Load staff list AFTER email login succeeds (server filters by tenant cookie) */
  useEffect(() => {
    if (!emailUser) return;
    setLoadingStaff(true);
    fetch(`${BASE_URL}/api/staff`)
      .then((r) => r.json())
      .then((data) => setStaff(Array.isArray(data) ? data.filter((s: StaffMember) => s.isActive) : []))
      .catch(() => toast.error("Could not load staff list"))
      .finally(() => setLoadingStaff(false));
  }, [emailUser]);

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

  /* ── Step 1: email + password login ─────────────────────────────── */
  const handleEmailLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submittingEmail) return;
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setEmailError("Enter your email and password");
      return;
    }
    setSubmittingEmail(true);
    setEmailError(null);
    try {
      const r = await fetch(`${BASE_URL}/api/auth/login-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        setEmailError(data?.error || "Invalid email or password");
        setPassword("");
        return;
      }
      setEmailUser({ id: data.id, email: data.email, role: data.role, tenantId: data.tenantId });
      setPassword("");
      /* Server cookie now scopes us to this tenant — re-fetch settings so
         the header switches from "Your Shop Name" to the real shop name
         before the user even picks their staff profile. */
      void useStoreSettings.getState().hydrateFromServer();
    } catch {
      setEmailError("Could not reach server. Check connection.");
    } finally {
      setSubmittingEmail(false);
    }
  };

  /* Reset back to the email step (e.g. "switch account"). Also clear the
     server-side session cookie so a subsequent refresh doesn't immediately
     re-enter the staff-selection step. */
  const exitEmail = () => {
    fetch(`${BASE_URL}/api/auth/logout`, { method: "POST" }).catch(() => { /* ignore */ });
    setEmailUser(null);
    setSelected(null);
    setStaff([]);
    setPin("");
    setAttemptsLeft(null);
    setLockedUntil(null);
    setEmailError(null);
  };

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
        /* Account locked */
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

      /* Success */
      setAttemptsLeft(null);
      setLockedUntil(null);
      login({ id: data.id, name: data.name, role: data.role as StaffRole, permissions: data.permissions as Permissions });

      /* Auto-apply saved scanner threshold for this staff member */
      const pref = usePerStaffScannerPrefs.getState().getPref(data.id);
      if (pref) {
        useStoreSettings.getState().update({ scannerThresholdMs: pref.thresholdMs });
        toast.success(`Scanner set to ${pref.thresholdMs} ms (your saved preference)`);
      }

      setLocation("/dashboard");
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

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-black dark:via-zinc-950 dark:to-zinc-900">
      {/* Apple-style ambient backdrop: two huge, soft, blurred radial glows */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-blue-400/20 dark:bg-blue-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-violet-400/20 dark:bg-violet-500/15 blur-3xl" />

      {/* Header — generic SaaS brand pre-login, tenant brand post-email-auth. */}
      <div className="relative mb-10 text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/25 ring-1 ring-black/5">
          <span className="text-3xl drop-shadow-sm">{emailUser ? store.logoEmoji : "⚡"}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {emailUser ? store.name : "AddisonX Software"}
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-zinc-400 mt-1">
          {emailUser ? (store.appSubtitle || "Billing & Inventory") : "Billing & Inventory"}
        </p>
      </div>

      {!emailUser ? (
        /* ── Step 1: Email + password — Apple-style glass card ── */
        <form
          onSubmit={handleEmailLogin}
          className="relative w-full max-w-[380px] rounded-[28px] border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.15)] p-6 space-y-3"
        >
          <p className="text-center text-[13px] text-slate-500 dark:text-zinc-400 mb-1">
            Sign in to your shop
          </p>

          {emailError && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-3 py-2.5 text-center">
              <p className="text-[13px] text-red-600 dark:text-red-400">{emailError}</p>
            </div>
          )}

          {/* Email field */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
            <input
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
              placeholder="Email Address"
              disabled={submittingEmail}
              className="w-full pl-11 pr-4 h-12 rounded-2xl bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all disabled:opacity-60"
            />
          </div>

          {/* Password field */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setEmailError(null); }}
              placeholder="Password"
              disabled={submittingEmail}
              className="w-full pl-11 pr-11 h-12 rounded-2xl bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submittingEmail}
            className="w-full h-12 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-medium text-[15px] tracking-[-0.01em] shadow-lg shadow-blue-500/30 ring-1 ring-blue-700/20 active:scale-[0.985] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
          >
            {submittingEmail ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Continue"}
          </button>
        </form>
      ) : !selected ? (
        /* ── Step 2: Staff selection — Apple list-card style ── */
        <div className="relative w-full max-w-[380px] space-y-3">
          {/* Signed-in pill */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-none">Signed in as</p>
                <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate mt-0.5">{emailUser.email}</p>
              </div>
            </div>
            <button
              onClick={exitEmail}
              className="text-[13px] text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity flex items-center gap-1 flex-shrink-0"
            >
              Switch
            </button>
          </div>

          <p className="text-center text-[13px] text-slate-500 dark:text-zinc-400 pt-2 pb-1">
            Who are you?
          </p>
          {loadingStaff ? (
            <div className="flex items-center justify-center p-10 text-slate-400 dark:text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-zinc-400 p-10 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
              <p className="text-[15px] font-medium text-slate-700 dark:text-zinc-300">No staff accounts found</p>
              <p className="text-[13px] mt-1">Contact your administrator</p>
            </div>
          ) : (
            /* Group as one rounded card with internal dividers — iOS Settings vibe */
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl overflow-hidden divide-y divide-black/5 dark:divide-white/10">
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] active:bg-black/[0.06] dark:active:bg-white/[0.08] transition-colors group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[13px] font-semibold text-white shadow-sm">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-[12px] text-slate-500 dark:text-zinc-400 capitalize">{s.role === "owner" ? "Owner" : "Staff"}</p>
                  </div>
                  <div className="text-slate-400 dark:text-zinc-500 text-xl group-hover:translate-x-0.5 transition-transform">›</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── PIN entry — Apple-style numeric keypad ── */
        <div className="relative w-full max-w-[300px]">
          {/* Back + user header */}
          <div className="flex items-center gap-3 mb-7">
            <button onClick={() => { setSelected(null); setPin(""); setAttemptsLeft(null); setLockedUntil(null); }}
              className="w-9 h-9 rounded-full bg-white/70 dark:bg-white/[0.06] border border-black/5 dark:border-white/10 hover:bg-white dark:hover:bg-white/[0.1] backdrop-blur-xl flex items-center justify-center text-slate-600 dark:text-zinc-300 transition-colors text-lg">
              ‹
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[12px] font-semibold text-white shadow-sm">
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[14px] font-medium text-slate-900 dark:text-white leading-none">{selected.name}</p>
                <p className="text-[12px] text-slate-500 dark:text-zinc-400 capitalize mt-0.5">{selected.role === "owner" ? "Owner" : "Staff"}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[13px] text-slate-500 dark:text-zinc-400 mb-5">Enter your passcode</p>

          {/* Lock / attempt-left banners */}
          {lockedUntil ? (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl text-center">
              <p className="text-[13px] font-medium text-red-700 dark:text-red-400">Account Locked</p>
              <p className="text-[12px] text-red-600/80 dark:text-red-500/80 mt-0.5">Too many wrong PINs. Try again in</p>
              <p className="text-2xl font-semibold text-red-700 dark:text-red-400 mt-1 font-mono tracking-tight">{lockCountdown}</p>
            </div>
          ) : attemptsLeft !== null && (
            <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-2xl text-center">
              <p className="text-[12px] text-amber-700 dark:text-amber-400">
                Wrong PIN — {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
              </p>
            </div>
          )}

          {/* PIN dots */}
          <div className={`flex justify-center gap-4 mb-8 ${shaking ? "animate-[shake_0.5s_ease]" : ""}`}>
            {[0,1,2,3].map((i) => (
              <PinDot
                key={i}
                filled={i < pin.length}
              />
            ))}
          </div>

          {/* iOS-style circular keypad */}
          <div className="grid grid-cols-3 gap-4">
            {keypad.flat().map((key, idx) => {
              if (key === "") return <div key={idx} />;
              return (
                <button
                  key={idx}
                  onClick={() => key === "⌫" ? removeDigit() : addDigit(key)}
                  disabled={checking || !!lockedUntil}
                  className={`h-16 w-16 mx-auto rounded-full text-2xl font-light tracking-tight transition-all active:scale-90 ${
                    key === "⌫"
                      ? "bg-transparent text-slate-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
                      : "bg-white/70 dark:bg-white/[0.06] border border-black/5 dark:border-white/10 hover:bg-white dark:hover:bg-white/[0.12] backdrop-blur-xl shadow-sm text-slate-900 dark:text-white"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {key === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : key}
                </button>
              );
            })}
          </div>

          {checking && (
            <div className="flex items-center justify-center gap-2 mt-5 text-[13px] text-slate-500 dark:text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
            </div>
          )}
          {!lockedUntil && !checking && pin.length === 0 && attemptsLeft === null && (
            <p className="text-center text-[12px] text-slate-400 dark:text-zinc-500 mt-5">
              Submits automatically after 4 digits
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="relative mt-12 flex flex-col items-center gap-1.5">
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

