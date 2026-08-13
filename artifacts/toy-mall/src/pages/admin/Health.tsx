import { useQueryClient } from "@tanstack/react-query";
import { useAdminHealth, useAdminBackups, adminQueryKeys } from "./api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Activity } from "lucide-react";
import { PageHeader, SectionLabel, Panel, Rows, Row, MetricRow, Metric, Tag, Notice, LoadError, count, PanelSkeleton, EmptyState } from "./ui";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Platform health" meta="Real-time system diagnostics" />
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <PanelSkeleton rows={4} header={true} />
            <PanelSkeleton rows={3} header={true} />
          </div>
          <div className="space-y-8">
            <MetricRow cols={3}>
              <Skeleton className="h-[122px] rounded-2xl" />
              <Skeleton className="h-[122px] rounded-2xl" />
              <Skeleton className="h-[122px] rounded-2xl" />
            </MetricRow>
            <PanelSkeleton rows={5} header={true} />
            <PanelSkeleton rows={5} header={true} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader
          title="Platform health"
          actions={
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 text-[13px] bg-white border-gray-200 text-gray-700 hover:bg-gray-50 focus-visible:ring-violet-500"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              Try again
            </Button>
          }
        />
        <LoadError message={(error as Error)?.message} onRetry={handleRefresh} />
      </div>
    );
  }

  interface BackupFile { key?: string; filename?: string; sizeBytes?: number; lastModified?: string | null }
  interface BackupsPayload { r2Configured?: boolean; files?: BackupFile[]; listError?: string }

  const backups = backupsData as BackupsPayload | undefined;
  let backupTone: "neutral" | "positive" | "warn" | "danger" = "neutral";
  let backupTitle = "Checking backups";
  let backupStatusMsg = "Reading backup storage…";
  let latestBackupTime: number | null = null;

  if (!isBackupsLoading) {
    const files = Array.isArray(backups?.files) ? backups.files : [];
    const times = files
      .map((f) => (f.lastModified ? new Date(f.lastModified).getTime() : NaN))
      .filter((t) => Number.isFinite(t));
    latestBackupTime = times.length ? Math.max(...times) : null;

    if (backupsError) {
      backupTone = "danger";
      backupTitle = "Backup status unknown";
      backupStatusMsg = "The backup list could not be read, so there is no proof a recent backup exists.";
    } else if (backups?.listError) {
      backupTone = "danger";
      backupTitle = "Backup storage unreachable";
      backupStatusMsg = backups.listError;
    } else if (backups?.r2Configured === false) {
      backupTone = "warn";
      backupTitle = "Off-site backups are not set up";
      backupStatusMsg = "Nothing is being copied off this server, so there is nothing to restore from if the database is lost.";
    } else if (latestBackupTime === null) {
      backupTone = "danger";
      backupTitle = "No backups in storage";
      backupStatusMsg = files.length
        ? "Backup files exist but none of them carry a readable date."
        : "Backups are switched on but the storage bucket is empty.";
    } else if ((Date.now() - latestBackupTime) / 3600000 > 48) {
      backupTone = "danger";
      backupTitle = "Last backup is dangerously old";
      backupStatusMsg = `The most recent backup was taken ${formatTimeAgo(latestBackupTime)}.`;
    } else {
      backupTone = "positive";
      backupTitle = "Healthy";
      backupStatusMsg = `Last taken ${formatTimeAgo(latestBackupTime)}.`;
    }
  }

  return (
    <div className="animate-in fade-in duration-300 pb-12">
      <PageHeader
        title="Platform health"
        meta={`Checked ${formatTimeAgo(data.checkedAt)}`}
        actions={
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isFetching || isBackupsLoading} className="-mr-2 h-7 gap-1 text-[13px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 focus-visible:ring-violet-500">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} strokeWidth={1.75} />
            Refresh
          </Button>
        }
      />

      {backupTone === "danger" && (
        <div className="mb-8">
          <Notice tone="danger">
            <span className="font-semibold text-red-800">{backupTitle}:</span> {backupStatusMsg} If the database fails now, data will be permanently lost.
          </Notice>
        </div>
      )}
      {backupTone === "warn" && (
        <div className="mb-8">
          <Notice tone="warn">
            <span className="font-semibold text-amber-800">{backupTitle}:</span> {backupStatusMsg}
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <SectionLabel>Database</SectionLabel>
          <Panel>
            <Rows>
              <Row label="Disk usage" value={data.database.sizePretty} sub={data.database.name} />
              <Row label="Active connections" value={`${data.database.connections.active} / ${data.database.connections.total}`} />
              <Row label="Migrations applied" value={count(data.database.migrations.applied)} sub={<span className="block truncate max-w-[200px]" title={data.database.migrations.latest || undefined}>{data.database.migrations.latest || "No migrations"}</span>} />
              <Row 
                label="Backup status" 
                value={<Tag tone={backupTone}>{backupTitle}</Tag>} 
                sub={backupStatusMsg} 
              />
            </Rows>
          </Panel>

          <div className="mt-8">
            <SectionLabel>Largest tables</SectionLabel>
            <Panel>
              {data.database.biggestTables.length === 0 ? (
                <EmptyState icon={Database} title="No tables found" hint="The database appears empty." />
              ) : (
                <Rows>
                  {data.database.biggestTables.map((t) => (
                    <Row 
                      key={t.name} 
                      label={<span className="font-mono text-[12px] text-gray-800 truncate block max-w-[150px]" title={t.name}>{t.name}</span>} 
                      sub={`~${count(t.rowEstimate)} planner est. rows`} 
                      value={t.sizePretty} 
                    />
                  ))}
                </Rows>
              )}
            </Panel>
          </div>
        </div>

        <div>
          <SectionLabel>Traffic & sessions</SectionLabel>
          <MetricRow cols={3}>
             <Metric label="Live now" value={count(data.sessions.live)} tone="positive" />
             <Metric label="24h active" value={count(data.sessions.activeDay)} />
             <Metric label="Revoked" value={count(data.sessions.revoked)} tone="neutral" />
          </MetricRow>

          <div className="mt-8">
            <SectionLabel>Shop health</SectionLabel>
            <Panel>
              <Rows>
                <Row label="Active, not expired" value={count(data.shops.active)} tone="positive" />
                <Row label="Expiring in 7 days" value={count(data.shops.expiring7d)} tone="warn" />
                <Row label="Suspended" value={count(data.shops.suspended)} tone="danger" />
                <Row label="Expired" value={count(data.shops.expired)} tone="danger" />
                <Row label="Lifetime license" value={count(data.shops.lifetime)} />
              </Rows>
            </Panel>
          </div>

          <div className="mt-8">
            <SectionLabel>Server node</SectionLabel>
            <Panel>
              <Rows>
                <Row label="Environment" value={data.server.env} />
                <Row label="Runtime" value={data.server.nodeVersion} />
                <Row label="Uptime" value={formatUptime(data.server.uptimeSeconds)} />
                <Row label="Resident set size (RSS)" value={formatBytes(data.server.memory.rssBytes)} />
                <Row label="V8 heap used" value={formatBytes(data.server.memory.heapUsedBytes)} sub={`Total: ${formatBytes(data.server.memory.heapTotalBytes)}`} />
              </Rows>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
