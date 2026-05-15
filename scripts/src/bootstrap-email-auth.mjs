/**
 * Bootstrap owner user for email/password authentication.
 * 
 * Run this once during initial setup to create the first owner account.
 * Usage: node scripts/src/bootstrap-email-auth.mjs
 */

import bcrypt from "bcryptjs";
import { db, tenantsTable, authUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const OWNER_EMAIL = "admin@example.com";
const OWNER_PASSWORD = "admin123";
const SHOP_NAME = "My Shop";

async function main() {
  console.log("Bootstrapping email/password owner user...");
  
  // Check if we already have an owner user
  const existing = await db
    .select()
    .from(authUsersTable)
    .where(eq(authUsersTable.email, OWNER_EMAIL.toLowerCase()));
  
  if (existing.length > 0) {
    console.log("Owner user already exists:", existing[0].email);
    process.exit(0);
  }
  
  // Create tenant first
  const tenantId = "default";
  const [tenant] = await db
    .insert(tenantsTable)
    .values({ id: tenantId, name: SHOP_NAME })
    .onConflictDoNothing()
    .returning();
  
  console.log("Tenant:", tenant?.name || SHOP_NAME);
  
  // Hash password
  const hash = await bcrypt.hash(OWNER_PASSWORD, 10);
  
  // Create owner user
  const [user] = await db
    .insert(authUsersTable)
    .values({
      tenantId,
      email: OWNER_EMAIL.toLowerCase(),
      passwordHash: hash,
      role: "owner",
    })
    .returning();
  
  console.log("Created owner user:", user.email, "role:", user.role);
  console.log("Password:", OWNER_PASSWORD);
  console.log("You can now log in at http://localhost:3000/login");
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
