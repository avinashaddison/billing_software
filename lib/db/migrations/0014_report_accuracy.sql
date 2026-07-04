-- 0014_report_accuracy.sql
--
-- Report-accuracy fixes (all additive + idempotent):
--
-- 1. bills.discount_amount — the actual rupee discount applied at checkout.
--    Historically only the RAW cashier input was stored (e.g. 10 for "10%"),
--    which made the EOD "Discount Given" figure understate percent discounts
--    (it multiplied the already-discounted total) and overstate over-sized
--    amount discounts (the raw value was never clamped to the subtotal).
--    Checkout now writes the computed amount; this backfills old bills
--    exactly from their sale_items subtotals.
--
-- 2. sale_items.purchase_price — cost snapshot at sale time. Profit reports
--    previously multiplied CURRENT products.purchase_price by sold quantity,
--    so editing a product's cost silently rewrote historical profit. New
--    sales snapshot the cost; old rows stay NULL and reports fall back to
--    the product's current cost (same behaviour as before for them).

ALTER TABLE bills      ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS purchase_price  numeric(10,2);

-- Exact backfill from line-item subtotals (pre-bill-discount base).
-- WHERE discount_amount IS NULL makes re-runs no-ops.
UPDATE bills b
SET discount_amount = sub.calc
FROM (
  SELECT b2.id,
         CASE
           WHEN b2.discount_type = 'percent' THEN ROUND(s.subtotal * b2.discount / 100, 2)
           ELSE LEAST(b2.discount, s.subtotal)
         END AS calc
  FROM bills b2
  JOIN LATERAL (
    SELECT COALESCE(SUM(si.subtotal), 0) AS subtotal
    FROM sale_items si
    WHERE si.sale_id = b2.id
  ) s ON true
  WHERE b2.discount IS NOT NULL
    AND b2.discount > 0
    AND b2.discount_type IS NOT NULL
    AND b2.discount_amount IS NULL
) sub
WHERE b.id = sub.id;
