import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionExpired, sessionIdleTimeoutMs } from "./session-expiry";

afterEach(() => vi.unstubAllEnvs());
const now = Date.UTC(2026, 9, 24, 12);

describe("device-list expiry matches authentication", () => {
  it("hides an owner at the ten-minute boundary, not active owners or staff", () => {
    const session = { lastSeenAt: new Date(now), lastActivityAt: new Date(now - 600_000) };
    expect(sessionExpired("owner", session, now)).toBe(true);
    expect(sessionExpired("staff", session, now)).toBe(false);
    expect(sessionExpired("owner", { ...session, lastActivityAt: new Date(now - 599_999) }, now)).toBe(false);
  });

  it("hides genuinely expired devices without revoking or deleting anything", () => {
    vi.stubEnv("SESSION_IDLE_DAYS", "");
    expect(sessionIdleTimeoutMs()).toBe(30 * 86_400_000);
    const session = { lastSeenAt: new Date(now - 30 * 86_400_000 - 1), lastActivityAt: new Date(now) };
    expect(sessionExpired("staff", session, now)).toBe(true);
    expect(sessionExpired("staff", { ...session, lastSeenAt: new Date(now - 30 * 86_400_000) }, now)).toBe(false);
  });

  it("respects configured idle days without disabling owner protection", () => {
    vi.stubEnv("SESSION_IDLE_DAYS", "0");
    expect(sessionIdleTimeoutMs()).toBe(0);
    const session = { lastSeenAt: new Date(0), lastActivityAt: new Date(now - 600_000) };
    expect(sessionExpired("staff", session, now)).toBe(false);
    expect(sessionExpired("owner", session, now)).toBe(true);
    vi.stubEnv("SESSION_IDLE_DAYS", "2");
    expect(sessionIdleTimeoutMs()).toBe(2 * 86_400_000);
  });
});
