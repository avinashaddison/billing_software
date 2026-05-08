import bcrypt from "bcryptjs";
import { db, staffProfilesTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_OWNER_NAME = "Owner";
const DEFAULT_OWNER_PIN  = "1234";
const BCRYPT_ROUNDS      = 10;

/**
 * Idempotent first-run setup for an empty database.
 *
 * If no staff profiles exist yet, insert a default Owner account so the user
 * can actually log in. PIN is bcrypt-hashed up front (matches the auth flow's
 * expectation in routes/staff.ts).
 *
 * Safe to run on every server start: a populated DB returns immediately
 * without touching anything.
 */
export async function bootstrapDefaultOwner(): Promise<void> {
  try {
    const existing = await db
      .select({ id: staffProfilesTable.id })
      .from(staffProfilesTable)
      .limit(1);

    if (existing.length > 0) return;

    const hashedPin = await bcrypt.hash(DEFAULT_OWNER_PIN, BCRYPT_ROUNDS);

    await db.insert(staffProfilesTable).values({
      name:     DEFAULT_OWNER_NAME,
      pin:      hashedPin,
      role:     "owner",
      isActive: true,
    });

    logger.warn(
      { name: DEFAULT_OWNER_NAME, pin: DEFAULT_OWNER_PIN },
      "Bootstrap: created default Owner. CHANGE THE PIN IMMEDIATELY in Staff Management.",
    );
  } catch (err) {
    // Never fail startup because of bootstrap — the DB might be unreachable
    // and we still want the server to come up so the operator can debug.
    logger.error({ err }, "Bootstrap of default Owner failed");
  }
}
