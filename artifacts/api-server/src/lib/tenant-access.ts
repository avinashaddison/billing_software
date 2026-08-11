/**
 * Tenant access-window helpers.
 *
 * Shared by the single-tenant extend endpoint and the bulk action endpoint so
 * "1 year" can never come to mean two different things depending on which
 * button the vendor pressed.
 */

/** Allowed shorthand durations for the /admin "Access" picker. The presets
 *  keep the admin UX one-tap; anything else uses an explicit ISO date. */
export const PRESET_DURATIONS: Record<string, number> = {
  "3d":     3   * 86_400_000,
  "7d":     7   * 86_400_000,
  "30d":    30  * 86_400_000,
  "90d":    90  * 86_400_000,
  "180d":   180 * 86_400_000,
  "365d":   365 * 86_400_000,
};

/**
 * Resolve an expiry payload into a Date | null. Accepts:
 *   - "lifetime" / null / undefined  → null (no expiry)
 *   - one of the PRESET_DURATIONS keys → now() + that duration
 *   - any ISO 8601 date / datetime string → parsed Date
 * Throws on anything else.
 */
export function resolveExpiry(raw: unknown): Date | null {
  if (raw == null || raw === "" || raw === "lifetime") return null;
  if (typeof raw === "string") {
    if (raw in PRESET_DURATIONS) return new Date(Date.now() + PRESET_DURATIONS[raw]);
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new Error("Invalid expiresAt — use 'lifetime', a preset (3d/7d/30d/90d/180d/365d), or an ISO date");
}

/**
 * Work out a shop's new expiry when a preset duration is applied.
 *
 * The duration is always ADDED to whichever is later — right now, or the
 * shop's own current expiry — so renewing early never burns the days the
 * shop has already paid for. Anchoring to now() unconditionally would cut a
 * paid-up shop's access short, which is why single and bulk extend both go
 * through here rather than each doing their own arithmetic.
 */
export function anchorExtension(
  currentExpiry: Date | null | undefined,
  durationMs: number,
  nowMs: number = Date.now(),
): Date {
  const anchor =
    currentExpiry && currentExpiry.getTime() > nowMs ? currentExpiry.getTime() : nowMs;
  return new Date(anchor + durationMs);
}
