import { describe, expect, it } from "vitest";
import { anchorExtension, PRESET_DURATIONS, resolveExpiry } from "./tenant-access";

const DAY = 86_400_000;
const NOW = Date.parse("2026-08-11T12:00:00.000Z");

describe("anchorExtension", () => {
  it("adds the duration on top of an expiry that is still in the future", () => {
    // A shop paid up to 60 days out, renewed for another 30, must land at 90 —
    // never at 30, which would shorten access it has already paid for.
    const current = new Date(NOW + 60 * DAY);
    const result = anchorExtension(current, PRESET_DURATIONS["30d"], NOW);
    expect(result.getTime()).toBe(NOW + 90 * DAY);
    expect(result.getTime()).toBeGreaterThan(current.getTime());
  });

  it("never moves an expiry backwards, for any preset", () => {
    const current = new Date(NOW + 400 * DAY);
    for (const [name, ms] of Object.entries(PRESET_DURATIONS)) {
      const result = anchorExtension(current, ms, NOW);
      expect(result.getTime(), `preset ${name} shortened access`).toBeGreaterThan(current.getTime());
    }
  });

  it("anchors to now when the shop has already expired", () => {
    const current = new Date(NOW - 10 * DAY);
    expect(anchorExtension(current, PRESET_DURATIONS["30d"], NOW).getTime()).toBe(NOW + 30 * DAY);
  });

  it("anchors to now when the shop has no expiry recorded", () => {
    expect(anchorExtension(null, PRESET_DURATIONS["7d"], NOW).getTime()).toBe(NOW + 7 * DAY);
    expect(anchorExtension(undefined, PRESET_DURATIONS["7d"], NOW).getTime()).toBe(NOW + 7 * DAY);
  });

  it("treats an expiry exactly at now as expired rather than extending from it", () => {
    expect(anchorExtension(new Date(NOW), PRESET_DURATIONS["3d"], NOW).getTime()).toBe(NOW + 3 * DAY);
  });
});

describe("resolveExpiry", () => {
  it("reads lifetime and empty values as no expiry", () => {
    expect(resolveExpiry("lifetime")).toBeNull();
    expect(resolveExpiry(null)).toBeNull();
    expect(resolveExpiry(undefined)).toBeNull();
    expect(resolveExpiry("")).toBeNull();
  });

  it("turns a preset into a date roughly that far out", () => {
    const before = Date.now();
    const result = resolveExpiry("30d")!;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY);
    expect(result.getTime()).toBeLessThan(before + 30 * DAY + 5_000);
  });

  it("accepts an explicit ISO date", () => {
    expect(resolveExpiry("2027-01-31T00:00:00.000Z")!.toISOString()).toBe("2027-01-31T00:00:00.000Z");
  });

  it("rejects junk rather than silently picking a date", () => {
    expect(() => resolveExpiry("soon")).toThrow();
    expect(() => resolveExpiry(42)).toThrow();
    expect(() => resolveExpiry({})).toThrow();
  });
});
