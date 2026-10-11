-- Isolated, additive storage. Nothing updates business ledgers or stock.
CREATE TABLE IF NOT EXISTS daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 5000),
  entry_date date NOT NULL,
  is_task boolean NOT NULL DEFAULT false,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_notes_tenant_date ON daily_notes(tenant_id, entry_date DESC);
CREATE TABLE IF NOT EXISTS daily_khata_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_khata_accounts_tenant ON daily_khata_accounts(tenant_id);
CREATE TABLE IF NOT EXISTS daily_khata_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  account_id uuid NOT NULL REFERENCES daily_khata_accounts(id),
  direction text NOT NULL CHECK (direction IN ('given', 'received')),
  amount_paise bigint NOT NULL CHECK (amount_paise BETWEEN 1 AND 1000000000),
  entry_date date NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'upi')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  voided_at timestamptz,
  void_reason text,
  -- Logical correction link, intentionally not a self-FK: restore orders tables,
  -- not individual rows. The transaction validates the original before insertion.
  corrected_from uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_khata_entries_account ON daily_khata_entries(tenant_id, account_id, entry_date DESC);
CREATE TABLE IF NOT EXISTS daily_book_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text REFERENCES tenants(id),
  request_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status integer NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_book_requests_unique
  ON daily_book_requests(COALESCE(tenant_id, '__legacy_null__'), request_key);
