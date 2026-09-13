-- "Stock Entry" permission (resource key `stockEntry`).
--
-- Until now the ability to add/remove stock of an EXISTING product
-- (POST /products/:id/stock, the Entry Data page, the Scan page's Stock IN
-- mode, Quick Adjust) rode along with `scan` — the permission every cashier
-- needs to bill. That made it impossible to give a data-entry staff member
-- "Product Entry" (create new items) without also letting them move
-- inventory. Stock changes now require `stockEntry: write`; `scan` is
-- billing only.
--
-- Backfill, once per staff row that has a `scan` row but no `stockEntry`
-- row yet, so nobody's day changes on deploy:
--   • holders of the add-only "Product Entry" grant → none. That grant was
--     introduced as "add new products, nothing else" — the vendor's rule is
--     that such staff must not change stock of existing items.
--   • everyone else → their `scan` level, i.e. exactly what they could do
--     yesterday (none / read-only Entry Data / add stock).
-- Staff with no permission rows at all are left alone: they can do nothing
-- until the owner saves their permissions, and that editor pre-fills every
-- key from the same defaults. Owners bypass the map entirely (by role).
--
-- Idempotent: only inserts missing rows, never rewrites an existing choice,
-- so an owner's later decision in Staff Management always wins.
INSERT INTO staff_permissions (staff_id, resource, level, tenant_id)
SELECT sc.staff_id,
       'stockEntry',
       CASE
         WHEN EXISTS (
           SELECT 1 FROM staff_permissions pe
           WHERE pe.staff_id = sc.staff_id AND pe.resource = 'productEntry' AND pe.level = 'write'
         ) THEN 'none'
         ELSE sc.level
       END,
       sc.tenant_id
FROM staff_permissions sc
WHERE sc.resource = 'scan'
  AND NOT EXISTS (
    SELECT 1 FROM staff_permissions x
    WHERE x.staff_id = sc.staff_id AND x.resource = 'stockEntry'
  )
ON CONFLICT (staff_id, resource) DO NOTHING;
