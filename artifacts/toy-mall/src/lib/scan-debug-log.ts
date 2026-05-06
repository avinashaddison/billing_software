import { useState, useEffect } from "react";

export interface ScanEvent {
  id: number;
  timestamp: Date;
  type: "detected" | "missed";
  code?: string;
  maxElapsedMs: number;
}

const MAX_EVENTS = 20;
let seq = 0;
const events: ScanEvent[] = [];
const listeners: Set<() => void> = new Set();

export function addScanEvent(event: Omit<ScanEvent, "id">): void {
  events.unshift({ ...event, id: seq++ });
  if (events.length > MAX_EVENTS) events.pop();
  listeners.forEach((fn) => fn());
}

export function getScanEvents(): readonly ScanEvent[] {
  return events;
}

export function useScanDebugLog(): readonly ScanEvent[] {
  const [log, setLog] = useState<readonly ScanEvent[]>(getScanEvents());
  useEffect(() => {
    const notify = () => setLog([...getScanEvents()]);
    listeners.add(notify);
    return () => { listeners.delete(notify); };
  }, []);
  return log;
}
