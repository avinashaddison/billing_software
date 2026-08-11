import { useState, useRef, useEffect } from "react";
import { useAdminBackups, adminQueryKeys } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatabaseBackup, Download, UploadCloud, ArchiveRestore, Loader2, PlayCircle, Settings, HardDrive, ShieldAlert, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

export default function Backups() {
  const { data, isLoading, error } = useAdminBackups();
  const queryClient = useQueryClient();
  
  const [backingUp, setBackingUp] = useState(false);
  /* Left null until the real schedule arrives. Seeding this with a guess and
   * letting Save write it back would silently overwrite the live schedule. */
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

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Database Backups</h1>
        <p className="text-muted-foreground mt-1">Manage automated and manual backups</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-5 h-5 text-primary"/> Schedule</CardTitle>
            <CardDescription>Daily automated backup</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Backup Time (0-23 UTC)</label>
                <Input
                  type="number" min={0} max={23}
                  value={hour ?? ""}
                  placeholder={isLoading ? "Loading…" : "—"}
                  disabled={isLoading || !!error}
                  onChange={(e) => setHour(e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <Button variant="secondary" onClick={saveHour} disabled={savingHour || hour === null}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-lg flex items-center gap-2"><PlayCircle className="w-5 h-5 text-emerald-500"/> Manual Backup</CardTitle>
            <CardDescription>Create a snapshot right now</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={backupNow} disabled={backingUp} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {backingUp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
              Backup Now
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">Backups are saved to Cloudflare R2 and Telegram.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><HardDrive className="w-5 h-5 text-primary"/> R2 Snapshots</CardTitle>
            <CardDescription>Recent backups available to restore</CardDescription>
          </div>
          <div>
            <input type="file" accept=".gz,.json.gz,application/gzip" className="hidden" ref={fileInputRef} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="w-4 h-4 mr-2" /> Upload Snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="font-medium text-destructive">Could not load your backups</p>
              <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
              <p className="mt-1 text-sm text-muted-foreground">This is a problem reading the list — it does not mean the backups are gone.</p>
            </div>
          ) : data?.listError ? (
            <div className="p-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="font-medium text-destructive">{data.listError}</p>
            </div>
          ) : !data?.files?.length ? (
            <div className="p-12 text-center text-muted-foreground">No recent backups found in R2.</div>
          ) : (
            <div className="divide-y">
              {data.files.map((f: any) => (
                <div key={f.key} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-semibold text-sm">{f.filename}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{((f.sizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB &middot; {f.lastModified ? new Date(f.lastModified).toLocaleString() : "Unknown date"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => download(f)}>
                      <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setRestoreTarget(f)}>
                      <ArchiveRestore className="w-4 h-4 mr-2" /> Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" /> Danger: Database Restore
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 font-medium">
              You are about to overwrite the ENTIRE platform database with the snapshot:
              <br/><br/>
              <span className="font-mono bg-destructive/20 px-1 py-0.5 rounded">{restoreTarget?.filename}</span>
              <br/><br/>
              All changes since this snapshot will be permanently lost. This affects all tenants.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type RESTORE to confirm</label>
              <Input value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value)} placeholder="RESTORE" className="font-mono text-destructive" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRestoreTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doRestore} disabled={restoreConfirm !== "RESTORE" || restoring}>
              {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Restore Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Restore Dialog */}
      <Dialog open={!!uploadFile} onOpenChange={(o) => !o && setUploadFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" /> Danger: Upload Restore
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 font-medium">
              You are about to overwrite the ENTIRE platform database with the uploaded file:
              <br/><br/>
              <span className="font-mono bg-destructive/20 px-1 py-0.5 rounded">{uploadFile?.name}</span>
              <br/><br/>
              All changes since this snapshot will be permanently lost. This affects all tenants.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type RESTORE to confirm</label>
              <Input value={uploadConfirm} onChange={(e) => setUploadConfirm(e.target.value)} placeholder="RESTORE" className="font-mono text-destructive" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setUploadFile(null); if(fileInputRef.current) fileInputRef.current.value=""; }}>Cancel</Button>
            <Button variant="destructive" onClick={doUploadRestore} disabled={uploadConfirm !== "RESTORE" || uploadRestoring}>
              {uploadRestoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Restore Uploaded Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
