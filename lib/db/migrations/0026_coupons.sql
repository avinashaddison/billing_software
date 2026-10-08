-- Additive only: no changes to existing bills, products or staff grants.
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','amount')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)),
  max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 1000000),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_tenant_code_unique ON coupons (COALESCE(tenant_id,''),code);
CREATE INDEX IF NOT EXISTS coupons_tenant_created_idx ON coupons(tenant_id,created_at);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id),
  tenant_id text REFERENCES tenants(id),
  customer_phone text NOT NULL CHECK (customer_phone ~ '^[0-9]{10}$'),
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  discount_amount numeric(15,2) NOT NULL CHECK (discount_amount > 0),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id,customer_phone),
  UNIQUE(bill_id)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_tenant_idx ON coupon_redemptions(tenant_id);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS coupon_code text;
