export const CHECKOUT_DISCOUNT_PERMISSION = "checkoutDiscount";
export const DISCOUNT_PERMISSION_MESSAGE =
  "Ask the owner to allow Edit Checkout Discount in Staff Permissions.";

export function hasCheckoutDiscountGrant(
  role: string,
  level?: string,
): boolean {
  return role === "owner" || role === "admin" || level === "write";
}

export function requestsExtraDiscount(body: {
  discount?: number;
  items: object[];
}): boolean {
  return (
    (body.discount ?? 0) > 0 ||
    body.items.some(
      (item) =>
        "discountValue" in item &&
        typeof item.discountValue === "number" &&
        item.discountValue > 0,
    )
  );
}

export function lowersCataloguePrice(
  submitted: number,
  catalogue: number,
): boolean {
  // Catalogue prices and submitted unit prices are both compared at paise
  // precision. Normal checkout rounding is not an extra cashier discount.
  return Math.round(submitted * 100) < Math.round(catalogue * 100);
}

export class DiscountPermissionError extends Error {
  constructor() {
    super(DISCOUNT_PERMISSION_MESSAGE);
  }
}
