import { useEffect } from "react";
import { useAuth } from "./use-auth";
import { OWNER_IDLE_MS, ownerActivityKey, ownerIsIdle } from "@/lib/owner-idle";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useOwnerIdle() {
  const { isLoggedIn, role, staffId, sessionGeneration } = useAuth();
  useEffect(() => {
    if (!isLoggedIn || role !== "owner" || !staffId) return;
    const key = ownerActivityKey(staffId);
    let last = Number(localStorage.getItem(key)) || Date.now();
    localStorage.setItem(key, String(last));
    let lastSent = 0;
    let warned = false;
    let stopped = false;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const sameOwner = () => {
      const auth = useAuth.getState();
      return (
        !stopped &&
        auth.isLoggedIn &&
        auth.role === "owner" &&
        auth.staffId === staffId &&
        auth.sessionGeneration === sessionGeneration
      );
    };
    const expire = () => {
      if (!sameOwner()) return;
      // Start server revocation before clearing the local state. A failed
      // request cannot extend the session: server idle expiry still applies.
      void fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
      useAuth.getState().logout();
      toast.info("Signed out after 10 minutes of inactivity.");
    };
    const check = () => {
      if (!sameOwner()) return;
      last = Math.max(last, Number(localStorage.getItem(key)) || 0);
      if (ownerIsIdle(last)) {
        expire();
        return;
      }
      if (!warned && Date.now() - last >= OWNER_IDLE_MS - 60_000) {
        warned = true;
        toast.warning(
          "Owner session will sign out in 1 minute. Touch or type to stay signed in.",
        );
      }
    };
    const send = async () => {
      pending = undefined;
      if (!sameOwner()) return;
      lastSent = Date.now();
      try {
        const response = await fetch(`${BASE}/api/auth/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idleForMs: Math.max(0, Date.now() - last) }),
        });
        if (response.status === 401 && sameOwner()) expire();
      } catch {
        /* offline: local idle deadline still applies */
      }
    };
    const interact = (event: Event) => {
      if (!event.isTrusted || !sameOwner() || document.hidden) return;
      check(); // An interaction after the deadline must not revive the owner.
      if (!sameOwner()) return;
      last = Date.now();
      warned = false;
      localStorage.setItem(key, String(last));
      if (Date.now() - lastSent >= 30_000) {
        void send();
      } else if (!pending)
        pending = setTimeout(
          () => {
            void send();
          },
          30_000 - (Date.now() - lastSent),
        );
    };
    const events = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "pointermove",
      "touchmove",
    ] as const;
    events.forEach((event) =>
      window.addEventListener(event, interact, { passive: true }),
    );
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 1_000);
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      if (pending) clearTimeout(pending);
      events.forEach((event) => window.removeEventListener(event, interact));
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [isLoggedIn, role, staffId, sessionGeneration]);
}
