import crypto from "node:crypto";
import fs     from "node:fs";
import path   from "node:path";
import { fileURLToPath } from "node:url";
import { db, licenseStatusTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const TRIAL_DAYS = 14;

/**
 * HMAC secret used to sign + verify license keys. Loaded once at module
 * init. Must match what scripts/gen-license.ts uses to sign new keys.
 *
 * Lookup order:
 *   1. LICENSE_SECRET env var
 *   2. .license-secret file at the repo root (auto-created by gen-key.bat)
 *   3. Hardcoded default (placeholder — vendor MUST replace before sales)
 *
 * Yes, baking secrets into the binary is not bulletproof. The point is to
 * deter casual sharing of the install, not to defeat reverse engineering.
 */
function loadSigningSecret(): string {
  const fromEnv = process.env["LICENSE_SECRET"]?.trim();
  if (fromEnv) return fromEnv;

  // Walk up from this file to find the repo root and look for .license-secret
  try {
    const __filename = fileURLToPath(import.meta.url);
    let dir = path.dirname(__filename);
    for (let i = 0; i < 8; i++) {
      const candidate = path.join(dir, ".license-secret");
      if (fs.existsSync(candidate)) {
        const v = fs.readFileSync(candidate, "utf8").trim();
        if (v) return v;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* fall through */ }

  return "counter-billing-license-v1-do-not-leak-this-to-customers";
}

const SECRET = loadSigningSecret();

export interface LicensePayload {
  /** Shop identifier (slug, free-form) */
  shop:    string;
  /** ISO date or "perpetual" */
  expiry:  string;
  /** ISO date the key was issued */
  issued:  string;
  /** Optional edition tag — "standard" | "pro" */
  edition?: string;
}

export interface LicenseStatus {
  valid:    boolean;
  mode:     "licensed" | "trial" | "expired" | "invalid" | "trial_expired";
  payload?: LicensePayload;
  trialEndsAt?: string;
  daysRemaining?: number;
  reason?:  string;
}

/* ───────── helpers ───────── */

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/* ───────── verify ───────── */

export function verifyLicense(key: string): { ok: true; payload: LicensePayload } | { ok: false; reason: string } {
  if (!key || typeof key !== "string") {
    return { ok: false, reason: "Empty license key" };
  }
  const parts = key.trim().split(".");
  if (parts.length !== 2) return { ok: false, reason: "Malformed license key" };

  const [b64, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  if (!safeEqual(sig, expected)) return { ok: false, reason: "Invalid signature" };

  let payload: LicensePayload;
  try {
    const json = Buffer.from(b64, "base64url").toString("utf8");
    payload = JSON.parse(json) as LicensePayload;
  } catch {
    return { ok: false, reason: "Could not decode license payload" };
  }
  if (!payload.shop || !payload.expiry || !payload.issued) {
    return { ok: false, reason: "License payload missing required fields" };
  }
  return { ok: true, payload };
}

/* ───────── generate (also used by scripts/gen-license.ts) ───────── */

export function generateLicense(payload: LicensePayload): string {
  const b64 = b64urlEncode(JSON.stringify(payload));
  const hmac = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${hmac}`;
}

/* ───────── trial tracking ───────── */

interface StatusRow {
  firstBootAt: Date;
  keyOverride: string | null;
}

async function getOrCreateStatusRow(): Promise<StatusRow | null> {
  try {
    const [existing] = await db
      .select()
      .from(licenseStatusTable)
      .where(eq(licenseStatusTable.id, 1))
      .limit(1);
    if (existing) return { firstBootAt: existing.firstBootAt, keyOverride: existing.keyOverride };

    const [created] = await db
      .insert(licenseStatusTable)
      .values({ id: 1 })
      .onConflictDoNothing()
      .returning();
    if (created) return { firstBootAt: created.firstBootAt, keyOverride: created.keyOverride };

    // Race: someone else inserted — re-read
    const [retry] = await db
      .select()
      .from(licenseStatusTable)
      .where(eq(licenseStatusTable.id, 1))
      .limit(1);
    return retry ? { firstBootAt: retry.firstBootAt, keyOverride: retry.keyOverride } : null;
  } catch (err) {
    logger.error({ err }, "license: could not read/seed license_status row");
    return null;
  }
}

/** Set or clear the in-app license key. Pass null to remove. */
export async function setStoredLicenseKey(key: string | null): Promise<void> {
  try {
    await db
      .insert(licenseStatusTable)
      .values({ id: 1, keyOverride: key, keyUpdatedAt: new Date() })
      .onConflictDoUpdate({
        target: licenseStatusTable.id,
        set:    { keyOverride: key, keyUpdatedAt: new Date() },
      });
    invalidateLicenseCache();
  } catch (err) {
    logger.error({ err }, "license: could not persist key override");
    throw new Error("Could not save license key — database unreachable");
  }
}

/* ───────── current status ───────── */

let cached: LicenseStatus | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000; // re-check every minute

export async function getLicenseStatus(forceRefresh = false): Promise<LicenseStatus> {
  if (!forceRefresh && cached && Date.now() - cachedAt < CACHE_MS) {
    return cached;
  }

  // Resolve the active key: in-app override (DB) wins over env
  const row = await getOrCreateStatusRow();
  const key = (row?.keyOverride ?? process.env["LICENSE_KEY"] ?? "").trim();

  if (key) {
    const result = verifyLicense(key);
    if (!result.ok) {
      cached = { valid: false, mode: "invalid", reason: result.reason };
      cachedAt = Date.now();
      return cached;
    }
    const { payload } = result;
    if (payload.expiry !== "perpetual") {
      const expiryDate = new Date(payload.expiry);
      if (Number.isNaN(expiryDate.getTime())) {
        cached = { valid: false, mode: "invalid", payload, reason: "Invalid expiry date in license" };
        cachedAt = Date.now();
        return cached;
      }
      const now = Date.now();
      const msLeft = expiryDate.getTime() - now;
      if (msLeft < 0) {
        cached = {
          valid: false,
          mode: "expired",
          payload,
          reason: `License expired ${expiryDate.toISOString().slice(0, 10)}`,
        };
        cachedAt = Date.now();
        return cached;
      }
      cached = {
        valid: true,
        mode: "licensed",
        payload,
        daysRemaining: Math.floor(msLeft / 86_400_000),
      };
      cachedAt = Date.now();
      return cached;
    }
    cached = { valid: true, mode: "licensed", payload };
    cachedAt = Date.now();
    return cached;
  }

  // No key → trial mode
  if (!row) {
    // DB unreachable: fail open so the shop can still bill while we figure it out
    cached = { valid: true, mode: "trial", reason: "Trial DB row unavailable — failing open" };
    cachedAt = Date.now();
    return cached;
  }
  const trialEnd = new Date(row.firstBootAt.getTime() + TRIAL_DAYS * 86_400_000);
  const msLeft = trialEnd.getTime() - Date.now();
  if (msLeft <= 0) {
    cached = {
      valid: false,
      mode: "trial_expired",
      trialEndsAt: trialEnd.toISOString(),
      reason: `Trial ended ${trialEnd.toISOString().slice(0, 10)}. Enter a license key to continue.`,
    };
    cachedAt = Date.now();
    return cached;
  }
  cached = {
    valid: true,
    mode: "trial",
    trialEndsAt: trialEnd.toISOString(),
    daysRemaining: Math.ceil(msLeft / 86_400_000),
  };
  cachedAt = Date.now();
  return cached;
}

export function invalidateLicenseCache(): void {
  cached = null;
  cachedAt = 0;
}

/* ───────── express middleware ───────── */

import type { Request, Response, NextFunction } from "express";

const ALLOWED_PATHS = new Set([
  "/license/status",
  "/license/activate",
  "/license/remove",
  "/license/refresh",
  "/updates/check",
  "/updates/install",
  "/updates/status",
  "/health",
]);

export async function licenseGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Always allow the status & health endpoints so the UI can show why it's down
  if (ALLOWED_PATHS.has(req.path)) { next(); return; }

  const status = await getLicenseStatus();
  if (status.valid) { next(); return; }

  res.status(402).json({
    error:   "License required",
    mode:    status.mode,
    reason:  status.reason,
    message: "This installation is not licensed. Contact the vendor for a license key.",
  });
}
