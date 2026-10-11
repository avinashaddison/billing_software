import { useAuth } from "@/hooks/use-auth";

export interface DailyNote {
  id: string; content: string; entryDate: string; isTask: boolean; dueDate: string | null;
  completed: boolean; archived: boolean; version: number; createdAt: string; updatedAt: string;
}
export interface NoteInput { content: string; entryDate: string; isTask: boolean; dueDate: string | null }
export interface KhataAccount { id: string; name: string; archived: boolean; balancePaise: string; createdAt: string }
export interface KhataEntry {
  id: string; accountId: string; direction: "given" | "received"; amountPaise: string; entryDate: string;
  method: "cash" | "upi"; note: string; voidedAt: string | null; voidReason: string | null;
  correctedFrom: string | null; createdAt: string;
}
export interface MoneyInput { direction: "given" | "received"; amount: string; entryDate: string; method: "cash" | "upi"; note: string }
export interface AccountsResponse { accounts: KhataAccount[]; receivablePaise: string; payablePaise: string }
export interface PendingWrite { key: string; path: string; method: string; body: unknown; label: string }
const base = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/daily-book`;
const storageKey = () => `daily-book-pending:${useAuth.getState().staffId ?? "anonymous"}`;
export function pendingWrite(): PendingWrite | null {
  const saved = sessionStorage.getItem(storageKey());
  if (!saved) return null;
  try { return JSON.parse(saved) as PendingWrite; }
  catch { throw new Error("The pending-save record cannot be read. Do not re-enter money until the original save is checked."); }
}
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${base}${path}`, { signal });
  if (!response.ok) throw new Error(`Could not load Daily Book (HTTP ${response.status}). Retry without changing your records.`);
  try { return await response.json() as T; }
  catch { throw new Error("The server returned an unreadable response. Please retry."); }
}
let sending = false;
async function send<T>(pending: PendingWrite, originalStorageKey = storageKey()): Promise<T> {
  if (sending) throw new Error("A save is already running. Please wait.");
  sending = true;
  try {
    const response = await fetch(`${base}${pending.path}`, { method: pending.method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key }, body: JSON.stringify(pending.body),
      signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        sessionStorage.removeItem(originalStorageKey);
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : `Change rejected (HTTP ${response.status}).`);
      }
      throw new Error(`Save not confirmed (HTTP ${response.status}). Retry the pending save; do not enter it twice.`);
    }
    const data = await response.json() as T;
    const confirmation = data as Record<string, unknown> | null;
    const idField = pending.path.endsWith("/correct") ? "voidedId" : "id";
    if (!confirmation || typeof confirmation !== "object" || typeof confirmation[idField] !== "string"
      || !/^[0-9a-f-]{36}$/i.test(confirmation[idField] as string)) {
      throw new Error("Save returned an unreadable confirmation. Retry the pending save before making another change.");
    }
    sessionStorage.removeItem(originalStorageKey);
    return data;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError || (error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name)))
      throw new Error("Save not confirmed. Retry the pending save when connected; the same request cannot create duplicate entries.");
    throw error;
  } finally { sending = false; }
}
async function write<T>(path: string, method: string, body: unknown, label: string): Promise<T> {
  if (pendingWrite()) throw new Error("Resolve the previous pending save before making another change.");
  if (!useAuth.getState().staffId) throw new Error("Please sign in again before saving.");
  const pending: PendingWrite = { key: crypto.randomUUID(), path, method, body, label };
  sessionStorage.setItem(storageKey(), JSON.stringify(pending));
  return send<T>(pending);
}
export async function retryPendingWrite(): Promise<unknown> {
  const pending = pendingWrite();
  if (!pending) throw new Error("There is no pending save.");
  return send(pending);
}
export const dailyBookApi = {
  notes: (signal?: AbortSignal) => read<DailyNote[]>("/notes", signal),
  accounts: (signal?: AbortSignal) => read<AccountsResponse>("/accounts", signal),
  entries: (id: string, signal?: AbortSignal) => read<KhataEntry[]>(`/accounts/${id}/entries`, signal),
  createNote: (input: NoteInput) => write<DailyNote>("/notes", "POST", input, "Save note/task"),
  updateNote: (note: DailyNote, patch: Partial<NoteInput & { completed: boolean; archived: boolean }>) =>
    write<DailyNote>(`/notes/${note.id}`, "PATCH",
      { content: note.content, entryDate: note.entryDate, isTask: note.isTask, dueDate: note.dueDate,
        completed: note.completed, archived: note.archived, version: note.version, ...patch,
        ...(patch.isTask === false ? { completed: false } : {}) }, "Update note/task"),
  createAccount: (name: string) => write<KhataAccount>("/accounts", "POST", { name }, "Create khata account"),
  archiveAccount: (id: string, archived: boolean) => write(`/accounts/${id}`, "PATCH", { archived }, archived ? "Archive account" : "Restore account"),
  createEntry: (id: string, input: MoneyInput) => write<KhataEntry>(`/accounts/${id}/entries`, "POST", input, "Record money"),
  correctEntry: (id: string, entryId: string, reason: string, replacement: MoneyInput | null) =>
    write(`/accounts/${id}/entries/${entryId}/correct`, "POST", { reason, replacement }, "Correct money entry"),
};
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function rupees(amountPaise: string): string {
  const n = BigInt(amountPaise), absolute = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}₹${(absolute / 100n).toLocaleString("en-IN")}.${(absolute % 100n).toString().padStart(2, "0")}`;
}
export function balanceLabel(value: string): string {
  const n = BigInt(value);
  return n > 0n ? "They owe me" : n < 0n ? "I owe them" : "Settled";
}
