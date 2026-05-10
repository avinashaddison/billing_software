import { useEffect, useState, useRef } from "react";
import {
  Sparkles, X, Loader2, CheckCircle2, AlertTriangle, Download,
  GitBranch, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const API = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api";

interface CheckResult {
  updateAvailable: boolean;
  currentSha:      string | null;
  remoteSha:       string | null;
  behindBy:        number;
  lastMessage:     string | null;
  checkedAt:       string;
  error?:          string;
}

type InstallStage = "idle" | "pulling" | "installing" | "schema" | "building" | "done" | "failed";
interface InstallState {
  stage: InstallStage; log: string; error?: string; started: string | null; ended: string | null;
}

const STAGE_LABEL: Record<InstallStage, string> = {
  idle:       "Ready",
  pulling:    "Pulling latest code…",
  installing: "Installing dependencies…",
  schema:     "Syncing database schema…",
  building:   "Building production bundle…",
  done:       "✓ Update complete",
  failed:     "✗ Update failed",
};

const POLL_MS = 5 * 60_000;            // background "is there an update" check
const STATUS_POLL_MS = 1500;           // while installing

/**
 * Sidenav pill that lights up when a new commit is on origin/main.
 * Click → modal showing details + "Update Now" button that runs the
 * full update.bat sequence on the server in the background.
 */
export function UpdateBanner() {
  const [check, setCheck]     = useState<CheckResult | null>(null);
  const [open, setOpen]       = useState(false);
  const [install, setInstall] = useState<InstallState | null>(null);
  const pollTimer             = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async (force = false) => {
    try {
      const r = await fetch(`${API}/updates/check${force ? "?force=1" : ""}`);
      if (r.ok) setCheck(await r.json());
    } catch { /* ignore — offline */ }
  };

  // Background check on mount and every 5 minutes
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // While modal is open and an install is running, poll status fast
  useEffect(() => {
    const isRunning = install && install.stage !== "idle" && install.stage !== "done" && install.stage !== "failed";
    if (!isRunning) {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
      return;
    }
    pollTimer.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/updates/status`);
        if (r.ok) setInstall(await r.json());
      } catch { /* ignore */ }
    }, STATUS_POLL_MS);
    return () => {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };
  }, [install?.stage]);

  const startInstall = async () => {
    if (!confirm("Update the app now?\n\nThis takes 2-5 minutes. Billing will keep working during the update; you'll just need to close all running windows and re-launch start.bat afterwards to load the new code.")) return;
    try {
      const r = await fetch(`${API}/updates/install`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Could not start update"); return; }
      setInstall(data.state);
    } catch { toast.error("Could not reach server"); }
  };

  if (!check?.updateAvailable && !open) return null;

  return (
    <>
      {check?.updateAvailable && (
        <button
          onClick={() => setOpen(true)}
          className="group w-full mb-2 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border border-emerald-500/30 hover:from-emerald-500/25 hover:via-teal-500/25 hover:to-cyan-500/25 transition-colors flex items-center gap-2 text-left"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 leading-tight">
              {check.behindBy} update{check.behindBy === 1 ? "" : "s"} available
            </p>
            <p className="text-[9px] text-emerald-700/70 dark:text-emerald-400/70 leading-tight truncate">Tap to install</p>
          </div>
        </button>
      )}

      {open && check && (
        <UpdateModal
          check={check}
          install={install}
          onClose={() => setOpen(false)}
          onStartInstall={startInstall}
          onRefresh={() => refresh(true)}
        />
      )}
    </>
  );
}

/* ───── Modal ───── */
function UpdateModal({ check, install, onClose, onStartInstall, onRefresh }: {
  check: CheckResult;
  install: InstallState | null;
  onClose: () => void;
  onStartInstall: () => void;
  onRefresh: () => void;
}) {
  const isRunning = install && install.stage !== "idle" && install.stage !== "done" && install.stage !== "failed";
  const isDone    = install?.stage === "done";
  const isFailed  = install?.stage === "failed";
  const stageLabel = install ? STAGE_LABEL[install.stage] : "Ready";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={isRunning ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white p-5">
          <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/40">
              <Download className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black">Update Available</h2>
              <p className="text-xs opacity-90 mt-0.5">
                {check.behindBy} new commit{check.behindBy === 1 ? "" : "s"} on origin/main
              </p>
            </div>
            {!isRunning && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Version chips */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex-1 rounded-xl border bg-muted/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Installed</p>
              <p className="font-mono font-bold flex items-center gap-1.5"><GitBranch className="w-3 h-3" />{check.currentSha ?? "—"}</p>
            </div>
            <div className="flex-1 rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Latest</p>
              <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5"><GitBranch className="w-3 h-3" />{check.remoteSha ?? "—"}</p>
            </div>
          </div>

          {check.lastMessage && (
            <div className="rounded-xl bg-muted/30 border p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Latest change</p>
              <p className="text-sm font-bold">{check.lastMessage}</p>
            </div>
          )}

          {/* Install state */}
          {install && (
            <div className={`rounded-xl border p-3 ${
              isFailed ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              : isDone ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" /> :
                 isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> :
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                <p className="text-xs font-black">{stageLabel}</p>
              </div>
              {install.log && (
                <pre className="max-h-32 overflow-y-auto text-[10px] font-mono leading-relaxed text-muted-foreground bg-background/60 rounded-lg p-2 whitespace-pre-wrap break-all">
                  {install.log.slice(-1500)}
                </pre>
              )}
              {isDone && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    ⚠️ Restart needed to load new code:
                  </p>
                  <ol className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 ml-4 list-decimal space-y-0.5">
                    <li>Close the "Billing Server" and "Billing Tunnel" windows</li>
                    <li>Double-click <code className="font-mono bg-background/50 px-1 rounded">start.bat</code></li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!isRunning && !isDone && (
              <button
                onClick={onStartInstall}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all active:scale-[0.98]"
              >
                <Download className="w-4 h-4" /> Update Now
              </button>
            )}
            {!isRunning && (
              <button
                onClick={onRefresh}
                className="px-4 py-3 rounded-xl border bg-card text-xs font-bold hover:bg-muted flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-check
              </button>
            )}
            {!isRunning && (
              <button
                onClick={onClose}
                className="px-4 py-3 rounded-xl border bg-card text-xs font-bold hover:bg-muted"
              >
                Close
              </button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Updates are pulled from the GitHub repository. Billing keeps working during the install — you only need to restart at the end.
          </p>
        </div>
      </div>
    </div>
  );
}
