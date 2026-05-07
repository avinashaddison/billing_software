import { useState, useEffect } from "react";

export interface ScanEvent {
  id: number;
  timestamp: Date;
  type: "detected" | "missed";
  code?: string;
  maxElapsedMs: number;
}

const MAX_EVENTS = 20;
const STORAGE_KEY = "toy-mall-scan-events";

let seq = 0;
const events: ScanEvent[] = [];
const listeners: Set<() => void> = new Set();

function serialize(evs: ScanEvent[]): string {
  return JSON.stringify(
    evs.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() }))
  );
}

function isValidEvent(e: Record<string, unknown>): boolean {
  if (typeof e.id !== "number" || !Number.isFinite(e.id)) return false;
  if (e.type !== "detected" && e.type !== "missed") return false;
  if (typeof e.timestamp !== "string") return false;
  const ts = new Date(e.timestamp);
  if (isNaN(ts.getTime())) return false;
  if (typeof e.maxElapsedMs !== "number" || !Number.isFinite(e.maxElapsedMs)) return false;
  if (e.code !== undefined && typeof e.code !== "string") return false;
  return true;
}

function deserialize(raw: string): ScanEvent[] {
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e !== null && typeof e === "object" && isValidEvent(e as Record<string, unknown>))
      .slice(0, MAX_EVENTS)
      .map((e) => ({
        id: Number(e.id),
        timestamp: new Date(e.timestamp as string),
        type: e.type as "detected" | "missed",
        code: e.code as string | undefined,
        maxElapsedMs: Number(e.maxElapsedMs),
      }));
  } catch {
    return [];
  }
}

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = deserialize(raw);
    if (stored.length === 0) return;
    events.push(...stored);
    seq = Math.max(...events.map((e) => e.id)) + 1;
    saveToStorage();
  } catch {
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(events));
  } catch {
  }
}

loadFromStorage();

export function addScanEvent(event: Omit<ScanEvent, "id">): void {
  events.unshift({ ...event, id: seq++ });
  if (events.length > MAX_EVENTS) events.pop();
  saveToStorage();
  listeners.forEach((fn) => fn());
}

export function getScanEvents(): readonly ScanEvent[] {
  return events;
}

export function clearScanEvents(): void {
  events.length = 0;
  seq = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  listeners.forEach((fn) => fn());
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
