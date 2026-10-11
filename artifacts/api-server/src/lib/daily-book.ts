import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export class DailyBookError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const fail = (status: number, message: string): never => { throw new DailyBookError(status, message); };
export function text(value: unknown, max: number, label: string, optional = false): string {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string") return fail(400, `${label} is required`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max) return fail(400, `${label} must be ${optional ? "0" : "1"}–${max} characters`);
  return result;
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    return fail(400, "A valid record or request ID is required");
  return value.toLowerCase();
}
export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function date(value: unknown, future = true): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail(400, "Use a valid date");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "2000-01-01" || value > "2100-12-31")
    return fail(400, "Use a valid date between 2000 and 2100");
  if (!future && value > todayIST()) return fail(400, "Money entries cannot be dated in the future");
  return value;
}
export function paise(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value)) return fail(400, "Enter a positive rupee amount with at most two decimal places");
  const [whole, fraction = ""] = value.split(".");
  const n = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (n <= 0n || n > 1000000000n) return fail(400, "Amount must be between ₹0.01 and ₹1,00,00,000");
  return n.toString();
}
export function noteInput(body: Record<string, unknown>) {
  if (typeof body.isTask !== "boolean") return fail(400, "Choose note or task");
  return { content: text(body.content, 5000, "Note"), entryDate: date(body.entryDate), isTask: body.isTask,
    dueDate: body.isTask && body.dueDate ? date(body.dueDate) : null };
}
export function entryInput(body: Record<string, unknown>) {
  if (body.direction !== "given" && body.direction !== "received") return fail(400, "Choose Money Given or Money Received");
  if (body.method !== "cash" && body.method !== "upi") return fail(400, "Choose Cash or UPI");
  return { direction: body.direction, amountPaise: paise(body.amount), entryDate: date(body.entryDate, false),
    method: body.method, note: text(body.note, 2000, "Note", true) };
}
export function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(400, "Request must be an object");
  return value as Record<string, unknown>;
}
export function balances(values: string[]) {
  let receivable = 0n, payable = 0n;
  for (const value of values) {
    const n = BigInt(value);
    if (n > 0n) receivable += n;
    else payable -= n;
  }
  return { receivablePaise: receivable.toString(), payablePaise: payable.toString() };
}
/** All feature writes go through one transaction. The lock makes retries atomic
 * even when two servers receive the same request concurrently. No retry expiry:
 * a delayed request must never insert another money entry. */
export async function writeOnce(
  pool: Pick<Pool, "connect">, tenant: string | null, key: unknown, operation: string,
  payload: unknown, action: (client: PoolClient) => Promise<{ status: number; data: unknown }>,
) {
  const requestKey = uuid(key);
  const hash = createHash("sha256").update(JSON.stringify([operation, payload])).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`daily-book:${tenant ?? "__legacy_null__"}:${requestKey}`]);
    const previous = await client.query("SELECT payload_hash, status, response FROM daily_book_requests WHERE tenant_id IS NOT DISTINCT FROM $1 AND request_key=$2", [tenant, requestKey]);
    if (previous.rows[0]) {
      const row = previous.rows[0];
      if (row.payload_hash !== hash) fail(409, "This request ID was used for another change. Reload before making a different change.");
      await client.query("COMMIT");
      return { status: row.status as number, data: row.response as unknown };
    }
    const result = await action(client);
    await client.query("INSERT INTO daily_book_requests(tenant_id, request_key, payload_hash, status, response) VALUES($1,$2,$3,$4,$5::jsonb)",
      [tenant, requestKey, hash, result.status, JSON.stringify(result.data)]);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
