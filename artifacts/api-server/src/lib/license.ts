import crypto from "node:crypto";
import fs     from "node:fs";
import path   from "node:path";
import { fileURLToPath } from "node:url";
import { db, licenseStatusTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
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

/* ───────── trial tracking (tenant-aware) ───────── */

interface StatusRow {
  firstBootAt: Date;
  keyOverride: string | null;
}

/** Resolve the license_status row for a given tenant (null = legacy/Hira & Sons). */
async function getOrCreateStatusRow(tenantId: string | null): Promise<StatusRow | null> {
  try {
    /* Look up existing row by tenant_id (or NULL for legacy install). */
    const existingQuery = tenantId == null
      ? db.select().from(licenseStatusTable).where(isNull(licenseStatusTable.tenantId)).limit(1)
      : db.select().from(licenseStatusTable).where(eq(licenseStatusTable.tenantId, tenantId)).limit(1);
    const [existing] = await existingQuery;
    if (existing) {
      return { firstBootAt: existing.firstBootAt, keyOverride: existing.keyOverride };
    }

    /* Insert a fresh row. Legacy NULL takes id=1 to match historic data;
       per-tenant rows get the next available id so they don't collide
       with the singleton. */
    if (tenantId == null) {
      const [created] = await db
        .insert(licenseStatusTable)
        .values({ id: 1 })
        .onConflictDoNothing()
        .returning();
      if (created) return { firstBootAt: created.firstBootAt, keyOverride: created.keyOverride };
      const [retry] = await db
        .select()
        .from(licenseStatusTable)
        .where(isNull(licenseStatusTable.tenantId))
        .limit(1);
      return retry ? { firstBootAt: retry.firstBootAt, keyOverride: retry.keyOverride } : null;
    }

    const allRows = await db.select({ id: licenseStatusTable.id }).from(licenseStatusTable);
    const maxId = allRows.reduce((m, r) => Math.max(m, r.id), 0);
    const newId = Math.max(maxId + 1, 2);

    const [created] = await db
      .insert(licenseStatusTable)
      .values({ id: newId, tenantId })
      .onConflictDoNothing()
      .returning();
    if (created) return { firstBootAt: created.firstBootAt, keyOverride: created.keyOverride };

    const [retry] = await db
      .select()
      .from(licenseStatusTable)
      .where(eq(licenseStatusTable.tenantId, tenantId))
      .limit(1);
    return retry ? { firstBootAt: retry.firstBootAt, keyOverride: retry.keyOverride } : null;
  } catch (err) {
    logger.error({ err, tenantId }, "license: could not read/seed license_status row");
    return null;
  }
}

/** Set or clear the in-app license key for a given tenant. Pass null key to remove. */
export async function setStoredLicenseKey(key: string | null, tenantId: string | null): Promise<void> {
  try {
    /* Ensure a row exists first (idempotent) so the UPDATE below has a
       target — this also assigns a fresh id for new tenants. */
    await getOrCreateStatusRow(tenantId);

    if (tenantId == null) {
      await db
        .update(licenseStatusTable)
        .set({ keyOverride: key, keyUpdatedAt: new Date() })
        .where(isNull(licenseStatusTable.tenantId));
    } else {
      await db
        .update(licenseStatusTable)
        .set({ keyOverride: key, keyUpdatedAt: new Date() })
        .where(eq(licenseStatusTable.tenantId, tenantId));
    }
    invalidateLicenseCache(tenantId);
  } catch (err) {
    logger.error({ err, tenantId }, "license: could not persist key override");
    throw new Error("Could not save license key — database unreachable");
  }
}

/* ───────── current status (per-tenant cache) ───────── */

interface CacheEntry { status: LicenseStatus; at: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 60_000; // re-check every minute

function cacheKey(tenantId: string | null): string {
  return tenantId ?? "__legacy_null__";
}

export async function getLicenseStatus(tenantId: string | null = null, forceRefresh = false): Promise<LicenseStatus> {
  const key = cacheKey(tenantId);
  if (!forceRefresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.status;
  }

  // Resolve the active key: in-app override (DB) wins over env
  const row = await getOrCreateStatusRow(tenantId);
  const activeKey = (row?.keyOverride ?? process.env["LICENSE_KEY"] ?? "").trim();

  const set = (status: LicenseStatus): LicenseStatus => {
    cache.set(key, { status, at: Date.now() });
    return status;
  };

  if (activeKey) {
    const result = verifyLicense(activeKey);
    if (!result.ok) {
      return set({ valid: false, mode: "invalid", reason: result.reason });
    }
    const { payload } = result;
    if (payload.expiry !== "perpetual") {
      const expiryDate = new Date(payload.expiry);
      if (Number.isNaN(expiryDate.getTime())) {
        return set({ valid: false, mode: "invalid", payload, reason: "Invalid expiry date in license" });
      }
      const now = Date.now();
      const msLeft = expiryDate.getTime() - now;
      if (msLeft < 0) {
        return set({
          valid: false,
          mode: "expired",
          payload,
          reason: `License expired ${expiryDate.toISOString().slice(0, 10)}`,
        });
      }
      return set({
        valid: true,
        mode: "licensed",
        payload,
        daysRemaining: Math.floor(msLeft / 86_400_000),
      });
    }
    return set({ valid: true, mode: "licensed", payload });
  }

  // No key → trial mode
  if (!row) {
    // DB unreachable: fail open so the shop can still bill while we figure it out
    return set({ valid: true, mode: "trial", reason: "Trial DB row unavailable — failing open" });
  }
  const trialEnd = new Date(row.firstBootAt.getTime() + TRIAL_DAYS * 86_400_000);
  const msLeft = trialEnd.getTime() - Date.now();
  if (msLeft <= 0) {
    return set({
      valid: false,
      mode: "trial_expired",
      trialEndsAt: trialEnd.toISOString(),
      reason: `Trial ended ${trialEnd.toISOString().slice(0, 10)}. Enter a license key to continue.`,
    });
  }
  return set({
    valid: true,
    mode: "trial",
    trialEndsAt: trialEnd.toISOString(),
    daysRemaining: Math.ceil(msLeft / 86_400_000),
  });
}

/** Clear the cached status for one tenant (or all if no tenantId given). */
export function invalidateLicenseCache(tenantId?: string | null): void {
  if (tenantId === undefined) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(tenantId));
}

/* ───────── express middleware ───────── */

import type { Request, Response, NextFunction } from "express";

const ALLOWED_PATHS = new Set([
  "/license/status",
  "/license/activate",
  "/license/remove",
  "/license/refresh",
  "/auth/login",
  "/auth/login-email",
  "/auth/logout",
  "/auth/me",
  "/updates/check",
  "/updates/install",
  "/updates/status",
  "/health",
  "/healthz",
]);

export async function licenseGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Always allow the status, auth & health endpoints so the UI can show why it's down
  if (ALLOWED_PATHS.has(req.path)) { next(); return; }

  const status = await getLicenseStatus(req.tenantId ?? null);
  if (status.valid) { next(); return; }

  res.status(402).json({
    error:   "License required",
    mode:    status.mode,
    reason:  status.reason,
    message: "This installation is not licensed. Contact the vendor for a license key.",
  });
}
