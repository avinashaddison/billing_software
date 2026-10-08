import { Router } from "express";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdmin, requireWrite } from "../middlewares/auth";
import {
  CouponError,
  couponFromRow,
  lookupCoupon,
  couponDiscount,
} from "../lib/coupons";

const router = Router();
router.get("/coupons", requireAdmin, async (req, res) => {
  const result =
    await db.execute(sql`SELECT * FROM coupons WHERE tenant_id IS NOT DISTINCT FROM ${req.tenantId ?? null}
    ORDER BY created_at DESC`);
  res.json(result.rows.map((row) => couponFromRow(row)));
});
router.post("/coupons", requireAdmin, async (req, res) => {
  const { discountType, discountValue, maxUses, expiresAt } = req.body ?? {};
  if (
    !["percent", "amount"].includes(discountType) ||
    typeof discountValue !== "number" ||
    !Number.isFinite(discountValue) ||
    discountValue <= 0 ||
    discountValue > 1_000_000 ||
    (Math.round(discountValue * 100) !== discountValue * 100 &&
      Math.abs(Math.round(discountValue * 100) - discountValue * 100) > 1e-7) ||
    (discountType === "percent" && discountValue > 100) ||
    !Number.isInteger(maxUses) ||
    maxUses < 1 ||
    maxUses > 1_000_000 ||
    (expiresAt != null &&
      (typeof expiresAt !== "string" ||
        !Number.isFinite(Date.parse(expiresAt)) ||
        Date.parse(expiresAt) <= Date.now()))
  ) {
    res
      .status(400)
      .json({
        error:
          "Enter a valid discount (up to two decimals), usage limit and optional future expiry.",
      });
    return;
  }
  const code = `TM-${randomBytes(6).toString("hex").toUpperCase()}`;
  const result =
    await db.execute(sql`INSERT INTO coupons(tenant_id,code,discount_type,discount_value,max_uses,expires_at)
    VALUES(${req.tenantId ?? null},${code},${discountType},${discountValue},${maxUses},${expiresAt ? new Date(expiresAt) : null}) RETURNING *`);
  res.status(201).json(couponFromRow(result.rows[0]));
});
router.patch("/coupons/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    typeof req.body?.isActive !== "boolean"
  ) {
    res
      .status(400)
      .json({ error: "A valid coupon id and isActive boolean are required." });
    return;
  }
  const result =
    await db.execute(sql`UPDATE coupons SET is_active = ${req.body.isActive} WHERE id = ${id}
    AND tenant_id IS NOT DISTINCT FROM ${req.tenantId ?? null} RETURNING *`);
  if (!result.rows[0]) {
    res.status(404).json({ error: "Coupon not found." });
    return;
  }
  res.json(couponFromRow(result.rows[0]));
});
router.post("/coupons/preview", requireWrite("scan"), async (req, res) => {
  const { code, customerPhone, subtotal } = req.body ?? {};
  if (
    typeof customerPhone !== "string" ||
    !/^[0-9]{10}$/.test(customerPhone) ||
    typeof subtotal !== "number" ||
    !Number.isFinite(subtotal) ||
    subtotal <= 0 ||
    subtotal > 1e12
  ) {
    res
      .status(400)
      .json({
        error:
          "Enter a customer mobile number and add items before applying a coupon.",
      });
    return;
  }
  try {
    const coupon = await lookupCoupon(
      async (query) => db.execute(query),
      req.tenantId,
      code,
      customerPhone,
    );
    res.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: couponDiscount(
        subtotal,
        coupon.discountType,
        coupon.discountValue,
      ),
      subtotal,
      customerPhone,
    });
  } catch (error) {
    if (!(error instanceof CouponError)) throw error;
    res.status(400).json({ error: error.message });
  }
});
export default router;
