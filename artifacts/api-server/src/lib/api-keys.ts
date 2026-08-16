/**
 * Key generation + hashing for the public API.
 *
 * Format: `adb_` + 48 hex chars (24 random bytes). The raw key is returned
 * to the caller exactly once at creation; only the sha256 hex digest is
 * persisted, so a database leak never exposes usable keys.
 */
import { createHash, randomBytes } from "node:crypto";

/** Shown in lists so the owner can recognise a key without revealing it. */
export const KEY_PREFIX_LENGTH = 12;

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = "adb_" + randomBytes(24).toString("hex");
  return { key, hash: hashApiKey(key), prefix: key.slice(0, KEY_PREFIX_LENGTH) };
}
