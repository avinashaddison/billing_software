import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RefreshCw, Eye } from "lucide-react";
import { dailyBookApi, pendingWrite, retryPendingWrite, type PendingWrite } from "@/lib/daily-book-api";
import { useAuth } from "@/hooks/use-auth";

export const inputCls =
  "w-full h-11 px-3 rounded-xl bg-muted/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50";
export const labelCls = "text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block";

function snap(): { pending: PendingWrite | null; error: string | null } {
  try { return { pending: pendingWrite(), error: null }; }
  catch (e) { return { pending: null, error: (e as Error).message }; }
}

interface Ctx {
  staffId: string | null;
  pending: PendingWrite | null;
  pendingError: string | null;
  readOnly: boolean;
  busy: boolean;
  blocked: boolean;
  recovered: number;
  run: (fn: () => Promise<unknown>, okMessage: string) => Promise<boolean>;
  retry: () => Promise<void>;
}
const DbCtx = createContext<Ctx | null>(null);
export function useDb(): Ctx {
  const c = useContext(DbCtx);
  if (!c) throw new Error("DailyBookProvider missing");
  return c;
}

export function DailyBookProvider({ children }: { children: ReactNode }) {
  const staffId = useAuth((s) => s.staffId);
  const qc = useQueryClient();
  const [state, setState] = useState(snap);
  const [busy, setBusy] = useState(false);
  const [recovered, setRecovered] = useState(0);
  const busyRef = useRef(false);

  const notices = useQuery<{ viewAs: boolean }>({
    queryKey: ["app-notices"],
    queryFn: async () => {
      const r = await fetch("/api/app/notices", { credentials: "include" });
      if (!r.ok) throw new Error("notices unavailable");
      return r.json();
    },
    refetchInterval: 120_000, staleTime: 60_000, retry: false,
  });
  const readOnly = !!notices.data?.viewAs;

  const settle = useCallback(() => {
    setState(snap());
    void qc.invalidateQueries({ queryKey: ["daily-book"] });
  }, [qc]);

  const run = useCallback(async (fn: () => Promise<unknown>, okMessage: string) => {
    const s = snap();
    if (busyRef.current) return false;
    if (s.pending || s.error) { setState(s); toast.error("Resolve the pending save first."); return false; }
    if (readOnly) { toast.error("Read-only support session. Nothing can be changed."); return false; }
    busyRef.current = true; setBusy(true);
    try { await fn(); toast.success(okMessage); return true; }
    catch (e) { toast.error((e as Error).message || "Could not save."); return false; }
    finally { busyRef.current = false; setBusy(false); settle(); }
  }, [readOnly, settle]);

  const retry = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await retryPendingWrite(); toast.success("Pending save confirmed."); setRecovered((n) => n + 1); }
    catch (e) { toast.error((e as Error).message || "Retry failed."); }
    finally { busyRef.current = false; setBusy(false); settle(); }
  }, [settle]);

  const blocked = busy || !!state.pending || !!state.error || readOnly;
  return (
    <DbCtx.Provider value={{ staffId, pending: state.pending, pendingError: state.error, readOnly, busy, blocked, recovered, run, retry }}>
      {children}
    </DbCtx.Provider>
  );
}

export function PendingBanner() {
  const { pending, pendingError, retry, busy, readOnly } = useDb();
  return (
    <>
      {readOnly && (
        <div className="flex items-center gap-2 rounded-2xl bg-violet-500/10 border border-violet-500/30 px-3 py-2 text-xs font-bold text-violet-700 dark:text-violet-300" data-testid="banner-readonly">
          <Eye className="w-4 h-4 shrink-0" /> Read-only support session. Saving is switched off.
        </div>
      )}
      {(pending || pendingError) && (
        <div role="alert" className="rounded-2xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 animate-in fade-in slide-in-from-top-1" data-testid="banner-pending">
          <p className="flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {pending ? `Save not confirmed: ${pending.label}` : "Pending save unreadable"}
          </p>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
            {pending
              ? "The server may or may not have received it. Retry sends the exact same request, so it cannot create a duplicate. New changes stay locked until this is confirmed."
              : pendingError}
          </p>
          {pending && (
            <button type="button" onClick={() => void retry()} disabled={busy || readOnly} data-testid="button-retry-pending"
              className="h-10 px-4 rounded-xl bg-amber-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-transform">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Retry original save
            </button>
          )}
        </div>
      )}
    </>
  );
}

const opts = { staleTime: 15_000, refetchInterval: 30_000, refetchOnWindowFocus: true } as const;
export function useNotes() {
  const { staffId } = useDb();
  return useQuery({ queryKey: ["daily-book", staffId, "notes"], queryFn: ({ signal }) => dailyBookApi.notes(signal), ...opts });
}
export function useAccounts() {
  const { staffId } = useDb();
  return useQuery({ queryKey: ["daily-book", staffId, "accounts"], queryFn: ({ signal }) => dailyBookApi.accounts(signal), ...opts });
}
export function useEntries(id: string | null) {
  const { staffId } = useDb();
  return useQuery({
    queryKey: ["daily-book", staffId, "entries", id], enabled: !!id,
    queryFn: ({ signal }) => dailyBookApi.entries(id as string, signal), ...opts,
  });
}

export function QueryGate<T>({ q, what, children }: { q: UseQueryResult<T>; what: string; children: (data: T) => ReactNode }) {
  if (q.isPending) {
    return (
      <div className="space-y-2" data-testid={`state-loading-${what}`}>
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />)}
      </div>
    );
  }
  if (q.data === undefined) {
    return (
      <div className="rounded-2xl border border-rose-300/60 bg-rose-50 dark:bg-rose-950/20 p-6 text-center space-y-2" data-testid={`state-error-${what}`}>
        <p className="font-black text-rose-700 dark:text-rose-300">Could not load {what}</p>
        <p className="text-xs text-muted-foreground">{(q.error as Error | null)?.message}</p>
        <button type="button" onClick={() => void q.refetch()} className="h-10 px-4 rounded-xl border bg-card text-sm font-bold inline-flex items-center gap-2" data-testid={`button-retry-${what}`}>
          <RefreshCw className={`w-4 h-4 ${q.isFetching ? "animate-spin" : ""}`} /> Retry
        </button>
      </div>
    );
  }
  return (
    <>
      {q.isError && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-200" data-testid={`banner-stale-${what}`}>
          <span className="flex-1">Showing older {what}. Refresh failed.</span>
          <button type="button" onClick={() => void q.refetch()} className="underline">Retry</button>
        </div>
      )}
      {children(q.data)}
    </>
  );
}

export function Empty({ title, hint, tone = "amber" }: { title: string; hint: string; tone?: "amber" | "emerald" }) {
  return (
    <div className={`rounded-2xl border border-dashed p-8 text-center ${tone === "amber" ? "border-amber-400/50 bg-amber-500/5" : "border-emerald-400/50 bg-emerald-500/5"}`}>
      <p className="font-black text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

export function fmtDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
