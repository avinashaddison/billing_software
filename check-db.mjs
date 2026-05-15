// Quick script to check tenants and auth_users in the database
import pg from 'pg';
const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('NEON_DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // Check tenants
    const tenants = await pool.query('SELECT * FROM tenants');
    console.log('=== TENANTS ===');
    console.log(tenants.rows);

    // Check auth_users  
    const users = await pool.query('SELECT id, tenant_id, email, role, is_active, created_at FROM auth_users');
    console.log('\n=== AUTH USERS ===');
    console.log(users.rows);
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}

main();
