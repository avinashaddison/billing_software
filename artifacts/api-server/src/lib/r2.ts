/**
 * Cloudflare R2 (S3-compatible) storage for database backups.
 *
 * Configured entirely from env — when the R2_* vars are unset the backup
 * routine silently skips R2 and keeps working with Telegram only:
 *   R2_ACCOUNT_ID        Cloudflare account id (dashboard → R2 → API)
 *   R2_ACCESS_KEY_ID     R2 API token key id
 *   R2_SECRET_ACCESS_KEY R2 API token secret
 *   R2_BUCKET            bucket name (e.g. addisonbill-backups)
 *   R2_BACKUP_KEEP       optional — how many newest nightly backups to keep (default 30)
 *
 * Two namespaces, two retention rules:
 *   backups/<file>            nightly + manual + safety copies — the archive,
 *                             newest R2_BACKUP_KEEP kept (count-based).
 *   backups/intraday/<file>   hourly-ish snapshots — a ring buffer, anything
 *                             older than INTRADAY_RETENTION_HOURS is dropped.
 * Keeping them apart is what stops a day of hourly snapshots from pushing a
 * month of nightlies out of the archive.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { logger } from "./logger";
import { classifyBackupKey, INTRADAY_RETENTION_HOURS } from "./backup-schedule";

const PREFIX          = "backups/";
const INTRADAY_PREFIX = "backups/intraday/";

export type R2BackupKind = "nightly" | "intraday";

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function isR2Configured(): boolean {
  return !!(env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && env("R2_BUCKET"));
}

let cachedClient: S3Client | null = null;
function client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region:   "auto",
      endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     env("R2_ACCESS_KEY_ID")!,
        secretAccessKey: env("R2_SECRET_ACCESS_KEY")!,
      },
    });
  }
  return cachedClient;
}

/** Upload one backup file; returns the object key. Throws on failure. */
export async function uploadBackupToR2(filename: string, content: Buffer, kind: R2BackupKind = "nightly"): Promise<string> {
  const key = `${kind === "intraday" ? INTRADAY_PREFIX : PREFIX}${filename}`;
  await client().send(new PutObjectCommand({
    Bucket:      env("R2_BUCKET"),
    Key:         key,
    Body:        content,
    ContentType: filename.endsWith(".enc") ? "application/octet-stream" : "application/gzip",
  }));
  return key;
}

export interface R2BackupObject {
  key:          string;
  filename:     string;
  kind:         R2BackupKind;
  sizeBytes:    number;
  lastModified: string | null;
}

/** Every object under the prefix, across pages (one page caps at 1,000 keys). */
async function listAll(prefix: string): Promise<_Object[]> {
  const out: _Object[] = [];
  let token: string | undefined;
  do {
    const page = await client().send(new ListObjectsV2Command({
      Bucket: env("R2_BUCKET"),
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const o of page.Contents ?? []) if (o.Key) out.push(o);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

const newestFirst = (a: _Object, b: _Object) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0);

/** List stored backups of both kinds, newest first. */
export async function listR2Backups(): Promise<R2BackupObject[]> {
  return (await listAll(PREFIX))
    .sort(newestFirst)
    .map((o) => ({
      key:          o.Key!,
      filename:     o.Key!.slice(o.Key!.lastIndexOf("/") + 1),
      kind:         classifyBackupKey(o.Key!),
      sizeBytes:    o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? null,
    }));
}

/** True when `key` addresses an object inside the backups prefix — the only
 *  namespace the admin endpoints are allowed to touch. */
export function isBackupKey(key: string): boolean {
  return /^backups\/(?:intraday\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key);
}

/** Fetch one backup object into memory. Shop-scale files (a few MB gzipped). */
export async function downloadR2Backup(key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key:    key,
  }));
  if (!res.Body) throw new Error("Empty object body");
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

async function deleteKeys(keys: string[]): Promise<void> {
  /* DeleteObjects takes at most 1,000 keys per call. */
  for (let i = 0; i < keys.length; i += 1000) {
    await client().send(new DeleteObjectsCommand({
      Bucket: env("R2_BUCKET"),
      Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
    }));
  }
}

/**
 * Nightly retention: keep only the newest N objects at the top level of the
 * prefix (default 30 — a month of nightlies). Intraday objects live in their
 * own sub-prefix and are neither counted nor touched here. Best-effort by
 * design: a prune failure must never fail the backup that just succeeded, so
 * callers fire-and-forget this.
 */
export async function pruneOldR2Backups(): Promise<void> {
  const keepRaw = Number(process.env.R2_BACKUP_KEEP ?? 30);
  const keep = Number.isFinite(keepRaw) && keepRaw > 0 ? Math.floor(keepRaw) : 30;
  try {
    const nightly = (await listAll(PREFIX))
      .filter((o) => classifyBackupKey(o.Key!) === "nightly")
      .sort(newestFirst);
    const stale = nightly.slice(keep);
    if (stale.length === 0) return;
    await deleteKeys(stale.map((o) => o.Key!));
    logger.info({ deleted: stale.length, kept: keep }, "pruned old R2 backups");
  } catch (err) {
    logger.warn({ err }, "R2 backup prune failed (backup itself unaffected)");
  }
}

/** Intraday retention: a rolling window by age, independent of how often
 *  they run. Best-effort, same as the nightly prune. */
export async function pruneIntradayR2Backups(maxAgeHours = INTRADAY_RETENTION_HOURS): Promise<void> {
  const cutoff = Date.now() - maxAgeHours * 3_600_000;
  try {
    const stale = (await listAll(INTRADAY_PREFIX))
      .filter((o) => (o.LastModified?.getTime() ?? Infinity) < cutoff);
    if (stale.length === 0) return;
    await deleteKeys(stale.map((o) => o.Key!));
    logger.info({ deleted: stale.length, maxAgeHours }, "pruned old intraday R2 backups");
  } catch (err) {
    logger.warn({ err }, "intraday R2 prune failed (backup itself unaffected)");
  }
}
