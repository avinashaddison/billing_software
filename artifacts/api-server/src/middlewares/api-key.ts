/**
 * Bearer-key authentication + per-key rate limiting for the public /api/v1
 * surface.
 *
 * Requests carry `Authorization: Bearer adb_<48 hex>`. The key is looked up
 * by sha256 hash (raw keys are never stored). A valid key stamps the request
 * with the key's tenant and scope; any session identity from cookies is
 * explicitly cleared so a logged-in browser can never leak staff privileges
 * into the key-scoped surface, and vice versa.
 *
 * Suspended or expired shops lose API access immediately — this mirrors the
 * session router's tenantActiveGate, which /api/v1 does not pass through.
 */
import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, apiKeysTable, tenantsTable } from "@workspace/db";
import { hashApiKey } from "../lib/api-keys";

export interface ApiKeyContext {
  id:         string;
  tenantId:   string | null;
  tenantName: string | null;
  name:       string;
  scope:      "read" | "write";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: ApiKeyContext;
    }
  }
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token || !token.startsWith("adb_")) {
    res.status(401).json({
      error: "Missing API key. Send it as: Authorization: Bearer <your key>",
    });
    return;
  }

  const hash = hashApiKey(token);
  const [row] = await db
    .select({
      id:            apiKeysTable.id,
      tenantId:      apiKeysTable.tenantId,
      name:          apiKeysTable.name,
      scope:         apiKeysTable.scope,
      lastUsedAt:    apiKeysTable.lastUsedAt,
      tenantName:    tenantsTable.name,
      tenantActive:  tenantsTable.isActive,
      tenantExpires: tenantsTable.expiresAt,
    })
    .from(apiKeysTable)
    .leftJoin(tenantsTable, eq(apiKeysTable.tenantId, tenantsTable.id))
    .where(and(eq(apiKeysTable.keyHash, hash), isNull(apiKeysTable.revokedAt)));

  if (!row) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }

  /* A key whose tenant row exists must belong to an active, unexpired shop.
     (tenantId NULL = legacy owner key — no tenant row to check.) */
  if (row.tenantId != null) {
    const expired = row.tenantExpires != null && row.tenantExpires.getTime() <= Date.now();
    if (row.tenantActive !== true || expired) {
      res.status(403).json({ error: "This shop's account is not active" });
      return;
    }
  }

  req.apiKey = {
    id:         row.id,
    tenantId:   row.tenantId,
    tenantName: row.tenantName ?? null,
    name:       row.name,
    scope:      row.scope === "write" ? "write" : "read",
  };
  /* The request now acts as the KEY — never as any cookie session that
     happened to ride along. */
  req.tenantId = row.tenantId;
  req.staffId  = undefined;
  req.userId   = undefined;

  /* Throttled usage stamp (at most one write per key per minute). */
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    void db
      .update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, row.id))
      .catch(() => { /* usage stamp is best-effort */ });
  }

  next();
}

/** Gate for mutating endpoints — the key must have the 'write' scope. */
export function requireWriteScope(req: Request, res: Response, next: NextFunction): void {
  if (req.apiKey?.scope !== "write") {
    res.status(403).json({
      error: "This API key is read-only. Use a key with read & write permission for this endpoint.",
    });
    return;
  }
  next();
}

/**
 * Fixed-window per-key rate limit: 120 requests/minute.
 *
 * In-memory is correct here: the app deploys as a single always-on VM, so
 * every request shares this process. (The app-level IP limiter still fronts
 * this for unauthenticated floods.) Mounted AFTER apiKeyAuth because the
 * window is keyed by api-key id.
 */
const WINDOW_MS = 60_000;
const LIMIT     = 120;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function apiKeyRateLimit(req: Request, res: Response, next: NextFunction): void {
  const keyId = req.apiKey?.id;
  if (!keyId) { next(); return; } // apiKeyAuth already rejected; defensive

  const now = Date.now();
  /* Opportunistic sweep so revoked/idle keys don't accumulate forever. */
  if (buckets.size > 5_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  let bucket = buckets.get(keyId);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(keyId, bucket);
  }
  bucket.count += 1;

  const remaining = Math.max(0, LIMIT - bucket.count);
  res.setHeader("X-RateLimit-Limit", String(LIMIT));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > LIMIT) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error: `Rate limit exceeded (${LIMIT} requests/minute). Try again in ${retryAfterSec}s.`,
    });
    return;
  }

  next();
}
