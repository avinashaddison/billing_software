import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth, type StaffRole } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";
import { Loader2, Delete, Mail, Lock, Eye, EyeOff, LogOut, Flame, MessageCircle, ArrowRight } from "lucide-react";
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
      .then((r) => (r.ok ? r.json() : []))
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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-[#fff8ee]">
      {/* Ambient saffron/rose backdrop (matches landing) */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 w-[560px] h-[560px] rounded-full bg-gradient-to-br from-amber-300/55 via-orange-400/45 to-rose-400/35 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-fuchsia-300/40 via-rose-300/40 to-orange-300/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.20]"
        style={{ backgroundImage: "radial-gradient(circle, #f97316 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div aria-hidden className="pointer-events-none absolute top-8  left-[10%] text-amber-400/50 text-3xl select-none rotate-12">✦</div>
      <div aria-hidden className="pointer-events-none absolute top-24 right-[8%] text-rose-400/40  text-5xl select-none">✦</div>
      <div aria-hidden className="pointer-events-none absolute bottom-24 right-[14%] text-orange-400/40 text-3xl select-none">✦</div>

      {/* Brand header — saffron logo tile + dukaan tagline */}
      <div className="relative mb-8 text-center">
        <div className="relative inline-block">
          <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-rose-400/40 via-orange-400/40 to-amber-300/40 blur-xl" />
          <div className="relative w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center text-white shadow-2xl shadow-orange-500/40 ring-4 ring-white">
            <span className="text-3xl drop-shadow-md">{emailUser ? store.logoEmoji : "⚡"}</span>
          </div>
        </div>
        <h1 className="mt-5 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
          {emailUser ? store.name : "Addison Bill Software"}
        </h1>
        <p className="text-[12px] font-black uppercase tracking-[0.18em] text-rose-600 mt-1">
          {emailUser ? (store.appSubtitle || "Billing & Inventory") : "दुकान का सॉफ्टवेयर"}
        </p>
      </div>

      {!emailUser ? (
        /* ── Step 1: Email + password — saffron card ───────────────── */
        <form
          onSubmit={handleEmailLogin}
          className="relative w-full max-w-[400px] rounded-[28px] border-2 border-orange-200 bg-white shadow-2xl shadow-orange-900/10 p-6 md:p-7 space-y-3.5"
        >
          {/* Sticker — "Made in Bharat" */}
          <div className="absolute -top-3.5 -right-3 rotate-[6deg]">
            <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-xl shadow-lg ring-2 ring-white text-[10px] font-black tracking-widest">
              MADE IN BHARAT 🇮🇳
            </div>
          </div>

          <p className="text-center text-[13px] font-bold text-rose-600 uppercase tracking-[0.18em]">
            दुकान में login करें
          </p>

          {emailError && (
            <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 px-3 py-2.5 text-center">
              <p className="text-[13px] font-bold text-rose-700">{emailError}</p>
            </div>
          )}

          {/* Email field */}
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Email</span>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
              <input
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="aap@dukaan.com"
                disabled={submittingEmail}
                className="w-full pl-11 pr-4 h-12 rounded-2xl bg-orange-50/40 border-2 border-orange-100 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 focus:bg-white transition-all disabled:opacity-60"
              />
            </div>
          </label>

          {/* Password field */}
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Password</span>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setEmailError(null); }}
                placeholder="••••••••"
                disabled={submittingEmail}
                className="w-full pl-11 pr-11 h-12 rounded-2xl bg-orange-50/40 border-2 border-orange-100 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 focus:bg-white transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={submittingEmail}
            className="group w-full h-12 rounded-2xl bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white font-black text-[15px] shadow-xl shadow-rose-500/40 ring-2 ring-white hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 relative overflow-hidden">
            {/* Shimmer sweep */}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            {submittingEmail ? <><Loader2 className="w-4 h-4 animate-spin relative" /><span className="relative">Signing in…</span></> : <><span className="relative">Continue</span><ArrowRight className="w-4 h-4 relative group-hover:translate-x-1 transition-transform" /></>}
          </button>

          {/* WhatsApp helper */}
          <a href="https://wa.me/919142647797?text=Hi%20Addison%20Bill%2C%20login%20issue%20hai"
            target="_blank" rel="noreferrer"
            className="block text-center pt-1 text-[12px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
            <MessageCircle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            Login में दिक्कत? WhatsApp पर बात करें
          </a>
        </form>
      ) : !selected ? (
        /* ── Step 2: Staff selection — kirana-counter list card ───── */
        <div className="relative w-full max-w-[400px] space-y-3">
          {/* Signed-in pill */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border-2 border-orange-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none">Signed in as</p>
                <p className="text-[13px] font-bold text-slate-900 truncate mt-0.5">{emailUser.email}</p>
              </div>
            </div>
            <button
              onClick={exitEmail}
              className="text-[12px] font-black text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 flex-shrink-0 uppercase tracking-wider"
            >
              <LogOut className="w-3.5 h-3.5" />
              Switch
            </button>
          </div>

          <p className="text-center text-[12px] font-black uppercase tracking-[0.18em] text-rose-600 pt-2 pb-1">
            कौन हैं आप?
          </p>
          {loadingStaff ? (
            <div className="flex items-center justify-center p-10 text-orange-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center text-slate-600 p-10 border-2 border-dashed border-orange-200 rounded-2xl bg-white">
              <p className="text-[15px] font-black text-slate-800">No staff accounts found</p>
              <p className="text-[13px] mt-1">Contact your administrator</p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-orange-200 bg-white shadow-lg overflow-hidden divide-y-2 divide-orange-100">
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-orange-50 active:bg-orange-100 transition-colors group text-left"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center text-[13px] font-black text-white shadow-md ring-2 ring-white">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-slate-900 truncate">{s.name}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">{s.role === "owner" ? "Owner · मालिक" : "Staff · कर्मचारी"}</p>
                  </div>
                  <div className="text-orange-400 text-2xl group-hover:translate-x-0.5 group-hover:text-rose-600 transition-all">›</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── PIN entry — saffron keypad ───────────────────────────── */
        <div className="relative w-full max-w-[320px]">
          {/* Back + user header */}
          <div className="flex items-center gap-3 mb-7">
            <button onClick={() => { setSelected(null); setPin(""); setAttemptsLeft(null); setLockedUntil(null); }}
              className="w-10 h-10 rounded-full bg-white border-2 border-orange-200 hover:border-rose-400 hover:bg-orange-50 flex items-center justify-center text-rose-600 transition-colors text-xl font-black">
              ‹
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center text-[12px] font-black text-white shadow-md ring-2 ring-white">
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[15px] font-black text-slate-900 leading-none">{selected.name}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 mt-1">
                  {selected.role === "owner" ? "Owner · मालिक" : "Staff · कर्मचारी"}
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-[12px] font-black uppercase tracking-[0.18em] text-rose-600 mb-5">
            4-digit PIN डालें
          </p>

          {/* Lock / attempt-left banners */}
          {lockedUntil ? (
            <div className="mb-5 p-3.5 bg-rose-50 border-2 border-rose-200 rounded-2xl text-center">
              <p className="text-[13px] font-black text-rose-700">Account Locked</p>
              <p className="text-[11px] text-rose-600/80 mt-0.5">गलत PIN बहुत बार · थोड़ी देर रुकें</p>
              <p className="text-3xl font-black text-rose-700 mt-1 font-mono tracking-tight">{lockCountdown}</p>
            </div>
          ) : attemptsLeft !== null && (
            <div className="mb-4 p-2.5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-center">
              <p className="text-[12px] font-bold text-amber-700">
                Wrong PIN · {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} बचे हैं
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

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {keypad.flat().map((key, idx) => {
              if (key === "") return <div key={idx} />;
              return (
                <button
                  key={idx}
                  onClick={() => key === "⌫" ? removeDigit() : addDigit(key)}
                  disabled={checking || !!lockedUntil}
                  className={`h-16 w-16 mx-auto rounded-full text-2xl font-black tracking-tight transition-all active:scale-90 ${
                    key === "⌫"
                      ? "bg-transparent text-rose-500 hover:bg-rose-50"
                      : "bg-white border-2 border-orange-200 hover:border-rose-400 hover:bg-orange-50 shadow-md text-slate-900"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {key === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : key}
                </button>
              );
            })}
          </div>

          {checking && (
            <div className="flex items-center justify-center gap-2 mt-5 text-[13px] font-bold text-rose-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
            </div>
          )}
          {!lockedUntil && !checking && pin.length === 0 && attemptsLeft === null && (
            <p className="text-center text-[11px] text-slate-500 mt-5 font-medium">
              4 digits के बाद auto submit होगा
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="relative mt-10 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-orange-200 backdrop-blur-sm">
          <Flame className="w-3 h-3 text-rose-600" />
          <span className="text-[11px] font-bold text-slate-700">Made in Bharat · with</span>
          <span className="text-[11px] font-black bg-gradient-to-r from-rose-600 via-orange-600 to-amber-500 bg-clip-text text-transparent">
            Addison Bill Media
          </span>
        </div>
      </div>
    </div>
  );
}

