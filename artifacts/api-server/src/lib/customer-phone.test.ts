import { describe, it, expect } from "vitest";
import { isValidCustomerPhone, CUSTOMER_PHONE_REQUIRED_MESSAGE } from "./customer-phone";

describe("isValidCustomerPhone", () => {
  it("accepts exactly 10 bare digits", () => {
    expect(isValidCustomerPhone("9876543210")).toBe(true);
    expect(isValidCustomerPhone("0000000000")).toBe(true);
  });

  it("rejects blank, missing and non-string values", () => {
    expect(isValidCustomerPhone("")).toBe(false);
    expect(isValidCustomerPhone(undefined)).toBe(false);
    expect(isValidCustomerPhone(null)).toBe(false);
    expect(isValidCustomerPhone(9876543210)).toBe(false);
  });

  it("rejects wrong lengths and formatted numbers", () => {
    expect(isValidCustomerPhone("987654321")).toBe(false);
    expect(isValidCustomerPhone("98765432101")).toBe(false);
    expect(isValidCustomerPhone("+919876543210")).toBe(false);
    expect(isValidCustomerPhone("98765 43210")).toBe(false);
    expect(isValidCustomerPhone("98765-43210")).toBe(false);
    expect(isValidCustomerPhone("９８７６５４３２１０")).toBe(false);
  });

  it("has a cashier-facing required message", () => {
    expect(CUSTOMER_PHONE_REQUIRED_MESSAGE).toMatch(/10-digit mobile number is required/);
  });
});
