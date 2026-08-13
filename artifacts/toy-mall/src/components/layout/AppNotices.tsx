/**
 * The shop-facing end of the vendor's control panel.
 *
 * Two separate things live here because they share one fetch:
 *
 *   1. Notices — messages the vendor pushes into this shop's app ("renewal due
 *      Friday", "maintenance tonight"). Shown as a banner above the app.
 *   2. The read-only support bar — shown when a vendor has opened this shop
 *      through "view as shop". Every write is refused server-side while that
 *      session is active, so without this bar a shopkeeper (or the vendor
 *      themselves) would be left staring at unexplained failures.
 *
 * Both are deliberately non-blocking: a failed fetch shows nothing rather than
 * taking the till down.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Megaphone, X, Eye, Loader2 } from "lucide-react";

type Level = "info" | "warning" | "critical";

interface Notice {
  id: string;
  title: string;
  body: string;
  level: Level;
}

interface NoticesResponse {
  notices: Notice[];
  viewAs: boolean;
}

const DISMISSED_KEY = "dismissedNotices";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const TONE: Record<Level, { wrap: string; icon: typeof Info }> = {
  info: {
    wrap: "bg-sky-500/10 text-sky-900 dark:text-sky-200 border-sky-500/30",
    icon: Info,
  },
  warning: {
    wrap: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/40",
    icon: AlertTriangle,
  },
  critical: {
    wrap: "bg-red-600 text-white border-red-700",
    icon: Megaphone,
  },
};

export function AppNotices() {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [exiting, setExiting] = useState(false);

  const { data } = useQuery<NoticesResponse>({
    queryKey: ["app-notices"],
    queryFn: async () => {
      const r = await fetch("/api/app/notices", { credentials: "include" });
      /* An error page is not JSON — parsing it would throw inside render. */
      if (!r.ok) throw new Error("notices unavailable");
      return r.json();
    },
    /* A notice switched on by the vendor should reach the counter without the
       shopkeeper reloading, but this is a banner: keep the polling cheap. */
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: false,
  });

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    /* Keep the list short — it only needs to cover notices still in flight. */
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50))); } catch { /* private mode */ }
  };

  const exitSupport = async () => {
    setExiting(true);
    try {
      await fetch("/api/platform/view-as/exit", { method: "POST", credentials: "include" });
    } catch { /* fall through to the reload either way */ }
    window.location.reload();
  };

  const visible = (data?.notices ?? []).filter(
    (n) => n.level === "critical" || !dismissed.includes(n.id),
  );

  if (!data?.viewAs && visible.length === 0) return null;

  return (
    <div className="no-print z-50">
      {data?.viewAs && (
        <div className="flex items-center justify-center gap-3 bg-violet-600 px-4 py-2 text-center text-xs font-bold text-white">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>Vendor support is viewing this shop. Nothing can be changed while this is on.</span>
          <button
            onClick={exitSupport}
            disabled={exiting}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/20 px-2 py-1 font-semibold transition-colors hover:bg-white/30 disabled:opacity-60"
          >
            {exiting && <Loader2 className="h-3 w-3 animate-spin" />}
            Exit
          </button>
        </div>
      )}

      {visible.map((n) => {
        const tone = TONE[n.level] ?? TONE.info;
        const Icon = tone.icon;
        return (
          <div key={n.id} className={`flex items-start gap-3 border-b px-4 py-2.5 text-sm ${tone.wrap}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight">{n.title}</p>
              <p className="mt-0.5 whitespace-pre-line leading-snug opacity-90">{n.body}</p>
            </div>
            {/* A critical notice cannot be dismissed — if it could, it would
                not be worth marking critical. */}
            {n.level !== "critical" && (
              <button
                onClick={() => dismiss(n.id)}
                aria-label={`Dismiss: ${n.title}`}
                className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
