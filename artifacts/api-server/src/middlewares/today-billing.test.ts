import { describe, it, expect } from "vitest";
import {
  billingAccessFor,
  hasTodayBillingGrant,
  isDailyMoneyRead,
} from "./today-billing";

describe("owner-controlled today's billing", () => {
  it("never inherits today's permission from checkout, history, or reports", () => {
    expect(
      billingAccessFor("staff", {
        billing: "write",
        scan: "write",
        reports: "write",
      }),
    ).toEqual({ today: false, history: true, checkout: true });
  });
  it("a missing or stray read grant is denied", () => {
    expect(hasTodayBillingGrant("staff")).toBe(false);
    expect(hasTodayBillingGrant("staff", "read")).toBe(false);
    expect(hasTodayBillingGrant("staff", "none")).toBe(false);
  });
  it("the toggle grants today only, not checkout or history", () => {
    expect(billingAccessFor("staff", { todayBilling: "write" })).toEqual({
      today: true,
      history: false,
      checkout: false,
    });
  });
  it("owners always retain access", () => {
    expect(billingAccessFor("owner", {})).toEqual({
      today: true,
      history: true,
      checkout: true,
    });
  });
  it("protects alternate current-day money reporting paths", () => {
    for (const path of [
      "/reports/revenue",
      "/reports/eod",
      "/customers",
      "/customers/9999999999",
      "/sales",
      "/receivables",
      "/dashboard/receivables",
    ]) {
      expect(isDailyMoneyRead("GET", path), path).toBe(true);
      expect(isDailyMoneyRead("HEAD", path), path).toBe(true);
    }
  });
  it("does not change checkout writes, carts, catalog or owner account management", () => {
    for (const path of [
      "/bills/checkout",
      "/shared-cart",
      "/products",
      "/staff",
      "/platform/shops",
      "/auth/activity",
    ]) {
      expect(isDailyMoneyRead("POST", path), path).toBe(false);
      expect(isDailyMoneyRead("GET", path), path).toBe(false);
    }
  });
});
