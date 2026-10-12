import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  ManualAccessApiError, manualAccessApi, currentManualApproval, saveManualApproval, clearManualApproval,
  type ManualKeyState,
} from "@/lib/manual-access-api";

/* ═══ Staff-side: gate + key prompt ═══════════════════════════════ */

export type ManualGrant = { token: string | null } | null;

function KeyPromptDialog({ busy, error, onSubmit, onCancel }: {
  busy: boolean; error: string; onSubmit: (key: string) => void; onCancel: () => void;
}) {
  // Key lives only in this component; it unmounts (wipes) on cancel/close/success.
  const [key, setKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { inputRef.current?.focus(); return () => setKey(""); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Tab") {
        const fields = Array.from(formRef.current?.querySelectorAll<HTMLElement>("input:not(:disabled),button:not(:disabled)") ?? []);
        const first = fields[0], last = fields.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!busy && key.trim()) onSubmit(key.trim()); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <form ref={formRef} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="manual-key-title" autoComplete="off"
        className="w-full max-w-full md:max-w-sm bg-card rounded-t-3xl md:rounded-3xl border shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="manual-key-title" className="text-lg font-black flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500 shrink-0" /> Manual billing key
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ask the owner for the current key to bill a manual item.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Cancel"
            className="w-8 h-8 shrink-0 rounded-full bg-muted flex items-center justify-center disabled:opacity-40">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <label htmlFor="manual-key-input" className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Access key</label>
          <input id="manual-key-input" ref={inputRef} type="password" value={key} disabled={busy}
            onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="off"
            aria-invalid={error ? true : undefined} aria-describedby={error ? "manual-key-error" : undefined}
            data-testid="input-manual-access-key"
            className="w-full h-12 px-3.5 rounded-xl bg-muted border border-border font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400" />
          {error && <p id="manual-key-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400" data-testid="text-manual-key-error">{error}</p>}
        </div>
        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={busy}
            className="py-3.5 rounded-2xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={busy || !key.trim()} data-testid="button-manual-key-submit"
            className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking</> : <><ShieldCheck className="w-4 h-4" /> Approve</>}
          </button>
        </div>
      </form>
    </div>
  );
}

export function useManualBillingGate() {
  const staffId = useAuth((s) => s.staffId);
  const generation = useAuth((s) => s.sessionGeneration);
  const role = useAuth((s) => s.role);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ resolve: (g: ManualGrant) => void } | null>(null);

  const cancel = useCallback(() => {
    pending.current?.resolve(null);
    pending.current = null;
    setOpen(false); setBusy(false); setError("");
  }, []);
  // Runs on auth change and on unmount.
  useEffect(() => cancel, [staffId, generation, cancel]);

  const ensureAccess = useCallback(async (opts: { validate: boolean }): Promise<ManualGrant> => {
    const a0 = useAuth.getState();
    if (a0.role === "owner") return { token: null };
    if (!a0.isLoggedIn) return null;
    const sId = a0.staffId, gen = a0.sessionGeneration;
    const same = () => { const a = useAuth.getState(); return a.staffId === sId && a.sessionGeneration === gen && a.role !== "owner"; };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Manual billing needs an internet connection for staff.");
      return null;
    }
    const existing = currentManualApproval();
    if (existing) {
      if (!opts.validate) return { token: existing.approvalToken };
      try {
        const r = await manualAccessApi.validate(existing.approvalToken);
        if (!same()) return null;
        if (r.valid) return { token: existing.approvalToken };
        clearManualApproval();
      } catch (e) {
        if (!same()) return null;
        if (e instanceof ManualAccessApiError && e.status >= 400 && e.status < 500) clearManualApproval();
        else { toast.error("Could not verify manual billing access. Try again online."); return null; }
      }
    }
    pending.current?.resolve(null);
    return new Promise<ManualGrant>((resolve) => {
      const p = {
        resolve: (g: ManualGrant) => resolve(g),
      };
      pending.current = p;
      setError(""); setBusy(false); setOpen(true);
    });
  }, []);

  const submitKey = useCallback(async (key: string) => {
    const p = pending.current;
    if (!p) return;
    const a0 = useAuth.getState();
    const sId = a0.staffId, gen = a0.sessionGeneration;
    setBusy(true); setError("");
    try {
      const r = await manualAccessApi.approve(key);
      const a = useAuth.getState();
      if (pending.current !== p || a.staffId !== sId || a.sessionGeneration !== gen) return;
      saveManualApproval(r);
      pending.current = null;
      setOpen(false); setBusy(false);
      p.resolve({ token: r.approvalToken });
    } catch (e) {
      if (pending.current !== p) return;
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not verify the key. Try again.");
    }
  }, []);

  const gate: ReactNode = open
    ? <KeyPromptDialog busy={busy} error={error} onSubmit={submitKey} onCancel={cancel} />
    : null;

  return { gate, ensureAccess, isOwner: role === "owner", clearGrant: clearManualApproval, cancel };
}

