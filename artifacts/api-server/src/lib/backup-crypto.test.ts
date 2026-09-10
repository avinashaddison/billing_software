import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import {
  encryptBackup, decryptBackup, openBackupBytes, isEncryptedBackup, resolveBackupKey, BackupKeyError,
} from "./backup-crypto";

const key = "correct horse battery staple 2026";
const plain = zlib.gzipSync(Buffer.from(JSON.stringify({ meta: {}, data: { bills: [{ id: 1 }] } })));

describe("encryptBackup / decryptBackup", () => {
  it("round-trips and is recognisable as encrypted", () => {
    const sealed = encryptBackup(plain, key);
    expect(isEncryptedBackup(sealed)).toBe(true);
    expect(isEncryptedBackup(plain)).toBe(false);
    expect(decryptBackup(sealed, key).equals(plain)).toBe(true);
  });

  it("never produces the same ciphertext twice (fresh salt + IV)", () => {
    expect(encryptBackup(plain, key).equals(encryptBackup(plain, key))).toBe(false);
  });

  it("rejects the wrong key", () => {
    const sealed = encryptBackup(plain, key);
    expect(() => decryptBackup(sealed, key + "x")).toThrow();
  });

  it("rejects a tampered body and a tampered header", () => {
    const sealed = encryptBackup(plain, key);
    const body = Buffer.from(sealed); body[body.length - 20] ^= 0x01;
    expect(() => decryptBackup(body, key)).toThrow();
    const header = Buffer.from(sealed); header[4] = 2;            // version byte
    expect(() => decryptBackup(header, key)).toThrow(/version/);
    const salt = Buffer.from(sealed); salt[6] ^= 0x01;            // inside the salt (AAD)
    expect(() => decryptBackup(salt, key)).toThrow();
  });
});

describe("openBackupBytes", () => {
  it("passes plain gzip through untouched, with or without a key", () => {
    expect(openBackupBytes(plain, null)).toBe(plain);
    expect(openBackupBytes(plain, key)).toBe(plain);
  });

  it("explains a missing key and a wrong key in admin language", () => {
    const sealed = encryptBackup(plain, key);
    expect(() => openBackupBytes(sealed, null)).toThrow(/BACKUP_ENCRYPTION_KEY is not set/);
    expect(() => openBackupBytes(sealed, "some other passphrase!")).toThrow(/does not match/);
    expect(openBackupBytes(sealed, key).equals(plain)).toBe(true);
  });
});

describe("resolveBackupKey", () => {
  it("is null when unset or blank", () => {
    expect(resolveBackupKey({})).toBeNull();
    expect(resolveBackupKey({ BACKUP_ENCRYPTION_KEY: "   " })).toBeNull();
  });

  it("refuses a short key instead of silently writing plaintext", () => {
    expect(() => resolveBackupKey({ BACKUP_ENCRYPTION_KEY: "short" })).toThrow(BackupKeyError);
  });

  it("trims and returns a usable key", () => {
    expect(resolveBackupKey({ BACKUP_ENCRYPTION_KEY: ` ${key} ` })).toBe(key);
  });
});
