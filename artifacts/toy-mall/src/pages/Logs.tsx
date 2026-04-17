import { useState } from "react";
import { useListStockLogs, getListStockLogsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Clock, ArrowDownToLine, ArrowUpToLine, Settings2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListStockLogsType } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Logs() {
  const [type, setType] = useState<ListStockLogsType | "ALL">("ALL");
  
  const queryParams = type === "ALL" ? {} : { type };
  
  const { data: logs, isLoading } = useListStockLogs(queryParams, {
    query: { queryKey: getListStockLogsQueryKey(queryParams) }
  });

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case "IN": return <ArrowDownToLine className="w-4 h-4 text-success" />;
      case "OUT": return <ArrowUpToLine className="w-4 h-4 text-destructive" />;
      default: return <Settings2 className="w-4 h-4 text-secondary" />;
    }
  };

  const getLogColor = (logType: string) => {
    switch (logType) {
      case "IN": return "text-success bg-success/10 border-success/20";
      case "OUT": return "text-destructive bg-destructive/10 border-destructive/20";
      default: return "text-secondary bg-secondary/10 border-secondary/20";
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b sticky top-0 bg-background z-10 space-y-4">
        <div className="flex items-center gap-2 text-primary font-black text-2xl">
          <Clock className="w-6 h-6" />
          <h1>Activity Logs</h1>
        </div>
        
        <Select value={type} onValueChange={(val: any) => setType(val)}>
          <SelectTrigger className="w-full h-12 rounded-xl bg-muted/50 border-transparent font-bold">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Activity</SelectItem>
            <SelectItem value="IN">Stock IN</SelectItem>
            <SelectItem value="OUT">Stock OUT</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 p-4 overflow-y-auto pb-32">
        <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10" />
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border bg-card shadow-sm">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))
          ) : logs?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground relative z-10 bg-background/80 backdrop-blur-sm rounded-xl">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">No activity yet</p>
            </div>
          ) : (
            logs?.map((log) => (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${getLogColor(log.type).replace('text-', 'bg-').replace('bg-', 'bg-white text-')}`}>
                  {getLogIcon(log.type)}
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM d, h:mm a")}
                    </span>
                    <Badge variant="outline" className={`font-bold text-[10px] ${getLogColor(log.type)}`}>
                      {log.type}
                    </Badge>
                  </div>
                  
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-sm truncate">{log.productName}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{log.productSku}</p>
                    </div>
                    
                    <div className={`flex items-center gap-1 font-black text-lg ${log.type === 'IN' ? 'text-success' : log.type === 'OUT' ? 'text-destructive' : 'text-secondary'}`}>
                      {log.type === 'IN' ? '+' : log.type === 'OUT' ? '-' : ''}{log.quantity}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
