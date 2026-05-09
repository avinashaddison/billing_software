import crypto from "node:crypto";
import { db, licenseStatusTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const TRIAL_DAYS = 14;

/**
 * HMAC secret used to sign license keys. Must match the value in
 * scripts/src/gen-license.ts. Changing it invalidates all issued keys.
 *
 * Yes, baking it into the binary is not bulletproof — a determined buyer
 * can extract it. The point is to deter casual sharing of the install,
 * not to defeat a reverse engineer.
 */
const SECRET =
  process.env["LICENSE_SECRET"] ||
  "counter-billing-license-v1-do-not-leak-this-to-customers";

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

async function getOrCreateFirstBoot(): Promise<Date | null> {
  try {
    const [existing] = await db
      .select()
      .from(licenseStatusTable)
      .where(eq(licenseStatusTable.id, 1))
      .limit(1);
    if (existing) return existing.firstBootAt;

    const [created] = await db
      .insert(licenseStatusTable)
      .values({ id: 1 })
      .onConflictDoNothing()
      .returning();
    if (created) return created.firstBootAt;

    // Race: someone else inserted — re-read
    const [retry] = await db
      .select()
      .from(licenseStatusTable)
      .where(eq(licenseStatusTable.id, 1))
      .limit(1);
    return retry?.firstBootAt ?? null;
  } catch (err) {
    logger.error({ err }, "license: could not read/seed first_boot timestamp");
    return null;
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

  const key = process.env["LICENSE_KEY"]?.trim();

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
  const firstBoot = await getOrCreateFirstBoot();
  if (!firstBoot) {
    // DB unreachable: fail open so the shop can still bill while we figure it out
    cached = { valid: true, mode: "trial", reason: "Trial DB row unavailable — failing open" };
    cachedAt = Date.now();
    return cached;
  }
  const trialEnd = new Date(firstBoot.getTime() + TRIAL_DAYS * 86_400_000);
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
