import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, authUsersTable } from "@workspace/db";

const NEW_EMAIL    = "owner@hirasons.com";
const NEW_PASSWORD = "admin123";
const TENANT_ID    = "hira-sons";

async function main() {
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  const [existing] = await db
    .select()
    .from(authUsersTable)
    .where(eq(authUsersTable.tenantId, TENANT_ID));

  if (!existing) {
    const [created] = await db
      .insert(authUsersTable)
      .values({
        tenantId:     TENANT_ID,
        email:        NEW_EMAIL,
        passwordHash: hash,
        role:         "owner",
      })
      .returning();
    console.log("Created new owner:", created.email);
  } else {
    const [updated] = await db
      .update(authUsersTable)
      .set({
        email:        NEW_EMAIL,
        passwordHash: hash,
        isActive:     true,
        updatedAt:    new Date(),
      })
      .where(eq(authUsersTable.id, existing.id))
      .returning();
    console.log("Updated owner row:");
    console.log("  was:", existing.email);
    console.log("  now:", updated.email);
  }

  console.log("\nLogin credentials:");
  console.log("  Email:    " + NEW_EMAIL);
  console.log("  Password: " + NEW_PASSWORD);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
