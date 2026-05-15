/**
 * Bootstrap an initial tenant + owner user (email/password login).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run bootstrap-email-auth
 *
 * Uses raw SQL through `pool` (not drizzle's query builder) so this script
 * doesn't need drizzle-orm as a direct dep — it only relies on @workspace/db.
 */
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

const OWNER_EMAIL    = "admin@example.com";
const OWNER_PASSWORD = "admin123";
const TENANT_ID      = "default";
const TENANT_NAME    = "Default Shop";

async function main(): Promise<void> {
  console.log("Bootstrapping email/password owner user...");

  /* Bail early if this email already has a row — re-runs are safe but noisy. */
  const existing = await pool.query<{ email: string }>(
    "SELECT email FROM auth_users WHERE lower(email) = lower($1) LIMIT 1",
    [OWNER_EMAIL],
  );
  if (existing.rows.length > 0) {
    console.log("Owner user already exists:", existing.rows[0].email);
    process.exit(0);
  }

  /* Tenant first (ON CONFLICT DO NOTHING so re-running with a different
     OWNER_EMAIL above still works once the tenant exists). */
  await pool.query(
    "INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [TENANT_ID, TENANT_NAME],
  );
  console.log("Tenant:", TENANT_NAME);

  const hash = await bcrypt.hash(OWNER_PASSWORD, 12);
  const inserted = await pool.query<{ email: string; role: string }>(
    `INSERT INTO auth_users (tenant_id, email, password_hash, role)
     VALUES ($1, $2, $3, 'owner')
     RETURNING email, role`,
    [TENANT_ID, OWNER_EMAIL.toLowerCase(), hash],
  );
  console.log("Created owner user:", inserted.rows[0].email, "role:", inserted.rows[0].role);
  console.log("Password:", OWNER_PASSWORD);
  console.log("You can now log in at /login");
  process.exit(0);
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
