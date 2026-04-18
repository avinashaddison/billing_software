/* ── Inactivity auto-logout ───────────────────────────────────────
   Logs the user out after 30 minutes of no interaction.
   Shows a warning toast at the 25-minute mark.
──────────────────────────────────────────────────────────────── */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./use-auth";

const INACTIVE_LIMIT_MS  = 30 * 60 * 1000;  // 30 minutes
const WARN_BEFORE_MS     = 5  * 60 * 1000;  // warn at 25 minutes
const CHECK_INTERVAL_MS  = 30 * 1000;        // check every 30 s

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export function useInactivityLogout() {
  const logout       = useAuth((s) => s.logout);
  const isLoggedIn   = useAuth((s) => s.isLoggedIn);
  const lastActivity = useRef<number>(Date.now());
  const warnedRef    = useRef(false);
  const toastIdRef   = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (!isLoggedIn) return;

    function resetTimer() {
      lastActivity.current = Date.now();
      warnedRef.current    = false;
      if (toastIdRef.current !== undefined) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
      }
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current;

      if (idle >= INACTIVE_LIMIT_MS) {
        clearInterval(interval);
        logout();
        toast.warning("You were logged out due to inactivity.", { duration: 6000 });
        return;
      }

      if (!warnedRef.current && idle >= INACTIVE_LIMIT_MS - WARN_BEFORE_MS) {
        warnedRef.current = true;
        const remaining   = Math.ceil((INACTIVE_LIMIT_MS - idle) / 60_000);
        toastIdRef.current = toast.warning(
          `⏱ You'll be logged out in ${remaining} minute${remaining !== 1 ? "s" : ""} due to inactivity.`,
          { duration: WARN_BEFORE_MS, id: "inactivity-warn" }
        );
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isLoggedIn, logout]);
}
