import { db, tenantsTable, authUsersTable, staffProfilesTable } from "@workspace/db";

async function main() {
  const tenants = await db.select().from(tenantsTable);
  console.log("=== TENANTS ===");
  for (const t of tenants) console.log(`  ${t.id}  |  ${t.name}  |  active=${t.isActive}`);

  const users = await db
    .select({
      id: authUsersTable.id,
      tenantId: authUsersTable.tenantId,
      email: authUsersTable.email,
      role: authUsersTable.role,
      isActive: authUsersTable.isActive,
    })
    .from(authUsersTable);
  console.log("\n=== AUTH USERS (email/password) ===");
  if (users.length === 0) console.log("  (none)");
  for (const u of users) {
    console.log(`  tenant=${u.tenantId ?? "<null>"}  |  ${u.email}  |  role=${u.role}  |  active=${u.isActive}`);
  }

  const staff = await db
    .select({
      tenantId: staffProfilesTable.tenantId,
      name: staffProfilesTable.name,
      role: staffProfilesTable.role,
      isActive: staffProfilesTable.isActive,
    })
    .from(staffProfilesTable);
  console.log("\n=== STAFF PROFILES (PIN login) ===");
  if (staff.length === 0) console.log("  (none)");
  for (const s of staff) {
    console.log(`  tenant=${s.tenantId ?? "<null>"}  |  ${s.name}  |  role=${s.role}  |  active=${s.isActive}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