/* ═══ Owner-side: key panel ═══════════════════════════════════════ */

export function ManualBillingKeyPanel() {
  const qc = useQueryClient();
  const staffId = useAuth((s) => s.staffId);
  const generation = useAuth((s) => s.sessionGeneration);
  const role = useAuth((s) => s.role);
  const isOwner = role === "owner";
  const queryKey = ["manual-billing-key", staffId, generation] as const;
  const [shown, setShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const q = useQuery<ManualKeyState>({
    queryKey, queryFn: manualAccessApi.current, enabled: isOwner,
    staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: true, refetchInterval: 15_000,
  });
  const regen = useMutation({
    mutationFn: manualAccessApi.regenerate,
    onSuccess: async (data) => {
      // An older polling response must not overwrite the newly generated key.
      await qc.cancelQueries({ queryKey });
      const a = useAuth.getState();
      if (a.role !== "owner" || a.staffId !== staffId || a.sessionGeneration !== generation) return;
      qc.setQueryData(queryKey, data);
      setConfirming(false); setShown(true); setActionError("");
    },
    onError: (e) => {
      const a = useAuth.getState();
      if (a.role === "owner" && a.staffId === staffId && a.sessionGeneration === generation)
        setActionError(e instanceof Error ? e.message : "Could not generate a key.");
    },
  });

  useEffect(() => () => { qc.removeQueries({ queryKey: ["manual-billing-key"] }); }, [qc]);
  useEffect(() => { if (!isOwner) qc.removeQueries({ queryKey: ["manual-billing-key"] }); }, [isOwner, qc]);

  if (!isOwner) return null;
  const key = q.data?.currentKey ?? null;
  const copy = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopyMsg("Copied");
      setTimeout(() => setCopyMsg(""), 2000);
    } catch {
      setCopyMsg("Copy failed. Show the key and copy it by hand.");
    }
  };

  return (
    <section className="bg-card border rounded-2xl p-4 space-y-3" aria-labelledby="manual-key-panel-title" data-testid="panel-manual-billing-key">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 id="manual-key-panel-title" className="text-sm font-black">Manual billing key</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Staff need this key for every manual bill. You bill without it.
          </p>
        </div>
      </div>

      {q.isLoading && <div className="h-11 rounded-xl bg-muted animate-pulse" aria-busy="true" />}
      {q.isError && (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 space-y-2">
          <p>{q.error instanceof Error ? q.error.message : "Could not load the current key."}</p>
          <button type="button" onClick={() => void q.refetch()} data-testid="button-manual-key-retry"
            className="inline-flex items-center gap-1.5 font-bold underline"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}
      {q.isSuccess && (key ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-muted border flex items-center font-mono text-sm tracking-wider overflow-x-auto whitespace-nowrap"
            data-testid="text-manual-current-key" aria-live="polite">
            {shown ? key : "\u2022".repeat(Math.min(key.length, 16))}
          </div>
          <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? "Hide key" : "Show key"} aria-pressed={shown}
            data-testid="button-manual-key-toggle"
            className="w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center hover:bg-muted">
            {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button type="button" onClick={copy} aria-label="Copy key" data-testid="button-manual-key-copy"
            className="w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center hover:bg-muted">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground rounded-xl border border-dashed p-3">No key yet. Generate one to let staff bill manual items.</p>
      ))}
      {copyMsg && <p role="status" className="text-xs font-medium text-muted-foreground">{copyMsg}</p>}
      {q.data?.generatedAt && !Number.isNaN(Date.parse(q.data.generatedAt)) && (
        <p className="text-[11px] text-muted-foreground">Generated {new Date(q.data.generatedAt).toLocaleString("en-IN")}</p>
      )}
      {actionError && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{actionError}</p>}

      {confirming ? (
        <div role="alertdialog" aria-labelledby="manual-regen-title" className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
          <p id="manual-regen-title" className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            {key ? "The previous key stops working immediately, and every staff approval not yet used on a bill is revoked." : "This creates the key staff will use for manual bills."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={regen.isPending}
              className="py-2.5 rounded-xl border text-xs font-bold disabled:opacity-50">Keep current</button>
            <button type="button" onClick={() => { setActionError(""); regen.mutate(); }} disabled={regen.isPending}
              data-testid="button-manual-key-confirm"
              className="py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
              {regen.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {key ? "Regenerate now" : "Generate now"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setActionError(""); setConfirming(true); }} data-testid="button-manual-key-generate"
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" /> {key ? "Regenerate key" : "Generate key"}
        </button>
      )}
    </section>
  );
}
