import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Request } from "express";
import { db, authUsersTable, staffProfilesTable } from "@workspace/db";

export class ManualAccessError extends Error {
  constructor(public status: number, message: string, public code = "MANUAL_ACCESS_REQUIRED") { super(message); }
}
export type Execute = (query: SQL) => Promise<{ rows: unknown[] }>;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function normalizeKey(key: unknown): string {
  return typeof key === "string" ? key.trim().toUpperCase().replace(/[\s-]/g, "") : "";
}
export function generateAccessKey(): string {
  // 64 bits of cryptographic entropy, plus a readable owner-shareable format.
  const raw = randomBytes(8).toString("hex").toUpperCase();
  return `MB-${raw.match(/.{4}/g)!.join("-")}`;
}
function encryptionKey(secret: string) {
  if (secret.length < 16) throw new ManualAccessError(503, "Manual access key encryption is not configured.", "MANUAL_ACCESS_UNAVAILABLE");
  return createHash("sha256").update("manual-billing-key:v1\0").update(secret).digest();
}
export function encryptAccessKey(key: string, tenant: string | null, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(["manual-billing", tenant])));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString("base64")).join(".");
}
export function decryptAccessKey(value: string, tenant: string | null, secret: string): string {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted manual key");
  const [iv, tag, body] = parts.map(p => Buffer.from(p, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(["manual-billing", tenant])));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8");
}
export function keyMatches(key: unknown, hash: string): boolean {
  const normalized = normalizeKey(key);
  if (!/^MB[0-9A-F]{16}$/.test(normalized) || !/^[0-9a-f]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(digest(normalized), "hex"), Buffer.from(hash, "hex"));
}
export async function billingActor(req: Request): Promise<{ id: string; owner: boolean }> {
  const tenant = req.tenantId ?? null;
  if (req.authKind === "email" && req.userId) {
    const [user] = await db.select().from(authUsersTable).where(eq(authUsersTable.id, req.userId));
    if (user?.isActive && (user.tenantId ?? null) === tenant)
      return { id: `email:${user.id}`, owner: user.role === "owner" || user.role === "admin" };
  } else if (req.staffId) {
    const [staff] = await db.select().from(staffProfilesTable).where(eq(staffProfilesTable.id, req.staffId));
    if (staff?.isActive && (staff.tenantId ?? null) === tenant)
      return { id: `pin:${staff.id}`, owner: staff.role === "owner" };
  }
  throw new ManualAccessError(403, "Unable to verify your billing access.");
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k,v]) => k !== "manualAccessToken" && v !== undefined)
      .sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k, canonical(v)]));
  }
  return value;
}
export const billFingerprint = (body: unknown) => digest(JSON.stringify(canonical(body)));
type ApprovalRow = { id: string; key_revision: string; expires_at: Date; bill_hash: string | null; response: Record<string, unknown> | null };
export async function lockManualApproval(
  execute: Execute, tenant: string | null, actor: string, token: unknown, body: unknown,
): Promise<ApprovalRow> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ManualAccessError(403, "Ask the owner for the current access key to bill manual items.");
  // Same lock order as authorization/rotation: key first, approval second.
  // A rotation cannot overtake an already-authorized checkout transaction.
  const keys = await execute(sql`SELECT revision FROM manual_billing_keys WHERE tenant_id IS NOT DISTINCT FROM ${tenant} FOR SHARE`);
  const rows = await execute(sql`SELECT id,key_revision,expires_at,bill_hash,response FROM manual_billing_approvals
    WHERE tenant_id IS NOT DISTINCT FROM ${tenant} AND actor_id=${actor} AND token_hash=${digest(token)} FOR UPDATE`);
  const row = rows.rows[0] as ApprovalRow | undefined;
  if (!row)
    throw new ManualAccessError(403, "Manual billing approval expired. Enter the owner's current key again.");
  if (row.response) {
    if (row.bill_hash !== billFingerprint(body))
      throw new ManualAccessError(409, "The previous manual bill was already saved. Check it before creating another bill.", "MANUAL_ACCESS_USED");
    return row; // Replay of a committed bill, never a second sale.
  }
  if (new Date(row.expires_at).getTime() <= Date.now())
    throw new ManualAccessError(403, "Manual billing approval expired. Enter the owner's current key again.");
  if ((keys.rows[0] as { revision?: string } | undefined)?.revision !== row.key_revision)
    throw new ManualAccessError(403, "The owner regenerated the access key. Ask for the new key.");
  return row;
}
export async function finishManualApproval(execute: Execute, id: string, body: unknown, billId: string, response: unknown) {
  await execute(sql`UPDATE manual_billing_approvals SET bill_hash=${billFingerprint(body)},bill_id=${billId},
    response=${JSON.stringify(response)}::jsonb WHERE id=${id}`);
}
