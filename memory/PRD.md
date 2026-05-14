# Hira & Sons — Multi-Tenant Migration (PRD / Progress Tracker)

## Original problem statement (verbatim summary)

Migrate the existing Hira & Sons POS / inventory system (single-tenant) to a
multi-tenant SaaS architecture **without** destructive schema changes, while
preserving every existing workflow exactly as it works today.

Hard constraints:

- Existing production DB/data must never be deleted, recreated, or reset.
- Legacy rows may use `tenant_id IS NULL` for backward compatibility.
- One shared database, multiple businesses/tenants, HttpOnly cookie session.
- staffId + PIN login must keep working unchanged.
- `STRICT_TENANT` must stay disabled until verification completes.
- Filter rule everywhere: `tenant_id = req.tenantId OR tenant_id IS NULL`.

## Architecture decisions confirmed by the user

1. **`tenants` table**: `id uuid PK, slug text UNIQUE, name text, is_active bool, created_at`.
2. **Single-tenant staff**: each `staff_profiles` row belongs to exactly one tenant
   (`staff_profiles.tenant_id`).
3. **Session cookie signed via `SESSION_SECRET`** (falls back to `LICENSE_SECRET`
   if unset, keeping existing single-tenant installs bootable).

## What's been implemented (Iteration 1 — 2026-01)

### Schema additions (Drizzle, all non-destructive, nullable)

- **NEW table**: `tenants` (`lib/db/src/schema/tenants.ts`).
- **`tenant_id uuid NULL` + index** added to: `products`, `bills`, `sales`,
  `sale_items`, `stock_logs`, `returns`, `categories`, `suppliers`,
  `staff_profiles`, `staff_permissions`, `store_settings`, `license_status`.
- **Partial unique indexes** on `store_settings.tenant_id` and
  `license_status.tenant_id` (`WHERE tenant_id IS NOT NULL`) so each tenant
  gets exactly one settings/license row while the legacy `id=1, tenant_id IS NULL`
  singleton row remains untouched.
- No columns dropped, no PKs altered, no NOT-NULL added → safe to apply via
  `pnpm --filter @workspace/db run push` against the live DB.

### Server runtime additions

- **`lib/tenant.ts`** — `tenantWhere(column, tenantId)` helper. Implements the
  migration filter rule `tenant_id = :tenantId OR tenant_id IS NULL`. Reads
  `STRICT_TENANT` env on every call so the flag can be flipped without
  restart once verification completes.
- **`middlewares/tenant.ts`** — signs/verifies the HttpOnly `tenant_session`
  cookie (HMAC via `SESSION_SECRET`, falls back to `LICENSE_SECRET`). Attaches
  `req.tenantId` and `req.staffId` to every request. Cookie payload:
  `{ t: tenantId|null, s: staffId|null, iat }`.
- **`app.ts`** — added `cookie-parser`, switched CORS to
  `credentials: true` with `CORS_ORIGIN` allowlist, mounted `tenantContext`
  middleware before the API router.
- **Login (`routes/staff.ts`)** — `POST /api/auth/login` now issues the signed
  cookie based on `staff_profiles.tenant_id` and includes `tenantId` in the
  JSON response. Existing PIN flow, lockouts, and auto-bcrypt-upgrade
  preserved 1:1. New endpoints: `POST /api/auth/logout`, `GET /api/auth/me`.

### Tenant-aware route conversions

Every priority data route now filters reads via `tenantWhere(...)` and stamps
`tenant_id = req.tenantId` on inserts. Cross-tenant deletes/updates are
blocked because the WHERE clause includes the tenant predicate.

- `products.ts` — list, get-by-sku/id/scan, create, patch, delete, stock
  IN/OUT/ADJUSTMENT, next-sku, bulk-import, bulk-assign-supplier, QR.
- `bills.ts` — checkout (transactional + tenant-stamped stock_logs/sale_items/sales),
  list, detail.
- `sales.ts` — list.
- `stock-logs.ts` — list.
- `returns.ts` — list + create (validates bill ownership before refund).
- `categories.ts` — CRUD.
- `suppliers.ts` — CRUD.
- `dashboard.ts` — summary, low-stock, today-activity, categories.
- `reports.ts` — revenue trend, end-of-day (joined queries scoped through the
  bills tenant_id).
- `customers.ts` — list + detail-by-phone (bills filtered, joined items
  inherit the tenant scope through `billIds`).
- `settings.ts` — replaced hard-coded `id = 1` singleton with per-tenant
  upsert keyed on `tenant_id` (NULL row stays valid for legacy install).
- `lib/license.ts` + `routes/license.ts` — license status, activate,
  refresh, remove are now keyed by `req.tenantId` with a per-tenant cache.
  Trial tracking, validity caching, and the license gate middleware all
  preserve the legacy NULL row for the Hira & Sons install.
