import { pool } from "@workspace/db";
import { createReadinessCheck } from "./readiness";

export async function verifyDatabase(): Promise<boolean> {
  // SELECTs validate both connectivity and the columns essential to authentication,
  // billing and stock. LIMIT 0 reads no customer or financial data.
  const probe = {
    text: `SELECT
      (SELECT zero_stock_since FROM products WHERE deleted_at IS NULL LIMIT 0),
      (SELECT id FROM staff_profiles LIMIT 0),
      (SELECT id FROM auth_users LIMIT 0),
      (SELECT last_activity_at FROM auth_sessions LIMIT 0),
      (SELECT id FROM tenants LIMIT 0),
      (SELECT created_by_staff_id FROM bills LIMIT 0),
      (SELECT id FROM sale_items LIMIT 0)`,
    query_timeout: 2_000,
  };
  await pool.query(probe);
  return true;
}

export const runtimeReadiness = createReadinessCheck(verifyDatabase);
