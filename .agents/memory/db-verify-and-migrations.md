---
name: DB verification target & schema-change workflow (api-server)
description: Which DB the app really uses in this repl, and why schema changes must go through boot migrations, never drizzle push.
---

# Verify against NEON_DATABASE_URL, and change schema via boot migrations

## The running app uses `NEON_DATABASE_URL`, not `DATABASE_URL`
The db client picks `process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL`. In this repl `DATABASE_URL` points to a *local* Replit Postgres (`helium/heliumdb`) that the app does NOT use, while `NEON_DATABASE_URL` is the real (shared with prod) Neon DB.

**Why:** `psql "$DATABASE_URL"` shows confusingly different/empty results than what the app reads — boot migrations apply to Neon, but a `$DATABASE_URL` query won't see them.
**How to apply:** When verifying tables/rows the app actually uses, query `psql "$NEON_DATABASE_URL"`. Treat it as potentially production data — prefer read-only checks, don't insert test rows.

## Never use `pnpm --filter @workspace/db run push` here
`drizzle-kit push` is interactive and, with this schema, **misread a brand-new table (`supplier_payments`) as a RENAME of an unrelated existing table (`license_status`)** — answering wrong (or a non-TTY auto-answer) would drop/rename a live table. There are also DB tables not present in the Drizzle schema (e.g. `license_status`) that push wants to "reconcile".

**Why:** zero-data-loss constraint; push proposes destructive ops and is not safe to run non-interactively.
**How to apply:** Add schema as an idempotent SQL file in `lib/db/migrations/NNNN_*.sql` (use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), register the filename in `MIGRATION_FILES` in `artifacts/api-server/src/lib/migrate.ts`, then restart the app — boot runs them. The build auto-copies `lib/db/migrations` → `dist/migrations`, so the same files self-apply on Render. Still add the Drizzle schema file + index export for type-safety, just don't `push`.
