import { useState, useRef, useEffect, useMemo } from "react";
import { useAdminBackups, useAdminTenantsLite, adminQueryKeys } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Loader2, Lock, Unlock, Copy, Check, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  PageHeader, SectionLabel, Panel, Rows, Row, Tag, Notice, EmptyState, LoadError, PanelSkeleton, formatDateTime,
  type Tone,
} from "./ui";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

/* ── Payload shapes (mirror src/routes/platform.ts GET /platform/backups) ── */
type BackupKind = "nightly" | "intraday" | "manual" | "safety";
interface BackupFile { key: string; filename: string; kind: "nightly" | "intraday"; sizeBytes: number; lastModified: string | null }
interface BackupRun {
  slot: string; kind: BackupKind; status: "running" | "ok" | "failed"; attempts: number; claimedBy: string | null;
  startedAt: string; finishedAt: string | null; r2Key: string | null; telegram: boolean; encrypted: boolean;
  sizeBytes: number | null; tables: number | null; totalRows: number | null; error: string | null;
}
interface Freshness { state: "ok" | "stale" | "unknown"; lastSuccessAt: string | null; lastKind: BackupKind | null; ageMinutes: number | null; thresholdMinutes: number }
interface BackupsPayload {
  r2Configured: boolean;
  telegramConfigured: boolean;
  encryption: { enabled: boolean; problem: string | null };
  backupHour: number;
  intradayEveryHours: number;
  intradayChoices: number[];
  nextNightly: string;
  monitorPath: string;
  freshness: Freshness | null;
  runs: BackupRun[];
  files: BackupFile[];
  listError?: string;
}
interface TenantPreview {
  tenantId: string; tenantName: string; backupDate: string | null; encrypted: boolean;
  tables: { table: string; live: number; snapshot: number; pinned: number }[];
  totalLive: number; totalSnapshot: number; totalPinned: number;
}

type Scope = "platform" | "tenant";

const KIND_LABEL: Record<BackupKind, string> = { nightly: "Nightly", intraday: "Intraday", manual: "Manual", safety: "Safety copy" };
const mb = (n: number | null | undefined) => `${((n ?? 0) / 1024 / 1024).toFixed(2)} MB`;

