---
name: DB migrations, tenancy & which database the app really uses
description: How schema changes are applied (idempotent boot SQL), the NEON-vs-heliumdb gotcha, and the per-tenant uniqueness model.
---

# Which DB the app actually uses
- At runtime the app connects to `NEON_DATABASE_URL ?? DATABASE_URL` (lib/db/src/index.ts). On Replit, `NEON_DATABASE_URL` is set, so the app **and its boot migrations hit NEON**.
- The code-execution `executeSql` callback / Replit built-in DB talk to a **separate** `heliumdb` (`DATABASE_URL`). Introspecting via executeSql does **not** reflect the app's real (NEON) schema — it can show stale/old constraints.
- **How to verify a schema change actually landed:** restart "Start application" and read the boot log — each migration logs `migration applied (or already up-to-date)`; a bad migration throws and crashes boot. Don't trust executeSql introspection for the app DB.

# Migration convention
- Schema changes = hand-written **idempotent** raw SQL in `lib/db/migrations/NNNN_*.sql`, registered in the `MIGRATION_FILES` array in `artifacts/api-server/src/lib/migrate.ts`, applied on every boot. Never `drizzle-kit push` / `generate`.
- **Why idempotent is load-bearing:** Render free-tier cold-starts re-run all migrations on every spin-up. A non-idempotent migration (the removed `0005`) once nulled sale prices on every restart. Use `IF NOT EXISTS` / `DROP ... IF EXISTS` / guarded `DO $$` blocks everywhere.
- The Drizzle schema files (lib/db/src/schema) are for **types only** here; they can lag the raw SQL. Keep them roughly in sync for readability, but the SQL migration is the source of truth (e.g. expression/partial unique indexes are only in the SQL).

# Per-tenant uniqueness (decision)
- `products.sku` / `products.barcode` and `categories.name` are unique **per tenant**, not globally (migration 0010). Enforced by unique indexes on `COALESCE(tenant_id, '__legacy_null__'), <col>`; the barcode index is partial `WHERE barcode IS NOT NULL`.
- **Why:** different shops must be able to reuse the same SKU/barcode/category name. Legacy NULL-tenant rows are grouped under the sentinel so they keep their own uniqueness.
- **How to apply / caveat:** under `STRICT_TENANT=false` a tenant can read legacy NULL rows, so SKU/barcode lookups can be ambiguous (tenant + legacy may both define the same SKU). Keep that mode brief.
