-- Additive only. Existing zero-stock products start their grace period NOW,
-- not at their creation/last sale: legacy stock provenance is incomplete.
ALTER TABLE products ADD COLUMN IF NOT EXISTS zero_stock_since timestamptz;
UPDATE products SET zero_stock_since = now()
WHERE stock = 0 AND deleted_at IS NULL AND zero_stock_since IS NULL;

CREATE OR REPLACE FUNCTION track_product_zero_stock() RETURNS trigger AS $$
BEGIN
  IF NEW.stock <> 0 OR NEW.deleted_at IS NOT NULL THEN
    NEW.zero_stock_since := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.zero_stock_since := now();
  ELSIF OLD.stock <> 0 THEN
    NEW.zero_stock_since := now();
  ELSE
    NEW.zero_stock_since := COALESCE(OLD.zero_stock_since, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS products_zero_stock_clock ON products;
CREATE TRIGGER products_zero_stock_clock
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION track_product_zero_stock();

-- Unlike last_seen_at, this is NOT bumped by polling or SSE connections.
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();
-- Preserve checkout receipt access without exposing other cashiers' bills.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS created_by_staff_id uuid;
