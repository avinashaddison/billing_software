export const OWNER_IDLE_MS = 10 * 60 * 1000;

export function ownerIdleExpired(
  role: string,
  lastActivity: Date,
  now = Date.now(),
): boolean {
  return role === "owner" && now - lastActivity.getTime() >= OWNER_IDLE_MS;
}
