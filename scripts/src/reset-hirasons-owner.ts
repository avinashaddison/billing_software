/**
 * Reset the Hira & Sons tenant's owner-email account to a known
 * email + password. Idempotent: re-running picks up the existing row.
 *
 * Uses raw SQL through `pool` so the script doesn't need drizzle-orm as
 * a direct dep — only @workspace/db.
 */
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

const NEW_EMAIL    = "owner@hirasons.com";
const NEW_PASSWORD = "admin123";
const TENANT_ID    = "hira-sons";

async function main(): Promise<void> {
  const hash = await bcrypt.hash(NEW_PASSWORD, 12);

  const existing = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM auth_users WHERE tenant_id = $1 LIMIT 1",
    [TENANT_ID],
  );

  if (existing.rows.length === 0) {
    const created = await pool.query<{ email: string }>(
      `INSERT INTO auth_users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING email`,
      [TENANT_ID, NEW_EMAIL, hash],
    );
    console.log("Created new owner:", created.rows[0].email);
  } else {
    const wasEmail = existing.rows[0].email;
    await pool.query(
      `UPDATE auth_users
         SET email         = $2,
             password_hash = $3,
             is_active     = true,
             updated_at    = now()
       WHERE id = $1`,
      [existing.rows[0].id, NEW_EMAIL, hash],
    );
    console.log("Updated owner row:");
    console.log("  was:", wasEmail);
    console.log("  now:", NEW_EMAIL);
  }

  console.log("\nLogin credentials:");
  console.log("  Email:   ", NEW_EMAIL);
  console.log("  Password:", NEW_PASSWORD);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
