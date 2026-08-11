import { useAdminAudit } from "./api";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Activity, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AuditLog() {
  const { data, isLoading, error } = useAdminAudit();

  if (isLoading) return <Skeleton className="w-full h-[600px] rounded-2xl" />;

  const events = data?.events || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-[calc(100dvh-120px)]">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">Recent platform-level actions</p>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b bg-muted/30 flex items-center gap-2 font-medium shrink-0">
          <ScrollText className="w-4 h-4 text-primary" />
          Last 100 Events
        </div>
        
        <ScrollArea className="flex-1">
          {error ? (
            <div className="p-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="font-medium text-destructive">Could not load the audit log</p>
              <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Activity className="w-12 h-12 mb-3 opacity-20" />
              <p>No audit events found.</p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((ev: any) => (
                <div key={ev.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{ev.action}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono bg-muted px-1.5 rounded">{ev.actorEmail}</span>
                        {ev.targetTenant && <span>→ <span className="font-mono">{ev.targetTenant}</span></span>}
                        {ev.ip && <span className="opacity-50">({ev.ip})</span>}
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <div className="mt-3 p-2 bg-muted/50 rounded-lg text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
