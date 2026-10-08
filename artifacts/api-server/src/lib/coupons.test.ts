import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  assertCouponAvailable,
  CouponError,
  couponDiscount,
  couponFromRow,
  lookupCoupon,
  normalizeCouponCode,
  redeemCoupon,
} from "./coupons";

const row = {
  id: "00000000-0000-0000-0000-000000000031",
  code: "TM-TEST1234",
  discount_type: "percent",
  discount_value: "10.00",
  max_uses: 2,
  used_count: 0,
  is_active: true,
  expires_at: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
};
const dialect = new PgDialect();
describe("coupon policy and transactional SQL", () => {
  it("normalizes codes but refuses invalid characters/length", () => {
    expect(normalizeCouponCode(" tm-test1234 ")).toBe("TM-TEST1234");
    for (const code of [
      null,
      "",
      "abc",
      "DROP TABLE coupons;",
      "a".repeat(33),
    ]) {
      expect(() => normalizeCouponCode(code)).toThrow(CouponError);
    }
  });
  it("exposes accurate used and remaining counts", () => {
    expect(couponFromRow({ ...row, used_count: 1 })).toMatchObject({
      usedCount: 1,
      remainingUses: 1,
      discountValue: 10,
    });
  });
  it("calculates percent and rupee discounts at paise precision", () => {
    expect(couponDiscount(190, "percent", 10)).toBe(19);
    expect(couponDiscount(199.99, "percent", 15)).toBe(30);
    expect(couponDiscount(190, "amount", 25.25)).toBe(25.25);
    expect(couponDiscount(10, "amount", 25)).toBe(10);
  });
  it("refuses disabled, expired and exhausted coupons", () => {
    expect(() =>
      assertCouponAvailable(couponFromRow({ ...row, is_active: false })),
    ).toThrow("disabled");
    expect(() =>
      assertCouponAvailable(
        couponFromRow({ ...row, expires_at: "2020-01-01T00:00:00Z" }),
      ),
    ).toThrow("expired");
    expect(() =>
      assertCouponAvailable(couponFromRow({ ...row, used_count: 2 })),
    ).toThrow("usage limit");
  });
  it("preview reads without consuming usage or locking, and scopes by shop", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });
    await lookupCoupon(execute, "fixture-shop", "tm-test1234", "0000000001");
    const queries = execute.mock.calls.map((call) =>
      dialect.sqlToQuery(call[0]),
    );
    expect(queries[0].sql).not.toContain("FOR UPDATE");
    expect(queries[0].sql).toContain("tenant_id IS NOT DISTINCT FROM");
    expect(queries[0].params).toContain("fixture-shop");
    expect(queries[0].params).toContain("TM-TEST1234");
    expect(queries.every((query) => !/UPDATE|INSERT/.test(query.sql))).toBe(
      true,
    );
  });
  it("checkout takes a row lock before checking prior customer usage", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });
    await lookupCoupon(execute, "fixture-shop", row.code, "0000000001", true);
    expect(dialect.sqlToQuery(execute.mock.calls[0][0]).sql).toContain(
      "FOR UPDATE",
    );
  });
  it("refuses an already-used customer phone even when total uses remain", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ id: "redemption" }] });
    await expect(
      lookupCoupon(execute, "fixture-shop", row.code, "0000000001", true),
    ).rejects.toThrow("already used");
  });
  it("refuses a code from another shop without exposing it", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(
      lookupCoupon(execute, "other-shop", row.code, "0000000001"),
    ).rejects.toThrow("not found");
    expect(execute).toHaveBeenCalledOnce();
  });
  it("validates phones before querying", async () => {
    const execute = vi.fn();
    await expect(
      lookupCoupon(execute, "fixture", row.code, "+910000000001"),
    ).rejects.toThrow("10-digit");
    expect(execute).not.toHaveBeenCalled();
  });
  it("increments only while still active, in scope, under limit and unexpired", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: row.id }] })
      .mockResolvedValueOnce({ rows: [] });
    await redeemCoupon(
      execute,
      "fixture-shop",
      couponFromRow(row),
      "0000000001",
      row.id,
      10,
    );
    const update = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(update.sql).toContain("used_count < max_uses");
    expect(update.sql).toContain("is_active = true");
    expect(update.sql).toContain("clock_timestamp()");
    expect(update.params).toContain("fixture-shop");
    const insert = dialect.sqlToQuery(execute.mock.calls[1][0]);
    expect(insert.sql).toContain("INSERT INTO coupon_redemptions");
    expect(insert.params).toContain("0000000001");
    expect(insert.params).toContain("10.00");
  });
  it("does not insert a redemption when the final availability guard fails", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await expect(
      redeemCoupon(
        execute,
        "fixture",
        couponFromRow(row),
        "0000000001",
        row.id,
        10,
      ),
    ).rejects.toThrow("availability changed");
    expect(execute).toHaveBeenCalledOnce();
  });
  it("refuses a zero-value redemption before mutation", async () => {
    const execute = vi.fn();
    await expect(
      redeemCoupon(
        execute,
        "fixture",
        couponFromRow(row),
        "0000000001",
        row.id,
        0,
      ),
    ).rejects.toThrow("zero-value");
    expect(execute).not.toHaveBeenCalled();
  });
});
