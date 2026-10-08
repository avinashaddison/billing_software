/** A cached, single-flight probe prevents public monitors from exhausting the pool. */
export function createReadinessCheck(probe: () => Promise<boolean>, ttlMs = 5_000) {
  let initialized = false;
  let draining = false;
  let cached = false;
  let expiresAt = 0;
  let pending: Promise<boolean> | undefined;
  return {
    initialized() { initialized = true; expiresAt = 0; },
    drain() { draining = true; },
    acceptingRequests() { return initialized && !draining; },
    async check(): Promise<boolean> {
      if (!initialized || draining) return false;
      if (Date.now() < expiresAt) return cached;
      pending ??= probe().catch(() => false).then((ok) => {
        cached = ok;
        expiresAt = Date.now() + ttlMs;
        return ok;
      }).finally(() => { pending = undefined; });
      const ok = await pending;
      return ok && !draining;
    },
  };
}
