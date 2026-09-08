/**
 * Customer mobile number rules, shared by the Checkout page and the Scan
 * page's Confirm Checkout modal.
 *
 * Every customer bill needs the customer's 10-digit mobile number — the
 * server refuses checkout without one, so both pages must stop the sale
 * (online AND before an offline enqueue) rather than let it reach the
 * server or the offline queue. The supplier-payment mode is exempt: it bills
 * no lines, it only records a payment to the supplier.
 */

/** True when `v` is a complete 10-digit number (digits only, no +91). */
export function isCompleteCustomerPhone(v: string): boolean {
  return /^\d{10}$/.test(v);
}

/**
 * Inline error for a number the cashier has started typing. A blank field
 * stays quiet here — the required error is raised only when they try to
 * complete the sale, so the form doesn't open covered in red.
 */
export function customerPhoneFormatError(v: string): string {
  return !v || isCompleteCustomerPhone(v) ? "" : "Enter a valid 10-digit number";
}

/**
 * Error to show under the field on a blank or incomplete submit.
 * (A partially typed number keeps its more specific format error.)
 */
export function customerPhoneSubmitError(v: string): string {
  return v ? customerPhoneFormatError(v) : "Customer mobile number is required";
}

/** Toast shown when the cashier tries to complete a sale without the number. */
export const CUSTOMER_PHONE_REQUIRED_TOAST =
  "Enter the customer's 10-digit mobile number to complete the sale";
