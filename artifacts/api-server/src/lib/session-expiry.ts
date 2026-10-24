import { ownerIdleExpired } from "./owner-idle";

export function sessionIdleTimeoutMs(): number {
  const raw = process.env.SESSION_IDLE_DAYS;
  const days = raw === undefined || raw.trim() === "" ? 30 : Number(raw);
  return Number.isFinite(days) && days > 0 ? days * 86_400_000 : 0;
}

/** Listing devices must use the same expiry rules as authenticated requests. */
export function sessionExpired(
  role: string,
  session: { lastSeenAt: Date; lastActivityAt: Date },
  now = Date.now(),
): boolean {
  const idleMs = sessionIdleTimeoutMs();
  return ownerIdleExpired(role, session.lastActivityAt, now)
    || (idleMs > 0 && now - session.lastSeenAt.getTime() > idleMs);
}
