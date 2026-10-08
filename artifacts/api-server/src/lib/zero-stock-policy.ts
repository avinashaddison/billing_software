export const ZERO_STOCK_DAYS = 30;
export const ARCHIVE_ZERO_STOCK_SQL = `
  UPDATE products
  SET deleted_at = now()
  WHERE deleted_at IS NULL AND stock = 0
    AND zero_stock_since IS NOT NULL
    AND zero_stock_since <= now() - interval '30 days'
  RETURNING id, tenant_id
`;
