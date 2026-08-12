/**
 * Enforcement half of the vendor's "view as shop" support session.
 *
 * The cookie minted by POST /platform/tenants/:id/view-as carries a signed
 * `ro` claim. This gate turns that claim into an actual guarantee: while it is
 * present, the session can read and cannot write. It is deliberately a blanket
 * method check rather than a per-route allowlist — a new write route added
 * later is refused automatically instead of quietly becoming reachable.
 *
 * It also enforces the session's age. The cookie is issued with a one-hour
 * maxAge, but a browser is free to ignore that and a copied cookie has no
 * maxAge at all, so the real expiry is checked here against the signed
 * issued-at claim.
 */

import type { Request, Response, NextFunction } from "express";
import { TENANT_COOKIE_NAME } from "./tenant";

/** Must match VIEW_AS_MINUTES in routes/platform-people.ts. */
export const VIEW_AS_MAX_AGE_MS = 60 * 60 * 1000;

/* Scope: this gate governs the TENANT surface — everything a shop's own app
 * can call. The vendor's /platform/* control plane is mounted ahead of it and
 * guarded by requirePlatformAdmin instead, deliberately: the admin console is
 * usually open in another tab of the same browser and must keep working while
 * a support session is running. A support session grants no power the platform
 * admin did not already hold. */

/* Ending the session is a POST and must stay possible from inside it. Signing
 * in normally must too — it needs real credentials and replaces this cookie
 * with an ordinary one, so refusing it would only strand the browser. */
const ALWAYS_ALLOWED = new Set(["/auth/logout", "/auth/login", "/platform/view-as/exit"]);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function readOnlySessionGate(req: Request, res: Response, next: NextFunction): void {
  if (!req.viewAsReadOnly) { next(); return; }

  if (typeof req.sessionIssuedAt === "number" && Date.now() - req.sessionIssuedAt > VIEW_AS_MAX_AGE_MS) {
    res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "The support session has expired. Open the shop again from the admin panel." });
    return;
  }

  if (READ_METHODS.has(req.method.toUpperCase())) { next(); return; }
  if (ALWAYS_ALLOWED.has(req.path)) { next(); return; }

  res.status(403).json({
    error: "You are viewing this shop read-only. Nothing can be changed from a support session.",
  });
}
