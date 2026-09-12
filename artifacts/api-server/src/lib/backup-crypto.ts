/**
 * At-rest encryption for backup files.
 *
 * A backup holds every shop's records plus every staff PIN and owner password
 * hash. Gzip is not protection: anyone with the R2 credentials, the Telegram
 * chat, or a downloaded copy can read it all. When BACKUP_ENCRYPTION_KEY is
 * set, the gzipped snapshot is sealed with AES-256-GCM before it leaves the
 * server, and the same key is required to restore it.
 *
 * File layout (".json.gz.enc"):
 *   "ABKP" | version(1) | salt(16) | iv(12) | ciphertext | GCM tag(16)
 * The header is authenticated (AAD), so a tampered version byte or salt fails
 * the same way a tampered body does. The key is derived per file with scrypt
 * so the secret can be a passphrase rather than raw key material.
 *
 * Unencrypted files are still accepted on restore — there is a month of them
 * in R2 and older copies in Telegram — so switching encryption on never locks
 * anyone out of history. Losing the key, however, makes every encrypted file
 * unreadable. The admin page says so; it is the one thing to keep safe.
 *
 * Pure module (no database import) so it can be unit-tested.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const MAGIC    = Buffer.from("ABKP", "ascii");
const VERSION  = 1;
const SALT_LEN = 16;
const IV_LEN   = 12;
const TAG_LEN  = 16;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN;
const SCRYPT = { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const ENCRYPTED_EXTENSION = ".enc";
/** Floor against token-like values ("1234", "secret"), not a strength
 *  guarantee — a 12-character dictionary phrase is still weak. The per-file
 *  scrypt derivation is what makes a decent passphrase expensive to guess. */
export const MIN_KEY_LENGTH = 12;

export class BackupKeyError extends Error {}

/**
 * The configured key, or null when encryption is off.
 *
 * A key that is set but too short throws rather than being ignored: silently
 * writing plaintext while the admin page says "encrypted" would be worse than
 * either state.
 */
export function resolveBackupKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env["BACKUP_ENCRYPTION_KEY"]?.trim();
  if (!raw) return null;
  if (raw.length < MIN_KEY_LENGTH) {
    throw new BackupKeyError(`BACKUP_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters — refusing to write an easily guessable backup`);
  }
  return raw;
}

export function isBackupEncryptionOn(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return resolveBackupKey(env) !== null;
  } catch {
    return false;
  }
}

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  return bytes.length >= HEADER_LEN + TAG_LEN && Buffer.from(bytes.subarray(0, MAGIC.length)).equals(MAGIC);
}

export function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv   = randomBytes(IV_LEN);
  const header = Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv]);
  const key = scryptSync(passphrase, salt, 32, SCRYPT);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, body, cipher.getAuthTag()]);
}

/** Throws on a wrong key, a tampered file, or an unknown version. */
export function decryptBackup(bytes: Buffer, passphrase: string): Buffer {
  if (!isEncryptedBackup(bytes)) throw new Error("not an encrypted backup");
  const version = bytes[MAGIC.length];
  if (version !== VERSION) throw new Error(`unsupported encrypted backup version ${version}`);
  const header = bytes.subarray(0, HEADER_LEN);
  const salt   = bytes.subarray(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN);
  const iv     = bytes.subarray(MAGIC.length + 1 + SALT_LEN, HEADER_LEN);
  const body   = bytes.subarray(HEADER_LEN, bytes.length - TAG_LEN);
  const tag    = bytes.subarray(bytes.length - TAG_LEN);
  const key = scryptSync(passphrase, salt, 32, SCRYPT);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/**
 * Turn whatever was stored (encrypted or not) back into the gzipped snapshot,
 * with errors an admin can act on.
 */
export function openBackupBytes(bytes: Buffer, passphrase: string | null): Buffer {
  if (!isEncryptedBackup(bytes)) return bytes;
  if (!passphrase) {
    throw new Error(
      "This backup is encrypted, but BACKUP_ENCRYPTION_KEY is not set on this server. " +
      "Add the same key that was in place when the backup was taken, then try again.",
    );
  }
  try {
    return decryptBackup(bytes, passphrase);
  } catch {
    throw new Error(
      "Could not decrypt this backup — BACKUP_ENCRYPTION_KEY does not match the key it was " +
      "encrypted with, or the file is corrupt. Nothing was changed.",
    );
  }
}
