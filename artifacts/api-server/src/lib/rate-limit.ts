/**
 * In-memory sliding-window rate limiter for authentication endpoints.
 *
 * ── Why in-memory ──────────────────────────────────────────────────────────
 * PIN login already has a DB-backed lockout (counter columns on staff_profiles).
 * Email login has nothing, and giving it the same treatment would need a schema
 * migration against a live production database. This keeps the fix code-only:
 * no migration, no writes, nothing to roll back.
 *
 * The tradeoff is honest: counters live in the process, so they reset on deploy
 * and are per-instance rather than global. That is still enough to turn
 * "unlimited online password guessing" into "a handful of tries per minute",
 * which is the actual attack being closed. If the API is ever scaled to several
 * instances, move this to the database or a shared cache.
 */

interface Attempt {
  /** Timestamps (ms) of recent failures inside the window. */
  hits: number[];
  /** Set once the limit trips; requests are refused until this passes. */
  blockedUntil: number;
}

export interface RateLimitOptions {
  /** How many failures are tolerated inside the window. */
  max: number;
  /** Sliding window length, in milliseconds. */
  windowMs: number;
  /** How long to refuse the key once the limit trips. */
  blockMs: number;
}

export interface RateLimitResult {
  /** True when the caller should be refused. */
  limited: boolean;
  /** Seconds until the caller may try again (0 when not limited). */
  retryAfterSeconds: number;
}

/**
 * Failures only. A successful login clears the key, so ordinary users who
 * mistype once and then get it right are never affected.
 */
const buckets = new Map<string, Attempt>();

/** Hard ceiling on tracked keys. Enforced, not merely hoped for. */
const MAX_KEYS = 10_000;

/** Most recent failure on a key, used to decide who gets evicted first. */
function lastHit(entry: Attempt): number {
  return entry.hits.length > 0 ? entry.hits[entry.hits.length - 1]! : 0;
}

/**
 * Keep the map bounded.
 *
 * Expiring entries is not enough on its own: an attacker rotating IP and email
 * creates a fresh key every request, and while those keys are inside the window
 * none of them are expired, so a cleanup that only removes dead entries removes
 * nothing and the map grows for as long as the flood lasts. So after expiry
 * this enforces the ceiling directly.
 *
 * Eviction order is deliberate — currently-blocked keys are kept and the
 * least-recently-active unblocked keys go first. An attacker can therefore push
 * out other people's *counters*, but never their own *block*, so flooding
 * cannot be used to clear a lockout. If every key is blocked, the oldest blocks
 * are dropped last-resort; those attackers have already been stalled for the
 * block duration.
 */
function sweep(now: number, windowMs: number): void {
  if (buckets.size < MAX_KEYS) return;

  for (const [key, entry] of buckets) {
    const fresh = entry.hits.filter((t) => now - t < windowMs);
    if (fresh.length === 0 && entry.blockedUntil < now) {
      buckets.delete(key);
    } else {
      entry.hits = fresh; // also stops a single key's history growing
    }
  }
  if (buckets.size < MAX_KEYS) return;

  /* Still at the ceiling: evict down to 90% so this doesn't run every call. */
  const target = Math.floor(MAX_KEYS * 0.9);
  const ordered = [...buckets.entries()].sort((a, b) => {
    const aBlocked = a[1].blockedUntil > now ? 1 : 0;
    const bBlocked = b[1].blockedUntil > now ? 1 : 0;
    if (aBlocked !== bBlocked) return aBlocked - bBlocked; // unblocked first
    return lastHit(a[1]) - lastHit(b[1]);                  // oldest first
  });
  for (const [key] of ordered) {
    if (buckets.size <= target) break;
    buckets.delete(key);
  }
}

/** Check a key WITHOUT recording a failure. Call before doing the expensive work. */
export function checkRateLimit(key: string, opts: RateLimitOptions, now: number = Date.now()): RateLimitResult {
  const entry = buckets.get(key);
  if (!entry) return { limited: false, retryAfterSeconds: 0 };

  if (entry.blockedUntil > now) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  entry.hits = entry.hits.filter((t) => now - t < opts.windowMs);
  if (entry.hits.length >= opts.max) {
    entry.blockedUntil = now + opts.blockMs;
    return { limited: true, retryAfterSeconds: Math.ceil(opts.blockMs / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

/** Record one failed attempt against a key. */
export function recordFailure(key: string, opts: RateLimitOptions, now: number = Date.now()): void {
  sweep(now, opts.windowMs);
  const entry = buckets.get(key) ?? { hits: [], blockedUntil: 0 };
  entry.hits = entry.hits.filter((t) => now - t < opts.windowMs);
  entry.hits.push(now);
  if (entry.hits.length >= opts.max) entry.blockedUntil = now + opts.blockMs;
  buckets.set(key, entry);
}

/** Clear a key after a successful login. */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test hook — drops all counters. */
export function resetAllRateLimits(): void {
  buckets.clear();
}

/** Test hook — how many keys are currently tracked. */
export function rateLimitKeyCount(): number {
  return buckets.size;
}

/** Test hook — the enforced ceiling on tracked keys. */
export const RATE_LIMIT_MAX_KEYS = MAX_KEYS;

/**
 * Limits for email/password login.
 *
 * Generous enough that a shop owner fumbling their password at the counter is
 * never locked out, tight enough that guessing an 8-character password online
 * is hopeless.
 */
export const LOGIN_LIMIT: RateLimitOptions = {
  max: 8,
  windowMs: 10 * 60 * 1000, // 10 minutes
  blockMs: 15 * 60 * 1000,  // 15 minutes
};
