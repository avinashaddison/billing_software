import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth, type StaffRole } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";
import { Loader2, Delete } from "lucide-react";
import { toast } from "sonner";
import { useStoreSettings } from "@/lib/store-info";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface StaffMember { id: string; name: string; role: string; isActive: boolean }

function PinDot({ filled }: { filled: boolean }) {
  return (
    <div className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${filled ? "bg-primary border-primary scale-110" : "border-muted-foreground/40"}`} />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/20">
          <span className="text-2xl">{store.logoEmoji}</span>
        </div>
        <h1 className="text-2xl font-black text-foreground">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{store.appSubtitle}</p>
      </div>

      {!selected ? (
        /* ── Staff selection ── */
        <div className="w-full max-w-sm space-y-3">
          <p className="text-center text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Who are you?
          </p>
          {staff.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 border border-dashed rounded-2xl">
              <p className="font-bold">No staff accounts found</p>
              <p className="text-sm mt-1">Contact your administrator</p>
            </div>
          ) : (
            staff.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full flex items-center gap-4 p-4 bg-card border rounded-2xl hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-black text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.role === "owner" ? "🔑 Owner" : "👤 Staff"}</p>
                </div>
                <div className="text-muted-foreground group-hover:text-primary transition-colors text-xl">›</div>
              </button>
            ))
          )}
        </div>
      ) : (
        /* ── PIN entry ── */
        <div className="w-full max-w-xs">
          {/* Back + user name */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSelected(null); setPin(""); setAttemptsLeft(null); setLockedUntil(null); }}
              className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-colors text-lg">
              ‹
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-black text-primary">
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-sm leading-none">{selected.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{selected.role === "owner" ? "Owner" : "Staff"}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-sm font-bold text-muted-foreground mb-5">Enter your 4-digit PIN</p>

          {/* Lock banner */}
          {lockedUntil ? (
            <div className="mb-5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl text-center">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">Account Locked</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                Too many wrong PINs. Try again in
              </p>
              <p className="text-2xl font-black text-red-700 dark:text-red-400 mt-1 font-mono">{lockCountdown}</p>
            </div>
          ) : attemptsLeft !== null && (
            <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Wrong PIN — {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout
              </p>
            </div>
          )}

          {/* Dots */}
          <div className={`flex justify-center gap-5 mb-8 ${shaking ? "animate-[shake_0.5s_ease]" : ""}`}>
            {[0,1,2,3].map((i) => (
              <PinDot
                key={i}
                filled={i < pin.length}
              />
            ))}
          </div>

          {/* Keypad — disabled while locked */}
          <div className="grid grid-cols-3 gap-3">
            {keypad.flat().map((key, idx) => {
              if (key === "") return <div key={idx} />;
              return (
                <button
                  key={idx}
                  onClick={() => key === "⌫" ? removeDigit() : addDigit(key)}
                  disabled={checking || !!lockedUntil}
                  className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
                    key === "⌫"
                      ? "bg-muted text-muted-foreground hover:bg-muted/70"
                      : "bg-card border hover:bg-muted shadow-sm text-foreground"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {key === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : key}
                </button>
              );
            })}
          </div>

          {checking && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
            </div>
          )}
          {!lockedUntil && !checking && pin.length === 0 && attemptsLeft === null && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              PIN submits automatically after 4 digits
            </p>
          )}
        </div>
      )}

      {/* Developer credit */}
      <div className="mt-10 flex flex-col items-center gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Developed by</p>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-500/20 bg-gradient-to-r from-violet-500/8 via-blue-500/8 to-cyan-500/8">
          <span className="text-sm">⚡</span>
          <span className="text-[13px] font-black bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-wide">
            AddisonX Media
          </span>
        </div>
      </div>
    </div>
  );
}
