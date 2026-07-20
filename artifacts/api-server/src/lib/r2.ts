/**
 * Cloudflare R2 (S3-compatible) storage for database backups.
 *
 * Configured entirely from env — when the R2_* vars are unset the backup
 * routine silently skips R2 and keeps working with Telegram only:
 *   R2_ACCOUNT_ID        Cloudflare account id (dashboard → R2 → API)
 *   R2_ACCESS_KEY_ID     R2 API token key id
 *   R2_SECRET_ACCESS_KEY R2 API token secret
 *   R2_BUCKET            bucket name (e.g. addisonbill-backups)
 *   R2_BACKUP_KEEP       optional — how many newest backups to keep (default 30)
 */
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { logger } from "./logger";

const PREFIX = "backups/";

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
export async function uploadBackupToR2(filename: string, content: Buffer): Promise<string> {
  const key = `${PREFIX}${filename}`;
  await client().send(new PutObjectCommand({
    Bucket:      env("R2_BUCKET"),
    Key:         key,
    Body:        content,
    ContentType: "application/gzip",
  }));
  return key;
}

/**
 * Retention: keep only the newest N backups under the prefix (default 30 —
 * a month of nightlies). Best-effort by design: a prune failure must never
 * fail the backup that just succeeded, so callers fire-and-forget this.
 */
export async function pruneOldR2Backups(): Promise<void> {
  const keepRaw = Number(process.env.R2_BACKUP_KEEP ?? 30);
  const keep = Number.isFinite(keepRaw) && keepRaw > 0 ? Math.floor(keepRaw) : 30;
  try {
    const listed = await client().send(new ListObjectsV2Command({
      Bucket: env("R2_BUCKET"),
      Prefix: PREFIX,
    }));
    const objects = (listed.Contents ?? [])
      .filter((o) => o.Key)
      .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));
    const stale = objects.slice(keep);
    if (stale.length === 0) return;
    await client().send(new DeleteObjectsCommand({
      Bucket: env("R2_BUCKET"),
      Delete: { Objects: stale.map((o) => ({ Key: o.Key! })), Quiet: true },
    }));
    logger.info({ deleted: stale.length, kept: keep }, "pruned old R2 backups");
  } catch (err) {
    logger.warn({ err }, "R2 backup prune failed (backup itself unaffected)");
  }
}
