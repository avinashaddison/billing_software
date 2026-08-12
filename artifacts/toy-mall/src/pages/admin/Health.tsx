import { useQueryClient } from "@tanstack/react-query";
import { useAdminHealth, useAdminBackups, adminQueryKeys } from "./api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Server, Database, HardDrive, Users, RefreshCw, 
  AlertTriangle, ShieldAlert, Table as TableIcon, Network, Cpu, Activity, Clock
} from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeAgo(ts: number | string) {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export default function Health() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, isFetching } = useAdminHealth();
  const { data: backupsData, isLoading: isBackupsLoading, error: backupsError } = useAdminBackups();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.health });
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.backups });
  };

  if (isLoading || (!data && !error)) {
    return (
      <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Health</h1>
          <p className="text-muted-foreground mt-1">Real-time system diagnostics</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">Platform Health</h1>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="font-medium text-destructive">Could not load health diagnostics</p>
          <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
          <Button variant="outline" className="mt-4" onClick={handleRefresh}>Try Again</Button>
        </div>
      </div>
    );
  }

  /* Backup freshness. There are three honest answers and collapsing them into
     one red alarm would train the vendor to ignore it: off-site backups may
     simply not be switched on yet, they may be on and fresh, or they may be on
     and stale. Only the last one is an emergency. */
  interface BackupFile { key?: string; filename?: string; sizeBytes?: number; lastModified?: string | null }
  interface BackupsPayload { r2Configured?: boolean; files?: BackupFile[]; listError?: string }

  const backups = backupsData as BackupsPayload | undefined;
  let backupTone: "checking" | "ok" | "warn" | "alarm" = "checking";
  let backupTitle = "Checking backups";
  let backupStatusMsg = "Reading backup storage\u2026";
  let latestBackupTime: number | null = null;

  if (!isBackupsLoading) {
    const files = Array.isArray(backups?.files) ? backups.files : [];
    const times = files
      .map((f) => (f.lastModified ? new Date(f.lastModified).getTime() : NaN))
      .filter((t) => Number.isFinite(t));
    latestBackupTime = times.length ? Math.max(...times) : null;

    if (backupsError) {
      backupTone = "alarm";
      backupTitle = "Backup status unknown";
      backupStatusMsg = "The backup list could not be read, so there is no proof a recent backup exists.";
    } else if (backups?.listError) {
      backupTone = "alarm";
      backupTitle = "Backup storage unreachable";
      backupStatusMsg = backups.listError;
    } else if (backups?.r2Configured === false) {
      backupTone = "warn";
      backupTitle = "Off-site backups are not set up";
      backupStatusMsg = "Nothing is being copied off this server, so there is nothing to restore from if the database is lost.";
    } else if (latestBackupTime === null) {
      backupTone = "alarm";
      backupTitle = "No backups in storage";
      backupStatusMsg = files.length
        ? "Backup files exist but none of them carry a readable date."
        : "Backups are switched on but the storage bucket is empty.";
    } else if ((Date.now() - latestBackupTime) / 3600000 > 48) {
      backupTone = "alarm";
      backupTitle = "Last backup is dangerously old";
      backupStatusMsg = `The most recent backup was taken ${formatTimeAgo(latestBackupTime)}.`;
    } else {
      backupTone = "ok";
      backupTitle = "Database backups are healthy";
      backupStatusMsg = `Last backup taken ${formatTimeAgo(latestBackupTime)}.`;
    }
  }

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Health</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Checked {formatTimeAgo(data.checkedAt)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching || isBackupsLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {backupTone === "alarm" && (
        <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-5 flex items-start gap-4 shadow-sm">
          <ShieldAlert className="w-8 h-8 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-destructive tracking-tight">{backupTitle}</h2>
            <p className="text-destructive/90 mt-1 font-medium">{backupStatusMsg}</p>
            <p className="text-destructive/80 text-sm mt-2 max-w-3xl">
              If the database fails now, data will be permanently lost. 
              Check the Backups page and R2 storage configuration immediately.
            </p>
          </div>
        </div>
      )}

      {backupTone === "warn" && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-300">{backupTitle}</p>
              <p className="text-sm text-amber-700/90 dark:text-amber-400/90">{backupStatusMsg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {backupTone === "ok" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-300">{backupTitle}</p>
                <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">{backupStatusMsg}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Database Card */}
        <Card className="border-border/60 flex flex-col">
          <CardHeader className="bg-muted/20 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Database & Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-muted/10 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> Disk Usage
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums text-foreground">{data.database.sizePretty}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate" title={data.database.name}>{data.database.name}</p>
              </div>
              <div className="p-4 rounded-xl border bg-muted/10 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5" /> Connections
                </p>
                <p className="text-2xl font-bold mt-2 tabular-nums text-foreground">
                  {data.database.connections.active} <span className="text-muted-foreground text-sm font-medium">/ {data.database.connections.total}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Active pool connections</p>
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <TableIcon className="w-4 h-4" /> Largest Tables
              </p>
              <div className="rounded-lg border bg-card text-sm divide-y shadow-sm overflow-hidden">
                {data.database.biggestTables.map((t) => (
                  <div key={t.name} className="flex justify-between items-center p-3 hover:bg-muted/30 transition-colors">
                    <span className="font-mono text-xs font-semibold">{t.name}</span>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">{t.sizePretty}</p>
                      <p className="text-[10px] text-muted-foreground">~{t.rowEstimate.toLocaleString("en-IN")} planner est. rows</p>
                    </div>
                  </div>
                ))}
                {data.database.biggestTables.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No table data available.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto pt-5 border-t border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Migrations Applied</p>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={data.database.migrations.latest || ""}>
                  {data.database.migrations.latest || "No migrations"}
                </p>
              </div>
              <span className="font-mono text-xs font-bold bg-muted px-2.5 py-1 rounded-md border shadow-sm">
                {data.database.migrations.applied} Total
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Sessions & Pulse Card */}
          <Card className="border-border/60">
            <CardHeader className="bg-muted/20 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" /> Traffic & Platform
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> User Sessions
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl border bg-muted/10 shadow-sm">
                    <p className="text-2xl font-bold tabular-nums text-foreground">{data.sessions.live.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1.5">Live Now</p>
                  </div>
                  <div className="text-center p-3 rounded-xl border bg-muted/10 shadow-sm">
                    <p className="text-2xl font-bold tabular-nums text-foreground">{data.sessions.activeDay.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1.5">24h Active</p>
                  </div>
                  <div className="text-center p-3 rounded-xl border bg-muted/10 shadow-sm opacity-70">
                    <p className="text-2xl font-bold tabular-nums text-muted-foreground">{data.sessions.revoked.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1.5">Revoked</p>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Network className="w-4 h-4" /> Shop Health
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm p-2 rounded-md bg-emerald-500/5 text-emerald-900 dark:text-emerald-300 font-medium">
                    <span>Active, not expired</span>
                    <span className="tabular-nums">{data.shops.active.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-2 rounded-md bg-amber-500/5 text-amber-900 dark:text-amber-400 font-medium">
                    <span>Expiring in 7 days</span>
                    <span className="tabular-nums">{data.shops.expiring7d.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-2 rounded-md bg-destructive/5 text-destructive font-medium">
                    <span>Suspended</span>
                    <span className="tabular-nums">{data.shops.suspended.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-2 rounded-md bg-destructive/5 text-destructive font-medium">
                    <span>Expired</span>
                    <span className="tabular-nums">{data.shops.expired.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-2 text-muted-foreground font-medium">
                    <span>Lifetime License</span>
                    <span className="tabular-nums">{data.shops.lifetime.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Server Card */}
          <Card className="border-border/60">
            <CardHeader className="bg-muted/20 pb-4 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-500" /> Server Node
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" /> Env
                  </p>
                  <p className="font-mono text-sm font-medium">{data.server.env}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Uptime
                  </p>
                  <p className="font-medium tabular-nums text-sm">{formatUptime(data.server.uptimeSeconds)}</p>
                </div>
                <div className="space-y-1 col-span-2 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Runtime
                  </p>
                  <p className="font-mono text-sm font-medium">{data.server.nodeVersion}</p>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" /> Memory Footprint
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Resident Set Size (RSS)</span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">{formatBytes(data.server.memory.rssBytes)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-muted-foreground">V8 Heap Used</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{formatBytes(data.server.memory.heapUsedBytes)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-muted-foreground">V8 Heap Total</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{formatBytes(data.server.memory.heapTotalBytes)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