function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min ago`;
  return `${Math.floor(h / 24)} days ago`;
}

function intervalLabel(h: number): string {
  if (h === 0) return "Off — nightly only";
  if (h === 1) return "Every hour";
  return `Every ${h} hours`;
}

export default function Backups() {
  const { data: raw, isLoading, error } = useAdminBackups();
  const data = raw as BackupsPayload | undefined;
  const { data: tenantsData } = useAdminTenantsLite();
  const tenants = tenantsData?.tenants ?? [];
  const queryClient = useQueryClient();

  const [backingUp, setBackingUp] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  const [every, setEvery] = useState<number | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Restore-from-R2 dialog */
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  /* Restore-from-upload dialog */
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof data?.backupHour === "number") setHour(data.backupHour);
    if (typeof data?.intradayEveryHours === "number") setEvery(data.intradayEveryHours);
  }, [data?.backupHour, data?.intradayEveryHours]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminQueryKeys.backups });

  const backupNow = async () => {
    setBackingUp(true);
    const t = toast.loading("Backing up database…");
    try {
      const r = await fetch(`${API}/platform/backup`, { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.success(`Backup saved${d.encrypted ? " (encrypted)" : ""} — ${mb(d.sizeBytes)}`, { id: t });
        refresh();
      } else {
        toast.error(d.error || "Backup failed", { id: t });
      }
    } catch {
      toast.error("Server unreachable", { id: t });
    } finally {
      setBackingUp(false);
    }
  };

  const scheduleDirty = !!data && (hour !== data.backupHour || every !== data.intradayEveryHours);

  const saveSchedule = async () => {
    if (hour === null || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      toast.error("Pick an hour between 0 and 23");
      return;
    }
    setSavingSchedule(true);
    try {
      const body: Record<string, number> = {};
      if (data && hour !== data.backupHour) body.hour = Number(hour);
      if (data && every !== null && every !== data.intradayEveryHours) body.intradayEveryHours = every;
      const r = await fetch(`${API}/platform/backup-settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Could not save backup schedule"); return; }
      toast.success(`Schedule updated — next nightly ${d.nextNightly ?? ""}`.trim());
      refresh();
    } catch { toast.error("Server unreachable"); }
    finally { setSavingSchedule(false); }
  };

  const download = async (f: BackupFile) => {
    try {
      const r = await fetch(`${API}/platform/backups/download?key=${encodeURIComponent(f.key)}`, { credentials: "include" });
      if (!r.ok) { toast.error("Download failed"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = f.filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Server unreachable"); }
  };

  const monitorUrl = useMemo(() => {
    if (!data?.monitorPath || typeof window === "undefined") return "";
    return `${window.location.origin}${BASE}${data.monitorPath}`;
  }, [data?.monitorPath]);

  const copyMonitor = async () => {
    try {
      await navigator.clipboard.writeText(monitorUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Could not copy — select the URL and copy it manually"); }
  };

  if (isLoading || (!data && !error)) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Database backups" meta="Manage automated and manual backups" />
        <PanelSkeleton rows={2} header={true} />
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <PanelSkeleton rows={2} header={true} />
          <PanelSkeleton rows={2} header={true} />
        </div>
        <div className="mt-10">
          <PanelSkeleton rows={5} header={true} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Database backups" meta="Manage automated and manual backups" />
        <LoadError message={(error as Error)?.message} onRetry={refresh} />
      </div>
    );
  }

  const fresh = data.freshness;
  const freshTone: Tone = !fresh || fresh.state === "unknown" ? "neutral" : fresh.state === "ok" ? "positive" : "danger";
  const freshTitle = !fresh || fresh.state === "unknown"
    ? "No backup recorded yet"
    : fresh.state === "ok" ? "Up to date" : "Overdue";
  const lastRun = data.runs.find((r) => r.status === "ok") ?? null;
  const noDestination = !data.r2Configured && !data.telegramConfigured;

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Database backups" meta="Manage automated and manual backups" />

      {noDestination && (
        <div className="mb-8">
          <Notice tone="danger">
            <span className="font-semibold text-red-800">Backups have nowhere to go.</span> Neither Cloudflare R2 nor Telegram is configured on this server, so nothing is being saved.
          </Notice>
        </div>
      )}
      {data.encryption.problem && (
        <div className="mb-8">
          <Notice tone="danger">
            <span className="font-semibold text-red-800">Backups are failing:</span> {data.encryption.problem}
          </Notice>
        </div>
      )}

      {/* ── Status ── */}
      <SectionLabel>Status</SectionLabel>
      <Panel>
        <Rows>
          <Row
            label="Last successful backup"
            sub={fresh?.lastSuccessAt
              ? `${formatDateTime(fresh.lastSuccessAt)} · ${fresh.lastKind ? KIND_LABEL[fresh.lastKind] : ""}${lastRun ? ` · ${mb(lastRun.sizeBytes)} · ${lastRun.totalRows?.toLocaleString("en-IN") ?? "?"} rows` : ""}`
              : "Nothing has been recorded since the run ledger was introduced — the next scheduled slot fills this in."}
            value={
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-normal">{ago(fresh?.lastSuccessAt ?? null)}</span>
                <Tag tone={freshTone}>{freshTitle}</Tag>
              </div>
            }
          />
          <Row
            label="Next nightly backup"
            sub={`Full archive copy to ${[data.r2Configured && "Cloudflare R2", data.telegramConfigured && "Telegram"].filter(Boolean).join(" and ") || "— nowhere (not configured)"}`}
            value={data.nextNightly}
          />
          <Row
            label="Alert if overdue"
            sub={fresh
              ? `Telegram alert when nothing has succeeded for ${Math.round(fresh.thresholdMinutes / 60 * 10) / 10} h. The same check is public below for an outside monitor.`
              : "Telegram alert when no backup succeeds within the schedule's window."}
            value={data.telegramConfigured ? <Tag tone="positive">Telegram on</Tag> : <Tag tone="warn">No Telegram</Tag>}
          />
          <div className="px-5 py-3.5">
            <div className="text-[13px] font-medium text-gray-900">External monitor URL</div>
            <div className="mt-0.5 text-[12px] text-gray-400">
              Add this to any uptime monitor (UptimeRobot, Better Stack, cron-job.org). It answers 200 while backups are on time and 503 when they are overdue — even a dead server shows up as an alert, which this page cannot do for itself.
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-[12px] text-gray-700 ring-1 ring-gray-100" title={monitorUrl}>{monitorUrl}</code>
              <Button variant="ghost" size="sm" onClick={copyMonitor} className="h-8 gap-1 text-[12px] text-violet-600 hover:text-violet-700 focus-visible:ring-violet-500">
                {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </Rows>
      </Panel>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* ── Schedule ── */}
        <div>
          <SectionLabel>Schedule</SectionLabel>
          <Panel>
            <div className="space-y-5 p-5">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Nightly full backup — hour (IST, runs at :30)</label>
                <div className="mt-2.5 flex items-center gap-3">
                  <Input
                    type="number" min={0} max={23}
                    value={hour ?? ""}
                    onChange={(e) => setHour(e.target.value === "" ? null : Number(e.target.value))}
                    className="h-9 w-24 rounded-lg tabular-nums border-gray-200 focus-visible:ring-violet-500"
                  />
                  <span className="text-[12px] text-gray-400">e.g. 2 = 02:30 IST. Kept for 30 days in R2.</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Intraday snapshots</label>
                <div className="mt-2.5 flex items-center gap-3">
                  <Select value={every === null ? undefined : String(every)} onValueChange={(v) => setEvery(Number(v))}>
                    <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 focus:ring-violet-500">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data.intradayChoices ?? [0, 1, 2, 3, 4, 6, 12]).map((h) => (
                        <SelectItem key={h} value={String(h)}>{intervalLabel(h)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-2 text-[12px] text-gray-400">
                  Extra copies to R2 only (never Telegram), kept for 48 hours. With hourly snapshots the most you can lose is about an hour of billing instead of a whole day.
                  {!data.r2Configured && " Needs Cloudflare R2."}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={saveSchedule} disabled={savingSchedule || !scheduleDirty || hour === null} className="h-9 bg-violet-50 text-violet-700 hover:bg-violet-100 focus-visible:ring-violet-500">
                {savingSchedule && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
                Save schedule
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-8">
          {/* ── Manual backup ── */}
          <div>
            <SectionLabel>Manual backup</SectionLabel>
            <Panel>
              <div className="p-5">
                <Button onClick={backupNow} disabled={backingUp || noDestination} variant="secondary" className="h-9 w-full bg-violet-50 text-violet-700 hover:bg-violet-100 font-semibold focus-visible:ring-violet-500">
                  {backingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
                  Backup now
                </Button>
                <p className="mt-3.5 text-center text-[12px] text-gray-400">
                  Same routine as the nightly job, right now. Saved to {[data.r2Configured && "Cloudflare R2", data.telegramConfigured && "Telegram"].filter(Boolean).join(" and ") || "nothing — configure a destination"}.
                </p>
              </div>
            </Panel>
          </div>

          {/* ── Encryption ── */}
          <div>
            <SectionLabel>Encryption</SectionLabel>
            <Panel>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-gray-900">
                    {data.encryption.enabled
                      ? <Lock className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
                      : <Unlock className="h-4 w-4 text-amber-500" strokeWidth={1.75} />}
                    {data.encryption.enabled ? "Backups are encrypted" : "Backups are not encrypted"}
                  </div>
                  <Tag tone={data.encryption.enabled ? "positive" : "warn"}>{data.encryption.enabled ? "AES-256-GCM" : "Off"}</Tag>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-gray-400">
                  {data.encryption.enabled ? (
                    <>
                      Every new file is sealed with <span className="font-mono">BACKUP_ENCRYPTION_KEY</span> before it leaves the server; R2, Telegram or a downloaded copy cannot be read without it. <span className="font-semibold text-gray-600">Keep that key somewhere outside this server</span> — if it is lost, every encrypted backup is unreadable. Older unencrypted files still restore normally.
                    </>
                  ) : (
                    <>
                      Files are only gzipped. Anyone with the R2 credentials, the Telegram chat, or a downloaded copy can read every shop's records and login hashes. Set <span className="font-mono">BACKUP_ENCRYPTION_KEY</span> (16+ characters) in the server secrets — for the workspace <em>and</em> the deployment — and new backups are encrypted automatically.
                    </>
                  )}
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* ── Recent runs ── */}
      <div className="mt-10">
        <SectionLabel>Recent runs</SectionLabel>
        <Panel>
          {data.runs.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No runs recorded yet" hint="Every scheduled, manual and safety backup is logged here from now on." />
          ) : (
            <Rows>
              {data.runs.map((r) => {
                const tone: Tone = r.status === "ok" ? "positive" : r.status === "failed" ? "danger" : "warn";
                const label = r.status === "ok" ? "OK" : r.status === "failed" ? `Failed${r.attempts > 1 ? ` ×${r.attempts}` : ""}` : "Running";
                return (
                  <Row
                    key={r.slot}
                    label={<span>{KIND_LABEL[r.kind] ?? r.kind} <span className="font-normal text-gray-400">· {formatDateTime(r.startedAt)}</span></span>}
                    sub={r.status === "failed"
                      ? (r.error ?? "Unknown error")
                      : r.status === "ok"
                        ? `${r.totalRows?.toLocaleString("en-IN") ?? "?"} rows · ${mb(r.sizeBytes)} · ${[r.r2Key && "R2", r.telegram && "Telegram"].filter(Boolean).join(" + ") || "—"}${r.encrypted ? " · encrypted" : ""} · by ${r.claimedBy ?? "?"}`
                        : `Started ${ago(r.startedAt)} by ${r.claimedBy ?? "?"}`}
                    value={<Tag tone={tone}>{label}</Tag>}
                  />
                );
              })}
            </Rows>
          )}
        </Panel>
      </div>

      {/* ── Stored snapshots ── */}
      <div className="mt-10 pb-12">
        <SectionLabel
          action={
            <>
              <input type="file" accept=".gz,.enc,.json.gz,.json.gz.enc,application/gzip,application/octet-stream" className="hidden" ref={fileInputRef} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="-mr-2 h-7 gap-1 text-[13px] font-normal text-violet-600 hover:text-violet-700 focus-visible:ring-violet-500">
                <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.75} />
                Upload snapshot
              </Button>
            </>
          }
        >
          Stored in R2
        </SectionLabel>

        <Panel>
          {data.listError ? (
            <div className="p-5"><LoadError message={data.listError} onRetry={refresh} /></div>
          ) : !data.files.length ? (
            <EmptyState icon={UploadCloud} title={data.r2Configured ? "No backups found in R2" : "Cloudflare R2 is not configured"} hint={data.r2Configured ? "Manual or scheduled backups will appear here." : "Set the R2_* secrets to store backups off-site."} />
          ) : (
            <Rows>
              {data.files.map((f) => (
                <Row
                  key={f.key}
                  label={
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[12px] text-gray-800 max-w-[180px] sm:max-w-md" title={f.filename}>{f.filename}</span>
                      {f.filename.endsWith(".enc") && <Lock className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={2} />}
                    </div>
                  }
                  sub={`${f.kind === "intraday" ? "Intraday · " : ""}${mb(f.sizeBytes)} · ${f.lastModified ? formatDateTime(f.lastModified) : "Unknown date"}`}
                  value={
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => download(f)} className="h-7 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-600 hover:bg-violet-50 hover:text-violet-700 focus-visible:ring-violet-500">
                        Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(f)} className="h-7 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-500">
                        Restore
                      </Button>
                    </div>
                  }
                />
              ))}
            </Rows>
          )}
        </Panel>
      </div>

      {restoreTarget && (
        <RestoreDialog
          key={restoreTarget.key}
          title={restoreTarget.filename}
          tenants={tenants}
          previewFor={(tenantId) => `${API}/platform/backups/preview?key=${encodeURIComponent(restoreTarget.key)}&tenantId=${encodeURIComponent(tenantId)}`}
          submit={async (scope, tenantId) => {
            const r = await fetch(`${API}/platform/backups/restore`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: restoreTarget.key, confirm: "RESTORE", ...(scope === "tenant" ? { tenantId } : {}) }),
            });
            return r;
          }}
          onClose={() => setRestoreTarget(null)}
          onDone={() => { setRestoreTarget(null); refresh(); }}
        />
      )}

      {uploadFile && (
        <RestoreDialog
          key={`${uploadFile.name}:${uploadFile.size}`}
          title={uploadFile.name}
          tenants={tenants}
          previewFor={null}
          submit={async (scope, tenantId) => {
            const fd = new FormData();
            fd.append("confirm", "RESTORE");
            if (scope === "tenant" && tenantId) fd.append("tenantId", tenantId);
            fd.append("file", uploadFile);
            return fetch(`${API}/platform/backups/restore-upload`, { method: "POST", credentials: "include", body: fd });
          }}
          onClose={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
          onDone={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; refresh(); }}
        />
      )}
    </div>
  );
}

