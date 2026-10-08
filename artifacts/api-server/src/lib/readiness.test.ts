import { describe, expect, it, vi } from "vitest";
import { createReadinessCheck } from "./readiness";

describe("readiness (no real database)", () => {
  it("refuses requests until initialization completes", async () => {
    const probe = vi.fn(async () => true);
    const ready = createReadinessCheck(probe);
    expect(await ready.check()).toBe(false);
    expect(probe).not.toHaveBeenCalled();
    ready.initialized();
    expect(await ready.check()).toBe(true);
  });
  it("fails closed on missing schema or connection errors and caches failures", async () => {
    const probe = vi.fn(async () => { throw new Error("private connection detail"); });
    const ready = createReadinessCheck(probe);
    ready.initialized();
    expect(await ready.check()).toBe(false);
    expect(await ready.check()).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
  });
  it("coalesces concurrent probes and caches a success", async () => {
    const probe = vi.fn(async () => true);
    const ready = createReadinessCheck(probe);
    ready.initialized();
    expect(await Promise.all([ready.check(), ready.check()])).toEqual([true, true]);
    expect(await ready.check()).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });
  it("retries after the cache expires", async () => {
    const probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const ready = createReadinessCheck(probe, 0);
    ready.initialized();
    expect(await ready.check()).toBe(false);
    expect(await ready.check()).toBe(true);
  });
  it("is never ready while draining, even if a probe is in flight", async () => {
    let finish!: (ok: boolean) => void;
    const ready = createReadinessCheck(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    ready.initialized();
    const check = ready.check();
    ready.drain();
    finish(true);
    expect(await check).toBe(false);
    expect(await ready.check()).toBe(false);
  });
});
