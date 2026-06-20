-- 0011_perf_indexes.sql
-- Add indexes on frequently-filtered / joined foreign-key columns so reports,
-- receipts and customer lookups stay fast as transaction history grows.
-- Fully idempotent.
CREATE INDEX IF NOT EXISTS bills_customer_phone_idx  ON bills (customer_phone);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx    ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_id_idx ON sale_items (product_id);
CREATE INDEX IF NOT EXISTS returns_bill_id_idx       ON returns (bill_id);
CREATE INDEX IF NOT EXISTS returns_product_id_idx    ON returns (product_id);
CREATE INDEX IF NOT EXISTS stock_logs_product_id_idx ON stock_logs (product_id);
