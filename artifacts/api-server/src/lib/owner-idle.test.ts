import { describe, it, expect } from "vitest";
import { ownerIdleExpired, OWNER_IDLE_MS } from "./owner-idle";

describe("owner inactivity deadline", () => {
  const start = 1_000_000;
  it("expires at exactly 10 minutes", () => {
    expect(OWNER_IDLE_MS).toBe(600_000);
    expect(ownerIdleExpired("owner", new Date(start), start + 599_999)).toBe(
      false,
    );
    expect(ownerIdleExpired("owner", new Date(start), start + 600_000)).toBe(
      true,
    );
  });
  it("does not change staff or platform admin idle policy", () => {
    expect(
      ownerIdleExpired("staff", new Date(start), start + 5 * OWNER_IDLE_MS),
    ).toBe(false);
    expect(
      ownerIdleExpired("admin", new Date(start), start + 5 * OWNER_IDLE_MS),
    ).toBe(false);
  });
  it("a later genuine interaction starts a new deadline", () => {
    expect(
      ownerIdleExpired("owner", new Date(start + 590_000), start + 600_000),
    ).toBe(false);
  });
});
