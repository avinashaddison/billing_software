import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { parseBillingDateRange, billingDateCondition } from "./billing-date-range";

describe("billing custom dates", () => {
  it("keeps existing requests unchanged", () => {
    expect(parseBillingDateRange(undefined, undefined)).toBeNull();
  });
  it("accepts inclusive ranges and a single day", () => {
    expect(parseBillingDateRange("2026-10-01", "2026-10-24")).toEqual({ from: "2026-10-01", to: "2026-10-24" });
    expect(parseBillingDateRange("2026-10-24", "2026-10-24")).not.toBeNull();
    expect(parseBillingDateRange("2028-02-29", "2028-02-29")).not.toBeNull();
  });
  it.each([
    ["2026-02-30", "2026-03-01"], ["2026-02-29", "2026-03-01"],
    ["2026-13-01", "2027-01-01"], ["", ""],
    [undefined, "2026-10-24"], ["2026-10-01", undefined],
    [["2026-10-01"], "2026-10-24"], ["2026-10-25", "2026-10-24"],
    ["0000-01-01", "2026-10-24"],
  ])("rejects invalid dates or ranges (%s, %s)", (from, to) => {
    expect(() => parseBillingDateRange(from, to)).toThrow();
  });
  it("uses a parameterized, inclusive IST calendar-day predicate", () => {
    const predicate = billingDateCondition(sql`created_at`, { from: "2026-10-01", to: "2026-10-24" });
    const query = new PgDialect().sqlToQuery(predicate!);
    expect(query.sql).toContain("AT TIME ZONE 'Asia/Kolkata'");
    expect(query.sql).toContain("BETWEEN $1::date AND $2::date");
    expect(query.params).toEqual(["2026-10-01", "2026-10-24"]);
    expect(billingDateCondition(sql`created_at`, null)).toBeUndefined();
  });
});