/* ── Restore dialog (shared by R2 and upload paths) ─────────────────────
   Mounted only while open and keyed by the target, so its state can never
   leak from one snapshot to the next. */
function RestoreDialog({
  title, tenants, previewFor, submit, onClose, onDone,
}: {
  title: string;
  tenants: { id: string; name: string; isActive: boolean }[];
  /** URL builder for the per-shop preview; null when the source is an upload (no preview possible before sending). */
  previewFor: ((tenantId: string) => string) | null;
  submit: (scope: Scope, tenantId: string | null) => Promise<Response>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [scope, setScope] = useState<Scope>("tenant");
  const [tenantId, setTenantId] = useState<string>("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TenantPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const selected = tenants.find((t) => t.id === tenantId) ?? null;

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!previewFor || scope !== "tenant" || !tenantId) return;
    let cancelled = false;
    setPreviewLoading(true);
    fetch(previewFor(tenantId), { credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setPreviewError(d.error || "Could not read that backup"); return; }
        setPreview(d.tenant ?? null);
      })
      .catch(() => { if (!cancelled) setPreviewError("Server unreachable"); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [previewFor, scope, tenantId]);

  const ready = confirm === "RESTORE" && !busy && (scope === "platform" || (!!tenantId && !previewError && (!previewFor || !!preview)));

  const go = async () => {
    if (!ready) return;
    setBusy(true);
    const t = toast.loading(scope === "tenant" ? `Restoring ${selected?.name ?? "shop"} — do not close this tab…` : "Restoring the entire database — do not close this tab…");
    try {
      const r = await submit(scope, scope === "tenant" ? tenantId : null);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Restore failed — nothing was changed", { id: t, duration: 12000 }); return; }
      toast.success(
        scope === "tenant"
          ? `${d.tenantName ?? "Shop"} restored — ${Number(d.rowsRestored ?? 0).toLocaleString("en-IN")} rows put back (safety copy: ${d.safetyBackup ?? "taken"})`
          : `Restore complete — ${Number(d.rowsRestored ?? 0).toLocaleString("en-IN")} rows across ${d.tables ?? "?"} tables`,
        { id: t, duration: 10000 },
      );
      onDone();
    } catch { toast.error("Server unreachable", { id: t }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-red-600">Restore from backup</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="text-[13px] text-gray-600">
            Snapshot: <span className="font-mono font-semibold text-gray-900 break-all">{title}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">What to restore</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("tenant")}
                className={`rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors ${scope === "tenant" ? "border-violet-300 bg-violet-50 text-violet-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <div className="font-semibold">One shop</div>
                <div className="text-[11px] opacity-80">Only that shop's records; everyone else untouched</div>
              </button>
              <button
                type="button"
                onClick={() => setScope("platform")}
                className={`rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors ${scope === "platform" ? "border-red-300 bg-red-50 text-red-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                <div className="font-semibold">Entire platform</div>
                <div className="text-[11px] opacity-80">Every shop, every login — the nuclear option</div>
              </button>
            </div>
          </div>

          {scope === "tenant" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Shop</label>
              <Select value={tenantId || undefined} onValueChange={setTenantId}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 focus:ring-violet-500">
                  <SelectValue placeholder="Choose a shop…" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.isActive ? "" : " (inactive)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {previewLoading && <div className="flex items-center gap-2 text-[12px] text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> Reading the snapshot…</div>}
              {previewError && <Notice tone="danger">{previewError}</Notice>}
              {preview && (
                <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-[12px]">
                  <div className="mb-2 flex items-center justify-between text-gray-600">
                    <span>Rows for <span className="font-semibold text-gray-900">{preview.tenantName}</span></span>
                    <span className="tabular-nums">now {preview.totalLive.toLocaleString("en-IN")} → after {preview.totalSnapshot.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {preview.tables.filter((t) => t.live || t.snapshot).map((t) => (
                      <div key={t.table} className="flex items-center justify-between font-mono text-[11px] text-gray-500">
                        <span>{t.table}</span>
                        <span className={`tabular-nums ${t.snapshot < t.live ? "text-red-600" : t.snapshot > t.live ? "text-emerald-700" : ""}`}>{t.live.toLocaleString("en-IN")} → {t.snapshot.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                  {preview.totalPinned > 0 && (
                    <div className="mt-2 text-gray-500">
                      {preview.totalPinned.toLocaleString("en-IN")} row{preview.totalPinned === 1 ? " is" : "s are"} still referenced by old records outside this shop (pre-tenant data); {preview.totalPinned === 1 ? "it" : "they"} will be overwritten in place rather than deleted.
                    </div>
                  )}
                  {preview.totalSnapshot === 0 && <div className="mt-2 font-semibold text-red-600">This backup holds nothing for this shop — the server will refuse.</div>}
                </div>
              )}
              {!previewFor && tenantId && (
                <p className="text-[12px] text-gray-400">Uploaded files cannot be previewed before restoring. A safety copy of today's data is taken first either way.</p>
              )}
            </div>
          )}

          <div className={`rounded-xl border p-4 text-[13px] leading-relaxed ${scope === "platform" ? "border-red-100 bg-red-50/50 text-red-800" : "border-amber-100 bg-amber-50/50 text-amber-800"}`}>
            {scope === "platform" ? (
              <>The ENTIRE database — every shop, every login — will be replaced with this snapshot. All changes since then are lost for everyone.</>
            ) : (
              <>Only <span className="font-semibold">{selected?.name ?? "the chosen shop"}</span>'s records (products, bills, stock, staff, customers…) are replaced with what this snapshot holds for it. Its plan, logins and invoices are kept; other shops are not touched.</>
            )}
            {" "}A full safety backup of the current data is taken first, and the whole restore is one transaction: if anything fails, nothing changes.
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Type RESTORE to confirm</label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESTORE" className="h-10 rounded-lg font-mono tracking-wider border-gray-200 focus-visible:ring-red-500" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy} className="text-gray-600 hover:text-gray-900 focus-visible:ring-gray-500">Cancel</Button>
          <Button variant="destructive" onClick={go} disabled={!ready} className="focus-visible:ring-red-500">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
            {scope === "tenant" ? "Restore this shop" : "Restore entire database"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
