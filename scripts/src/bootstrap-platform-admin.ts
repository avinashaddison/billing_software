/**
 * Bootstrap a platform-admin auth_users row.
 *
 *   Usage:
 *     pnpm --filter @workspace/scripts run bootstrap-platform-admin \
 *       -- --email you@vendor.com --password <strong-password>
 *
 *   If the email already exists, the row is updated (role promoted to
 *   platform_admin, password rehashed, tenant_id cleared). Safe to re-run.
 *
 *   Uses raw SQL through `pool` (not drizzle's query builder) so this script
 *   doesn't need drizzle-orm as a direct dep — it only relies on @workspace/db.
 */
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email    = arg("email")?.trim().toLowerCase();
  const password = arg("password");

  if (!email || !password) {
    console.error("Usage: bootstrap-platform-admin -- --email <email> --password <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  /* Check for existing row by email (case-insensitive). */
  const existing = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM auth_users WHERE lower(email) = lower($1) LIMIT 1",
    [email],
  );

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE auth_users
         SET tenant_id     = NULL,
             role          = 'platform_admin',
             password_hash = $2,
             is_active     = true,
             updated_at    = now()
       WHERE id = $1`,
      [id, hash],
    );
    console.log("Promoted existing user to platform_admin:", existing.rows[0].email);
  } else {
    const inserted = await pool.query<{ email: string }>(
      `INSERT INTO auth_users (tenant_id, email, password_hash, role)
       VALUES (NULL, $1, $2, 'platform_admin')
       RETURNING email`,
      [email, hash],
    );
    console.log("Created platform_admin:", inserted.rows[0].email);
  }

  console.log("\nLogin at /admin with:");
  console.log("  Email:", email);
  console.log("  Password: <hidden>");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
