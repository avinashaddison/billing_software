import { useState, useRef, useEffect } from "react";
import { useAdminBackups, adminQueryKeys } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, SectionLabel, Panel, Rows, EmptyState, LoadError } from "./ui";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

export default function Backups() {
  const { data, isLoading, error } = useAdminBackups();
  const queryClient = useQueryClient();
  
  const [backingUp, setBackingUp] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  const [savingHour, setSavingHour] = useState(false);
  
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadConfirm, setUploadConfirm] = useState("");
  const [uploadRestoring, setUploadRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof data?.backupHour === "number") setHour(data.backupHour);
  }, [data?.backupHour]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminQueryKeys.backups });

  const backupNow = async () => {
    setBackingUp(true);
    const t = toast.loading("Backing up database…");
    try {
      const r = await fetch(`${API}/platform/backup`, { method: "POST", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.success(`Backup saved successfully`, { id: t });
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

  const saveHour = async () => {
    if (hour === null || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      toast.error("Pick an hour between 0 and 23");
      return;
    }
    setSavingHour(true);
    try {
      const r = await fetch(`${API}/platform/backup-settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hour: Number(hour) }),
      });
      if (!r.ok) { toast.error("Could not save backup time"); return; }
      toast.success("Schedule updated");
      refresh();
    } catch { toast.error("Server unreachable"); }
    finally { setSavingHour(false); }
  };

  const download = async (f: any) => {
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

  const doRestore = async () => {
    if (restoreConfirm !== "RESTORE" || restoring || !restoreTarget) return;
    setRestoring(true);
    const t = toast.loading("Restoring database — do not close this tab…");
    try {
      const r = await fetch(`${API}/platform/backups/restore`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: restoreTarget.key, confirm: restoreConfirm }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Restore failed", { id: t }); return; }
      toast.success("Restore complete", { id: t });
      setRestoreTarget(null);
      setRestoreConfirm("");
      refresh();
    } catch { toast.error("Server unreachable", { id: t }); }
    finally { setRestoring(false); }
  };

  const doUploadRestore = async () => {
    if (uploadConfirm !== "RESTORE" || uploadRestoring || !uploadFile) return;
    setUploadRestoring(true);
    const t = toast.loading("Restoring database from file…");
    try {
      const fd = new FormData();
      fd.append("confirm", uploadConfirm);
      fd.append("file", uploadFile);
      const r = await fetch(`${API}/platform/backups/restore-upload`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || "Restore failed", { id: t }); return; }
      toast.success("Restore complete", { id: t });
      setUploadFile(null);
      setUploadConfirm("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      refresh();
    } catch { toast.error("Server unreachable", { id: t }); }
    finally { setUploadRestoring(false); }
  };

  if (isLoading || (!data && !error)) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Database backups" meta="Manage automated and manual backups" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Database backups" meta="Manage automated and manual backups" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <SectionLabel>Schedule</SectionLabel>
          <Panel>
            <div className="p-4">
              <label className="text-[13px] font-medium">Backup time (0-23 UTC)</label>
              <div className="mt-2 flex items-center gap-3">
                <Input
                  type="number" min={0} max={23}
                  value={hour ?? ""}
                  placeholder={isLoading ? "Loading…" : "—"}
                  disabled={isLoading || !!error}
                  onChange={(e) => setHour(e.target.value === "" ? null : Number(e.target.value))}
                  className="h-9 w-24 rounded-md"
                />
                <Button variant="secondary" size="sm" onClick={saveHour} disabled={savingHour || hour === null} className="h-9">
                  Save
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        <div>
          <SectionLabel>Manual backup</SectionLabel>
          <Panel>
            <div className="p-4">
              <Button onClick={backupNow} disabled={backingUp} variant="secondary" className="h-9 w-full">
                {backingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
                Backup now
              </Button>
              <p className="mt-3 text-center text-[13px] text-muted-foreground">
                Backups are saved to Cloudflare R2 and Telegram.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-10">
        <SectionLabel
          action={
            <>
              <input type="file" accept=".gz,.json.gz,application/gzip" className="hidden" ref={fileInputRef} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="-mr-2 h-7 gap-1 text-[13px] font-normal text-muted-foreground">
                <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.75} />
                Upload snapshot
              </Button>
            </>
          }
        >
          R2 Snapshots
        </SectionLabel>
        
        <Panel>
          {error ? (
            <LoadError message={(error as Error).message} />
          ) : data?.listError ? (
            <LoadError message={data.listError} />
          ) : !data?.files?.length ? (
            <EmptyState title="No recent backups found in R2" />
          ) : (
            <Rows>
              {data.files.map((f: any) => (
                <div key={f.key} className="flex items-center justify-between gap-4 px-4 py-3">
                   <div className="min-w-0">
                     <div className="truncate text-sm font-medium">{f.filename}</div>
                     <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
                       {((f.sizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB · {f.lastModified ? new Date(f.lastModified).toLocaleString() : "Unknown date"}
                     </div>
                   </div>
                   <div className="flex shrink-0 items-center gap-2">
                     <Button variant="ghost" size="sm" onClick={() => download(f)} className="h-8 text-[13px]">
                       Download
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(f)} className="h-8 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive">
                       Restore
                     </Button>
                   </div>
                </div>
              ))}
            </Rows>
          )}
        </Panel>
      </div>

      <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Danger: Database Restore</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-l-2 border-destructive py-1.5 pl-3.5 text-[13px] leading-relaxed text-muted-foreground">
              You are about to overwrite the ENTIRE platform database with the snapshot:
              <br/><br/>
              <span className="font-mono text-foreground">{restoreTarget?.filename}</span>
              <br/><br/>
              All changes since this snapshot will be permanently lost. This affects all tenants.
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Type RESTORE to confirm</label>
              <Input value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value)} placeholder="RESTORE" className="h-9 rounded-md font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRestoreTarget(null)} className="h-9 text-[13px]">Cancel</Button>
            <Button variant="destructive" onClick={doRestore} disabled={restoreConfirm !== "RESTORE" || restoring} className="h-9 text-[13px]">
              {restoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Restore database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!uploadFile} onOpenChange={(o) => !o && setUploadFile(null)}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Danger: Upload Restore</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-l-2 border-destructive py-1.5 pl-3.5 text-[13px] leading-relaxed text-muted-foreground">
              You are about to overwrite the ENTIRE platform database with the uploaded file:
              <br/><br/>
              <span className="font-mono text-foreground">{uploadFile?.name}</span>
              <br/><br/>
              All changes since this snapshot will be permanently lost. This affects all tenants.
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Type RESTORE to confirm</label>
              <Input value={uploadConfirm} onChange={(e) => setUploadConfirm(e.target.value)} placeholder="RESTORE" className="h-9 rounded-md font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setUploadFile(null); if(fileInputRef.current) fileInputRef.current.value=""; }} className="h-9 text-[13px]">Cancel</Button>
            <Button variant="destructive" onClick={doUploadRestore} disabled={uploadConfirm !== "RESTORE" || uploadRestoring} className="h-9 text-[13px]">
              {uploadRestoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Restore database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
