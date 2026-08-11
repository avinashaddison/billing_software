import { describe, it, expect } from "vitest";
import { istToday, istShiftDay } from "./ist";

/**
 * The shop's business day is an Asia/Kolkata calendar day. These helpers decide
 * which sales land in "today" on the dashboard and in every report, so an
 * off-by-one here silently misstates a day's takings.
 */
describe("istShiftDay", () => {
  it("moves forward and back by whole days", () => {
    expect(istShiftDay("2026-08-11", 1)).toBe("2026-08-12");
    expect(istShiftDay("2026-08-11", -1)).toBe("2026-08-10");
    expect(istShiftDay("2026-08-11", 0)).toBe("2026-08-11");
  });

  it("crosses month boundaries", () => {
    expect(istShiftDay("2026-08-31", 1)).toBe("2026-09-01");
    expect(istShiftDay("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("crosses year boundaries", () => {
    expect(istShiftDay("2025-12-31", 1)).toBe("2026-01-01");
    expect(istShiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap years", () => {
    expect(istShiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(istShiftDay("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("spans a reporting range without drifting", () => {
    expect(istShiftDay("2026-08-11", -29)).toBe("2026-07-13");
    expect(istShiftDay("2026-08-11", -364)).toBe("2025-08-12");
  });
});

describe("istToday", () => {
  it("returns a YYYY-MM-DD day string", () => {
    expect(istToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports the Asia/Kolkata day, which is what the shop counts by", () => {
    const expected = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    expect(istToday()).toBe(expected);
  });

  it("round-trips through the shift helper", () => {
    const today = istToday();
    expect(istShiftDay(istShiftDay(today, 7), -7)).toBe(today);
  });
});
