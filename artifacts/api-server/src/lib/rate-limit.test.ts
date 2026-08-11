import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  recordFailure,
  clearRateLimit,
  resetAllRateLimits,
  rateLimitKeyCount,
  RATE_LIMIT_MAX_KEYS,
  LOGIN_LIMIT,
  type RateLimitOptions,
} from "./rate-limit";

/** Small, fast window so the tests can reason about time explicitly. */
const OPTS: RateLimitOptions = { max: 3, windowMs: 1_000, blockMs: 2_000 };

beforeEach(() => {
  resetAllRateLimits();
});

describe("checkRateLimit / recordFailure", () => {
  it("lets an unknown key through", () => {
    expect(checkRateLimit("fresh", OPTS, 0).limited).toBe(false);
  });

  it("allows attempts up to the limit", () => {
    recordFailure("k", OPTS, 0);
    recordFailure("k", OPTS, 10);
    expect(checkRateLimit("k", OPTS, 20).limited).toBe(false);
  });

  it("blocks once the limit is reached", () => {
    for (let i = 0; i < OPTS.max; i++) recordFailure("k", OPTS, i);
    const res = checkRateLimit("k", OPTS, 10);
    expect(res.limited).toBe(true);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports how long the caller must wait", () => {
    for (let i = 0; i < OPTS.max; i++) recordFailure("k", OPTS, 0);
    // blocked until 0 + blockMs (2000); at t=500 that is 1500ms away
    expect(checkRateLimit("k", OPTS, 500).retryAfterSeconds).toBe(2);
  });

  it("forgets failures once the block and the window have both passed", () => {
    for (let i = 0; i < OPTS.max; i++) recordFailure("k", OPTS, 0);
    expect(checkRateLimit("k", OPTS, 500).limited).toBe(true);
    expect(checkRateLimit("k", OPTS, 5_000).limited).toBe(false);
  });

  it("does not count failures that have aged out of the window", () => {
    recordFailure("k", OPTS, 0);
    recordFailure("k", OPTS, 100);
    // both are older than windowMs by now, so this third one stands alone
    recordFailure("k", OPTS, 5_000);
    expect(checkRateLimit("k", OPTS, 5_010).limited).toBe(false);
  });

  it("keeps keys independent, so one attacker cannot lock out another account", () => {
    for (let i = 0; i < OPTS.max; i++) recordFailure("victim", OPTS, i);
    expect(checkRateLimit("victim", OPTS, 10).limited).toBe(true);
    expect(checkRateLimit("someone-else", OPTS, 10).limited).toBe(false);
  });

  it("clears on a successful login, so a user who finally types it right is not throttled", () => {
    for (let i = 0; i < OPTS.max; i++) recordFailure("k", OPTS, i);
    clearRateLimit("k");
    expect(checkRateLimit("k", OPTS, 10).limited).toBe(false);
  });
});

describe("LOGIN_LIMIT", () => {
  it("tolerates a shop owner fumbling their password a few times", () => {
    for (let i = 0; i < 5; i++) recordFailure("owner", LOGIN_LIMIT, i * 1_000);
    expect(checkRateLimit("owner", LOGIN_LIMIT, 5_000).limited).toBe(false);
  });

  it("shuts down sustained guessing", () => {
    for (let i = 0; i < LOGIN_LIMIT.max; i++) recordFailure("attacker", LOGIN_LIMIT, i * 1_000);
    expect(checkRateLimit("attacker", LOGIN_LIMIT, 10_000).limited).toBe(true);
  });
});

describe("memory bound", () => {
  it("caps tracked keys even when every entry is still fresh", () => {
    /* The failure mode this guards: an attacker rotating IP and email makes a
       brand-new key every request, so nothing is ever expired and a cleanup
       that only removes dead entries removes nothing. */
    const now = 1_000;
    for (let i = 0; i < RATE_LIMIT_MAX_KEYS + 500; i++) {
      recordFailure(`ip-${i}:user-${i}@example.com`, LOGIN_LIMIT, now);
    }
    expect(rateLimitKeyCount()).toBeLessThanOrEqual(RATE_LIMIT_MAX_KEYS);
  });

  it("never evicts an active block, so flooding cannot clear a lockout", () => {
    const now = 1_000;
    for (let i = 0; i < LOGIN_LIMIT.max; i++) recordFailure("locked-out", LOGIN_LIMIT, now + i);
    expect(checkRateLimit("locked-out", LOGIN_LIMIT, now + 100).limited).toBe(true);

    for (let i = 0; i < RATE_LIMIT_MAX_KEYS + 500; i++) {
      recordFailure(`flood-${i}`, LOGIN_LIMIT, now + 200);
    }
    expect(checkRateLimit("locked-out", LOGIN_LIMIT, now + 300).limited).toBe(true);
  });
});
