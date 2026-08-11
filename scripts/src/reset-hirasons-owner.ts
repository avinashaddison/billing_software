/**
 * Reset the Hira & Sons tenant's owner-email account to a known
 * email + password. Idempotent: re-running picks up the existing row.
 *
 * Uses raw SQL through `pool` so the script doesn't need drizzle-orm as
 * a direct dep — only @workspace/db.
 */
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

const NEW_EMAIL = process.env["OWNER_EMAIL"]?.trim().toLowerCase() || "owner@hirasons.com";
const TENANT_ID = "hira-sons";

/* NEVER hardcode a password here. This file is committed to the repo, so any
   default written into it is effectively public — and this script writes to a
   LIVE shop account. Supply the password at run time instead:

     OWNER_PASSWORD='<strong-password>' \
       pnpm --filter @workspace/scripts exec tsx ./src/reset-hirasons-owner.ts

   The script refuses to run without one, so a weak shared default can never
   reach production again. */
const NEW_PASSWORD = process.env["OWNER_PASSWORD"] ?? "";
if (NEW_PASSWORD.length < 8) {
  console.error(
    "Refusing to run: set OWNER_PASSWORD to at least 8 characters.\n" +
    "  OWNER_PASSWORD='<strong-password>' pnpm --filter @workspace/scripts exec tsx ./src/reset-hirasons-owner.ts",
  );
  process.exit(1);
}

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

  /* The password is deliberately NOT printed: terminal scrollback, CI logs and
     shell history are all places a live shop's owner password must not land. */
  console.log("\nDone. Login email:", NEW_EMAIL);
  console.log("Password: (the value you passed in OWNER_PASSWORD — not printed)");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
