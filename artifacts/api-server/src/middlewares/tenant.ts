/**
 * Tenant session middleware.
 *
 * Reads the HttpOnly `tenant_session` cookie (signed with SESSION_SECRET),
 * verifies its HMAC, and attaches `req.tenantId` (string | null) and
 * `req.staffId?` to every request. Legacy/anonymous requests get
 * `tenantId = null` which the route helpers translate into the legacy
 * "tenant_id IS NULL" filter — preserving Hira & Sons compatibility.
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export const TENANT_COOKIE_NAME = "tenant_session";

/* ── augment Express types so req.tenantId is recognised everywhere ── */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId: string | null;
      staffId?: string;
    }
  }
}

function loadSecret(): string {
  const fromEnv = process.env["SESSION_SECRET"]?.trim();
  if (fromEnv) return fromEnv;
  // Fall back to LICENSE_SECRET so existing single-tenant installs keep
  // booting without an extra env var. Both are HMAC inputs only; rotating
  // them invalidates outstanding tenant cookies (acceptable — users just
  // re-login with their existing staffId+PIN).
  const fromLicense = process.env["LICENSE_SECRET"]?.trim();
  if (fromLicense) return `tenant:${fromLicense}`;
  return "tenant-session-default-secret-do-not-leak";
}

const SECRET = loadSecret();

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

interface CookiePayload {
  /** Tenant UUID, or null for legacy/Hira & Sons sessions. */
  t: string | null;
  /** Staff UUID who authenticated. */
  s: string | null;
  /** Issued-at (ms). */
  iat: number;
}

/** Produce a signed cookie value: `<base64url(payload)>.<hmac>`. */
export function signTenantCookie(tenantId: string | null, staffId: string | null): string {
  const payload: CookiePayload = { t: tenantId, s: staffId, iat: Date.now() };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

/** Verify a cookie and return the decoded payload, or null if invalid. */
export function verifyTenantCookie(
  raw: string | undefined,
): { tenantId: string | null; staffId: string | null } | null {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = sign(b64);
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const json = Buffer.from(b64, "base64url").toString("utf8");
    const obj = JSON.parse(json) as Partial<CookiePayload>;
    return {
      tenantId: typeof obj.t === "string" ? obj.t : null,
      staffId:  typeof obj.s === "string" ? obj.s : null,
    };
  } catch {
    return null;
  }
}

/** Express middleware — sets req.tenantId & req.staffId on every request. */
export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const decoded = verifyTenantCookie(cookies[TENANT_COOKIE_NAME]);
  req.tenantId = decoded?.tenantId ?? null;
  if (decoded?.staffId) req.staffId = decoded.staffId;
  next();
}

/** Standard Set-Cookie options for the tenant_session cookie. */
export function tenantCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
  };
}
