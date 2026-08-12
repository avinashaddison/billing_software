-- Vendor-side control tables for the platform admin panel.
--
-- Three unrelated gaps, one migration because they ship together:
--
--   1. tenant_payments — what each SHOP paid the VENDOR for access. The app
--      tracked every rupee a shop takes from its customers but had no record
--      of the vendor's own income, so "what did this shop pay me, and when?"
--      was unanswerable. Distinct from bill_payments (customer → shop) and
--      supplier_payments (shop → supplier); this is shop → vendor.
--
--   2. announcements — a notice the vendor can show inside one shop's app or
--      every shop's app. tenant_id NULL means "all shops".
--
--   3. tenants.max_staff / max_products — optional per-shop caps. NULL means
--      unlimited, which is what every existing shop gets, so this changes
--      nothing until a cap is deliberately set.
--
-- Idempotent: safe to re-run on every cold start.

CREATE TABLE IF NOT EXISTS tenant_payments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  /* Shop that paid. No FK: a payment record must outlive a shop rename or
     any future tenant cleanup — it is the vendor's accounting history. */
  tenant_id         TEXT        NOT NULL,
  amount            NUMERIC(15,2) NOT NULL,
  /* cash | upi | bank | card | other — free text, validated in the API. */
  method            TEXT        NOT NULL DEFAULT 'cash',
  note              TEXT,
  /* What the money bought, recorded at the time so later expiry changes
     don't rewrite history. Both nullable: an ad-hoc payment need not map to
     a period. */
  covers_days       INTEGER,
  covers_until      TIMESTAMPTZ,
  /* When the money actually arrived, which is not always when it was typed
     in — the vendor may enter last week's cash today. */
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by_email TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_payments_tenant_idx  ON tenant_payments (tenant_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS tenant_payments_paid_at_idx ON tenant_payments (paid_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_payments_amount_positive') THEN
    ALTER TABLE tenant_payments
      ADD CONSTRAINT tenant_payments_amount_positive CHECK (amount > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  /* NULL = show to every shop. Otherwise scoped to one tenant. */
  tenant_id    TEXT,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  /* info | warning | critical — drives the banner colour in the shop app. */
  level        TEXT        NOT NULL DEFAULT 'info',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  /* Optional window. NULL start = show immediately, NULL end = until switched
     off. Checked in SQL so an expired notice disappears on its own. */
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_by_email TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_live_idx ON announcements (is_active, tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_level_valid') THEN
    ALTER TABLE announcements
      ADD CONSTRAINT announcements_level_valid CHECK (level IN ('info', 'warning', 'critical'));
  END IF;
END $$;

/* Per-shop caps. NULL = unlimited (the existing behaviour for every shop). */
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_staff    INTEGER;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_products INTEGER;