- `staff.ts` — staff list/CRUD/permissions now tenant-scoped; permissions
  writes verify the staff row's tenant before mutating.

### Non-DB tenant leaks closed

- **SSE (`lib/sse.ts`)** — `addClient(res, tenantId)` records the tenant per
  connection; `broadcast(event, data, tenantId)` fans out only to matching
  clients (plus legacy NULL clients during migration). Backwards-compatible
  global broadcast preserved for background jobs by omitting tenantId.
- **Shared cart (`lib/shared-cart.ts`)** — switched from a single in-memory
  array to `Map<tenantKey, cart>`. Each tenant gets its own cart bucket;
  legacy NULL cart still works for the existing Hira install.

### Compatibility shims (deliberate)

- Login does **not** pre-filter by `req.tenantId`. The staffId is the routing
  key; on success the response sets the cookie that establishes the tenant
  for every subsequent request. This is the only safe way to support the
  existing staffId+PIN frontend flow without breaking it.
- `bootstrapDefaultOwner` (untouched) inserts the default Owner with
  `tenant_id = NULL`, which keeps the legacy Hira & Sons login flow working
  on a brand-new install exactly as before.
- Bills/sale_items/stock_logs/returns inherit `tenant_id` from the parent
  product/bill row so legacy NULL data continues to write NULL on follow-up
  events (no "half null, half non-null" rows during migration).

## Verification status

| Stage | Status |
|---|---|
| `lib/db` schema typecheck (`pnpm typecheck:libs`) | ✅ PASS |
| `@workspace/api-server` typecheck | ✅ PASS |
| `@workspace/api-server` esbuild bundle (`pnpm --filter @workspace/api-server run build`) | ✅ PASS (dist/index.mjs 3.4 MB) |
| `pnpm --filter @workspace/db run push` against live DB | ⏳ Pending deploy — adds new columns + indexes only |
| Runtime smoke test against live DB | ⏳ Pending deploy (no DATABASE_URL in source env) |
| `STRICT_TENANT=true` enablement | 🔴 Held until backfill + verification complete |

### Pre-existing typecheck failure (not caused by this migration)

`artifacts/toy-mall/src/pages/Labels.tsx:68 & :409` references `lowStockThreshold`
on a `LabelProduct` type that doesn't declare it. **No frontend files were
touched in this migration.** This is unrelated to tenant work and should be
fixed separately. The backend (api-server) compiles cleanly.

## Required deploy steps (in order, after this code lands)

1. Ensure env has `SESSION_SECRET` set (any 32+ char random string). Optional
   — the code falls back to `LICENSE_SECRET` so existing installs still work.
2. Run `pnpm --filter @workspace/db run push` (already invoked by
   `routes/updates.ts` during the in-app update flow) — applies the
   additive schema changes to the live DB.
3. Restart the server. Hira & Sons workflows continue working immediately
   because every existing row has `tenant_id IS NULL` and `STRICT_TENANT` is
   off, so the OR-IS-NULL fallback matches them.
4. Onboard new tenants by inserting `tenants` rows and creating staff
   members with their `tenant_id` set.
5. After all new tenant data is verified isolated, optionally backfill
   legacy rows to the Hira tenant id and flip `STRICT_TENANT=true`.

## Known limitations (deliberate, documented)

- `products.sku` retains its global UNIQUE constraint — two tenants cannot
  use the same SKU during the migration window. Future migration may swap
  for `(tenant_id, sku)` partial unique once STRICT_TENANT lands.
- `categories.name` retains its global UNIQUE constraint — same caveat.
- `products.barcode` UNIQUE — same caveat.
- `bills.bill_number` SERIAL — still globally monotonic. New tenants will
  see gaps in their bill numbers. Acceptable for now; revisit if customers
  require per-tenant bill numbering.

## Backlog (P1)

- Lift the three global UNIQUE constraints above to `(tenant_id, …)` partial
  uniques (requires a destructive ALTER — postponed until STRICT_TENANT is
  on and a maintenance window is scheduled).
- Frontend: switch axios/fetch to `credentials: "include"` and rely on the
  `tenant_session` cookie for tenant routing (currently it just reads
  localStorage and re-sends staffId — that still works during migration
  because the cookie is set on login).
- Per-tenant bill numbering (only if customers ask).
- Move `shared-cart` from in-memory to DB if multi-process / horizontal
  scaling is needed.
- Add a `tenants` admin UI (currently tenants must be inserted via SQL).

## Backlog (P2)

- Audit log of cross-tenant request attempts once STRICT_TENANT is on.
- Per-tenant Telegram / Cloudinary credentials (today they're install-wide
  env vars).
- Per-tenant daily-report scheduler.
