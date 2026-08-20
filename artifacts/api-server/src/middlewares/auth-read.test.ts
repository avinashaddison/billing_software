import { describe, expect, it } from "vitest";
import { resolveResourceReadView } from "./auth";

describe("resolveResourceReadView", () => {
  it("gives owner-level data only to owners and tenant admins", () => {
    expect(resolveResourceReadView("pin", "owner")).toBe("owner");
    expect(resolveResourceReadView("email", "owner")).toBe("owner");
    expect(resolveResourceReadView("email", "admin")).toBe("owner");
  });

  it("gives permitted PIN staff the manager-safe view even for write permission", () => {
    expect(resolveResourceReadView("pin", "staff", "read")).toBe("manager");
    expect(resolveResourceReadView("pin", "staff", "write")).toBe("manager");
  });

  it("denies staff with no permission and email roles without a permission map", () => {
    expect(resolveResourceReadView("pin", "staff", "none")).toBeNull();
    expect(resolveResourceReadView("pin", "staff", null)).toBeNull();
    expect(resolveResourceReadView("email", "manager", "write")).toBeNull();
    expect(resolveResourceReadView("email", "cashier", "read")).toBeNull();
  });
});