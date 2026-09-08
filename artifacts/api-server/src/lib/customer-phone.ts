/**
 * Customer mobile number rule for checkout.
 *
 * Every bill must carry the customer's 10-digit mobile number: it is the key
 * the customer ledger, credit collection and repeat-customer lookups run on.
 * The number is stored as bare digits (no +91, spaces or dashes) — exactly
 * what the billing UIs send after stripping non-digits.
 */

/** True when `value` is a string of exactly 10 digits. */
export function isValidCustomerPhone(value: unknown): value is string {
  return typeof value === "string" && /^\d{10}$/.test(value);
}

/** 400 body when a checkout arrives without the number. */
export const CUSTOMER_PHONE_REQUIRED_MESSAGE =
  "Customer's 10-digit mobile number is required to complete a bill.";
