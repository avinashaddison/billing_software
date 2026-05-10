import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldAlert, KeyRound, ArrowRight, Loader2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface LicenseStatus {
  valid: boolean;
  mode: "licensed" | "trial" | "expired" | "invalid" | "trial_expired";
  reason: string | null;
}

/**
 * Polls /api/license/status every 60s. When the license is invalid AND the
 * user is NOT on the License or Login page, render a full-screen lockout
 * overlay instead of the children. Owners can click through to /license to
 * activate a key; staff see "ask the owner".
 */
export function LicenseLockout({ children }: { children: React.ReactNode }) {
  const [status, setStatus]   = useState<LicenseStatus | null>(null);
  const [location, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/license/status`);
        if (r.ok && !cancelled) setStatus(await r.json());
      } catch { /* keep prior */ }
      finally { if (!cancelled) setChecking(false); }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Pages that must remain accessible regardless of license state
  const isExempt = location === "/license" || location.startsWith("/login");

  // Exempt routes always render — even before the first status check, so the
  // user can always reach /license to enter a key.
  if (isExempt) return <>{children}</>;

  // Until we've heard back once, show a quiet loading screen instead of
  // letting children fire API requests that may hit a license-required 402
  // and crash on bad-shape responses.
  if (checking || !status) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status.valid) return <>{children}</>;

  const titles: Record<LicenseStatus["mode"], string> = {
    licensed:      "Licensed",
    trial:         "Trial",
    trial_expired: "Trial Has Ended",
    expired:       "License Expired",
    invalid:       "License Invalid",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-6">
      <div className="relative max-w-md w-full">
        {/* Glow */}
        <div aria-hidden className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 opacity-30 blur-2xl" />

        <div className="relative bg-card border-2 border-red-200 dark:border-red-900 rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-rose-500 via-red-500 to-orange-500" />
          <div className="p-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-2xl shadow-red-500/30 ring-4 ring-background mb-5">
              <ShieldAlert className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-foreground">{titles[status.mode]}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {status.reason ?? "A valid license key is required to continue using Counter Billing."}
            </p>

            <button
              onClick={() => setLocation("/license")}
              className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all active:scale-[0.98]"
            >
              <KeyRound className="w-4 h-4" />
              Enter License Key
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[10px] text-muted-foreground/70 mt-4 leading-relaxed">
              Don't have a key? Email <a href="mailto:addisonxmedia@gmail.com" className="text-primary font-bold">addisonxmedia@gmail.com</a> with your shop name.
            </p>
          </div>

          <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Auto-checks every minute
          </div>
        </div>
      </div>
    </div>
  );
}
