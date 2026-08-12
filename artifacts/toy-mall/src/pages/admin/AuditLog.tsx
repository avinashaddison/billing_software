import { useAdminAudit } from "./api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel, Rows, EmptyState, LoadError } from "./ui";

export default function AuditLog() {
  const { data, isLoading, error } = useAdminAudit();

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Audit log" meta="Recent platform-level actions" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const events = data?.events || [];

  return (
    <div className="animate-in fade-in duration-300">
      <PageHeader title="Audit log" meta="Recent platform-level actions" />

      <Panel>
        {error ? (
          <LoadError message={(error as Error).message} />
        ) : events.length === 0 ? (
          <EmptyState title="No audit events found" />
        ) : (
          <Rows>
            {events.map((ev: any) => (
              <div key={ev.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-medium text-foreground">{ev.action}</span>
                    <span className="text-muted-foreground">by</span>
                    <span className="font-mono text-muted-foreground">{ev.actorEmail}</span>
                    {ev.targetTenant && (
                      <>
                        <span className="text-muted-foreground">on</span>
                        <span className="font-mono text-muted-foreground">{ev.targetTenant}</span>
                      </>
                    )}
                    {ev.ip && <span className="text-muted-foreground">({ev.ip})</span>}
                  </div>
                  
                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[13px] tabular-nums text-muted-foreground sm:text-right">
                  {new Date(ev.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </Rows>
        )}
      </Panel>
    </div>
  );
}
