import { useQueryClient } from "@tanstack/react-query";
import { useAdminAudit, adminQueryKeys } from "./api";
import { PageHeader, Panel, Rows, EmptyState, LoadError, PanelSkeleton, formatDateTime } from "./ui";

export default function AuditLog() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useAdminAudit();

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-300 pb-12">
        <PageHeader title="Audit log" meta="Recent platform-level actions" />
        <PanelSkeleton rows={10} />
      </div>
    );
  }

  const events = data?.events || [];

  return (
    <div className="animate-in fade-in duration-300 pb-12">
      <PageHeader title="Audit log" meta="Recent platform-level actions" />

      <Panel>
        {error ? (
          <LoadError 
            message={(error as Error).message} 
            onRetry={() => queryClient.invalidateQueries({ queryKey: adminQueryKeys.audit })}
          />
        ) : events.length === 0 ? (
          <EmptyState title="No audit events found" hint="When platform actions occur, they will appear here." />
        ) : (
          <Rows>
            {events.map((ev: any) => (
              <div key={ev.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between transition-colors hover:bg-gray-50/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] leading-tight">
                    <span className="font-semibold text-gray-900">{ev.action}</span>
                    <span className="text-gray-400">by</span>
                    <span className="truncate max-w-[200px] font-mono text-[12px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" title={ev.actorEmail}>{ev.actorEmail}</span>
                    {ev.targetTenant && (
                      <>
                        <span className="text-gray-400">on</span>
                        <span className="truncate max-w-[150px] font-mono text-[12px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" title={ev.targetTenant}>{ev.targetTenant}</span>
                      </>
                    )}
                    {ev.ip && <span className="truncate max-w-[120px] text-gray-400" title={ev.ip}>({ev.ip})</span>}
                  </div>
                  
                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-gray-100 bg-white p-3 font-mono text-[11px] leading-relaxed text-gray-600 break-all shadow-sm shadow-black/5">
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[12px] font-semibold tracking-wide tabular-nums text-gray-400 sm:text-right sm:pl-4 pt-1">
                  {formatDateTime(ev.createdAt)}
                </div>
              </div>
            ))}
          </Rows>
        )}
      </Panel>
    </div>
  );
}
