/**
 * Tenant session middleware.
 *
 * Reads the HttpOnly `tenant_session` cookie (signed with SESSION_SECRET),
 * verifies its HMAC, and attaches the resolved session state to every
 * request:
 *
 *   req.tenantId : string | null      — the caller's tenant slug
 *   req.staffId  : string | undefined — staff_profiles.id (PIN login)
 *   req.userId   : string | undefined — auth_users.id (email login)
 *   req.authKind : "pin" | "email" | undefined — discriminator
 *
 * Legacy/anonymous requests get `tenantId = null` which the route
 * helpers translate into the legacy "tenant_id IS NULL" filter —
 * preserving Hira & Sons compatibility.
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export const TENANT_COOKIE_NAME = "tenant_session";

/* ── augment Express types so req.tenantId/staffId/userId are recognised ── */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId: string | null;
      staffId?: string;
      userId?: string;
      authKind?: "pin" | "email";
    }
  }
}

function loadSecret(): string {
  const fromEnv = process.env["SESSION_SECRET"]?.trim();
  if (fromEnv) return fromEnv;
  // Fall back to LICENSE_SECRET so existing single-tenant installs keep
  // booting without an extra env var. Both are HMAC inputs only; rotating
  // them invalidates outstanding tenant cookies (acceptable — users just
  // re-login with their existing staffId+PIN or email).
  const fromLicense = process.env["LICENSE_SECRET"]?.trim();
  if (fromLicense) return `tenant:${fromLicense}`;
  return "tenant-session-default-secret-do-not-leak";
}

const SECRET = loadSecret();

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

export type AuthKind = "pin" | "email";

interface CookiePayload {
  /** Tenant slug, or null for legacy/Hira & Sons sessions. */
  t: string | null;
  /** staff_profiles.id (PIN login) — present when k === "pin". */
  s: string | null;
  /** auth_users.id (email login) — present when k === "email". */
  u: string | null;
  /** Session kind discriminator. */
  k: AuthKind | null;
  /** Issued-at (ms). */
  iat: number;
}

export interface DecodedSession {
  tenantId: string | null;
  staffId:  string | null;
  userId:   string | null;
  kind:     AuthKind | null;
}

/**
 * Produce a signed cookie value: `<base64url(payload)>.<hmac>`.
 *
 * - kind === "pin"   → staffId is the staff_profiles row id, userId is null.
 * - kind === "email" → userId  is the auth_users row id,    staffId is null.
 * - kind === null    → anonymous / legacy session.
 */
export function signTenantCookie(args: {
  tenantId: string | null;
  staffId?:  string | null;
  userId?:   string | null;
  kind:      AuthKind | null;
}): string {
  const payload: CookiePayload = {
    t: args.tenantId,
    s: args.staffId ?? null,
    u: args.userId ?? null,
    k: args.kind,
    iat: Date.now(),
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

/** Verify a cookie and return the decoded session, or null if invalid. */
export function verifyTenantCookie(raw: string | undefined): DecodedSession | null {
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

    /* Backwards-compat with the v1 cookie format that only carried `t`+`s`. */
    const kind: AuthKind | null = obj.k === "pin" || obj.k === "email"
      ? obj.k
      : (typeof obj.s === "string" ? "pin" : null);

    return {
      tenantId: typeof obj.t === "string" ? obj.t : null,
      staffId:  typeof obj.s === "string" ? obj.s : null,
      userId:   typeof obj.u === "string" ? obj.u : null,
      kind,
    };
  } catch {
    return null;
  }
}

/** Express middleware — sets the session fields on every request. */
export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const decoded = verifyTenantCookie(cookies[TENANT_COOKIE_NAME]);
  req.tenantId = decoded?.tenantId ?? null;
  if (decoded?.staffId) req.staffId = decoded.staffId;
  if (decoded?.userId)  req.userId  = decoded.userId;
  if (decoded?.kind)    req.authKind = decoded.kind;
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
