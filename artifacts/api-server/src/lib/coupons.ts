import { sql, type SQL } from "drizzle-orm";

export type Coupon = {
  id: string;
  code: string;
  discountType: "percent" | "amount";
  discountValue: number;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};
type Execute = (query: SQL) => Promise<{ rows: unknown[] }>;
export class CouponError extends Error {}
export function normalizeCouponCode(code: unknown): string {
  if (typeof code !== "string") throw new CouponError("Enter a coupon code.");
  const value = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(value))
    throw new CouponError("Invalid coupon code.");
  return value;
}
export function couponDiscount(
  subtotal: number,
  type: "percent" | "amount",
  value: number,
): number {
  return Math.min(
    subtotal,
    Math.round((type === "percent" ? (subtotal * value) / 100 : value) * 100) /
      100,
  );
}
export function couponFromRow(row: Record<string, unknown>): Coupon {
  const maxUses = Number(row.max_uses),
    usedCount = Number(row.used_count);
  return {
    id: String(row.id),
    code: String(row.code),
    discountType: row.discount_type as Coupon["discountType"],
    discountValue: Number(row.discount_value),
    maxUses,
    usedCount,
    remainingUses: Math.max(0, maxUses - usedCount),
    isActive: row.is_active === true,
    expiresAt: row.expires_at
      ? new Date(row.expires_at as string).toISOString()
      : null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}
export function assertCouponAvailable(coupon: Coupon, now = Date.now()): void {
  if (!coupon.isActive) throw new CouponError("This coupon is disabled.");
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now)
    throw new CouponError("This coupon has expired.");
  if (coupon.usedCount >= coupon.maxUses)
    throw new CouponError("This coupon has reached its usage limit.");
}
/** Actual checkout holds the coupon row lock through stock, bill and redemption
 * commit. Previews do not consume a use and are not authorization to redeem. */
export async function lookupCoupon(
  execute: Execute,
  tenantId: string | null | undefined,
  code: unknown,
  phone: string,
  lock = false,
): Promise<Coupon> {
  const normalized = normalizeCouponCode(code);
  if (!/^[0-9]{10}$/.test(phone))
    throw new CouponError("Enter a 10-digit customer mobile number.");
  const result =
    await execute(sql`SELECT * FROM coupons WHERE tenant_id IS NOT DISTINCT FROM ${tenantId ?? null}
    AND code = ${normalized} ${lock ? sql`FOR UPDATE` : sql``}`);
  if (!result.rows[0]) throw new CouponError("Coupon not found.");
  const coupon = couponFromRow(result.rows[0] as Record<string, unknown>);
  assertCouponAvailable(coupon);
  const redeemed =
    await execute(sql`SELECT id FROM coupon_redemptions WHERE coupon_id = ${coupon.id}
    AND tenant_id IS NOT DISTINCT FROM ${tenantId ?? null} AND customer_phone = ${phone}`);
  if (redeemed.rows.length)
    throw new CouponError("This customer has already used this coupon.");
  return coupon;
}
export async function redeemCoupon(
  execute: Execute,
  tenantId: string | null | undefined,
  coupon: Coupon,
  phone: string,
  billId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0)
    throw new CouponError("This coupon cannot be used on a zero-value bill.");
  const updated =
    await execute(sql`UPDATE coupons SET used_count = used_count + 1 WHERE id = ${coupon.id}
    AND tenant_id IS NOT DISTINCT FROM ${tenantId ?? null} AND is_active = true
    AND used_count < max_uses AND (expires_at IS NULL OR expires_at > clock_timestamp()) RETURNING id`);
  if (!updated.rows.length)
    throw new CouponError(
      "Coupon availability changed. Please apply it again.",
    );
  await execute(sql`INSERT INTO coupon_redemptions(coupon_id,tenant_id,customer_phone,bill_id,discount_amount)
    VALUES(${coupon.id},${tenantId ?? null},${phone},${billId},${amount.toFixed(2)})`);
}
