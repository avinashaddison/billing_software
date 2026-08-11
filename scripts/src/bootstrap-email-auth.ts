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

const OWNER_EMAIL = process.env["OWNER_EMAIL"]?.trim().toLowerCase() || "admin@example.com";
const TENANT_ID   = process.env["TENANT_ID"]?.trim() || "default";
const TENANT_NAME = process.env["TENANT_NAME"]?.trim() || "Default Shop";

/* NEVER hardcode a password here — this file is committed, so any default in it
   is public knowledge. Supply it at run time:

     OWNER_PASSWORD='<strong-password>' \
       pnpm --filter @workspace/scripts run bootstrap-email-auth */
const OWNER_PASSWORD = process.env["OWNER_PASSWORD"] ?? "";
if (OWNER_PASSWORD.length < 8) {
  console.error(
    "Refusing to run: set OWNER_PASSWORD to at least 8 characters.\n" +
    "  OWNER_PASSWORD='<strong-password>' pnpm --filter @workspace/scripts run bootstrap-email-auth",
  );
  process.exit(1);
}

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
  /* Password deliberately not printed — see reset-hirasons-owner.ts. */
  console.log("You can now log in at /login with the password you supplied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
