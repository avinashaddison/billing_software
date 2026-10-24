---
name: DB migrations, tenancy & which database the app really uses
description: How schema changes are applied (idempotent boot SQL), the NEON-vs-heliumdb gotcha, and the per-tenant uniqueness model.
---

# Which DB the app actually uses
- At runtime the app connects to `NEON_DATABASE_URL ?? DATABASE_URL` (lib/db/src/index.ts). Confirm secret existence on each import; do not assume the external secret transfers with the repository.
- TRAP: earlier imports had a full but EMPTY built-in schema copy; another import had no public tables at all. Neither tells you the external database's state. Confirm the active connection and base tables before initializing anything.
- Quick tell in boot logs for "which env did this process get": the pg SSL-modes warning appears only with the Neon URL, and the "BACKUPS NOT CONFIGURED" error appears only when Telegram secrets are missing from the process env.
- The code-execution `executeSql` callback / Replit built-in DB talk to a **separate** `heliumdb` (`DATABASE_URL`). Introspecting via executeSql does **not** reflect the app's real (NEON) schema — it can show stale/old constraints.
- Read the live-database safety policy in `replit.md` before startup, verification, or publishing work. The older assumption that normal startup should apply migrations is no longer valid.

# Migration convention
- Approved schema changes use hand-written **idempotent** additive SQL, never an automatic schema push.
  **Why:** repeated startup execution previously caused a non-idempotent migration to null sale prices.
  **How to apply:** keep migrations repeat-safe even when execution is deliberate; missing schema is not permission to modify the connected database.

# FIRST: `relation "..." does not exist` usually means the WRONG DB, not a missing schema
- A frequent cause was an API process started before the external connection secret existed, falling back to an empty built-in database. Confirm connection-source metadata before concluding the real schema is missing; a restart is not a read-only diagnostic.
- Corollary: do not "fix" this by pushing/creating schema. That would write a second, empty copy of the app into the wrong database while the real populated NEON DB sits untouched. Confirm which DB the process actually connected to first.

# Boot migrations CANNOT bootstrap an empty database
- The numbered migrations assume base tables already exist; do not mistake them for an initial schema installer.
- **Why this was confusing:** earlier startup code stayed alive after failed initialization, making liveness appear healthy despite missing tables. Treat readiness/schema verification, not liveness alone, as the startup check.
- **How to apply:** the "never push" rule protects the *existing populated* DB from destructive resets — it does not mean a fresh DB can self-provision. Seeding a new/empty database needs the base schema created first (Drizzle push against that empty DB, or a dumped base DDL) and only then the additive migrations. Check for base tables before assuming a DB-connection problem.
- Schema models have historically lagged raw SQL, especially expression/partial indexes. Do not infer the real database's constraints from model definitions alone.

# Per-tenant uniqueness (decision)
- `products.sku` / `products.barcode` and `categories.name` are unique **per tenant**, not globally (migration 0010). Enforced by unique indexes on `COALESCE(tenant_id, '__legacy_null__'), <col>`; the barcode index is partial `WHERE barcode IS NOT NULL`.
- **Why:** different shops must be able to reuse the same SKU/barcode/category name. Legacy NULL-tenant rows are grouped under the sentinel so they keep their own uniqueness.
- **How to apply / caveat:** under `STRICT_TENANT=false` a tenant can read legacy NULL rows, so SKU/barcode lookups can be ambiguous (tenant + legacy may both define the same SKU). Keep that mode brief.
