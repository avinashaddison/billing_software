export const OWNER_IDLE_MS = 10 * 60 * 1000;
export const ownerActivityKey = (staffId: string) =>
  `toy-mall-owner-activity:${staffId}`;
export function ownerIsIdle(lastActivity: number, now = Date.now()): boolean {
  return now - lastActivity >= OWNER_IDLE_MS;
}
