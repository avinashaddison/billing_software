-- One-shot cleanup of stale offer state on products that were taken
-- off Today's Deals before the PATCH endpoint started clearing the
-- offer fields on toggle-off. After this row, the only paths that can
-- create (is_today_deal = false AND sale_price IS NOT NULL) go through
-- direct DB edits, which is fine.
--
-- Idempotent: after the first run the WHERE clause matches nothing.

UPDATE products
   SET sale_price       = NULL,
       sale_price_until = NULL
 WHERE is_today_deal = false
   AND (sale_price IS NOT NULL OR sale_price_until IS NOT NULL);
