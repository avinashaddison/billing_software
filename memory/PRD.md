# Hira & Sons — Multi-Tenant Migration (PRD / Progress Tracker)

## Original problem statement (verbatim summary)

Migrate the existing Hira & Sons POS / inventory system (single-tenant) to a
multi-tenant SaaS architecture **without** destructive schema changes, while
preserving every existing workflow exactly as it works today.

Hard constraints (all honoured):

- Existing production DB/data must never be deleted, recreated, or reset.
- Legacy rows may use `tenant_id IS NULL` for backward compatibility.
- One shared database, multiple businesses/tenants, HttpOnly cookie session.
- staffId + PIN login must keep working unchanged.
- `STRICT_TENANT` must stay disabled until verification completes.
- Filter rule everywhere: `tenant_id = req.tenantId OR tenant_id IS NULL`.

## Architecture decisions (confirmed by user)

1. **`tenants` table**: `id text PK (slug), name, is_active bool, created_at`.
2. **Single-tenant staff**: each `staff_profiles` row belongs to exactly one
   tenant (`staff_profiles.tenant_id`).
3. **`SESSION_SECRET`** env signs HttpOnly tenant cookies (falls back to
   `LICENSE_SECRET`).
4. **Text-based tenant identifiers everywhere** (decided after live DB
   inspection revealed pre-existing `tenant_id text NULL` columns on 10/12
   priority tables — `uuid` would have forced a destructive `ALTER TYPE`).

## What's been implemented (Iteration 1 — 2026-01)

### Schema state — confirmed against live DB (Neon)

| Table | tenant_id column | Source | Row count |
|---|---|---|---|
| `tenants` | — (id text PK) | created by migration | 0 |
| `products` | `text NULL` | pre-existing | 126 |
| `bills` | `text NULL` | pre-existing | 11 |
| `sales` | `text NULL` | pre-existing | 44 |
| `sale_items` | `text NULL` | pre-existing | 15 |
| `stock_logs` | `text NULL` | pre-existing | 114 |
| `returns` | `text NULL` | pre-existing | 1 |
| `categories` | `text NULL` | pre-existing | 3 |
| `suppliers` | `text NULL` | pre-existing | 1 |
| `staff_profiles` | `text NULL` | pre-existing | 2 |
| `staff_permissions` | `text NULL` | **added by `0001_tenant_additive.sql`** | 13 |
| `license_status` | `text NULL` | **added by `0001_tenant_additive.sql`** | 1 |
| `store_settings` | `text NULL` | pre-existing | 1 |

- Every existing `tenant_id` value is `NULL` across all 326 data rows
  (verified via `SELECT DISTINCT tenant_id`).
- 13 btree indexes on `tenant_id` + 2 partial unique indexes
  (`store_settings_tenant_unique`, `license_status_tenant_unique`) created
  by the migration script. Indexes use `IF NOT EXISTS` so re-runs are
  no-ops.
- **Zero column types altered**, zero rows touched, zero existing
  constraints dropped.

### Drizzle schema realignment (`lib/db/src/schema/`)

- All `tenant_id` columns redeclared as `text` (was `uuid`) to match live DB
  byte-for-byte. No `pnpm db push` is required against this DB.
- New `tenants` table: `id text PK, name, is_active, created_at`.
- Singletons (`store_settings`, `license_status`) keep their `id integer PK
  DEFAULT 1` legacy column; per-tenant uniqueness enforced by partial unique
  indexes.

### Server runtime additions

- **`lib/tenant.ts`** — `tenantWhere(column, tenantId)` helper. Reads
  `STRICT_TENANT` env on every call so the flag flips at runtime without
  restart. tenantId type is `string | null | undefined`.
- **`middlewares/tenant.ts`** — signs/verifies the HttpOnly `tenant_session`
  cookie via HMAC (`SESSION_SECRET` → falls back to `LICENSE_SECRET`).
  Attaches `req.tenantId: string | null` and `req.staffId?: string` to
  every request.
- **`app.ts`** — added `cookie-parser`, CORS with `credentials: true`,
  mounted `tenantContext` before the API router.
- **Login (`routes/staff.ts`)** — issues the signed cookie based on
  `staff_profiles.tenant_id`. New endpoints: `POST /api/auth/logout`,
  `GET /api/auth/me`. Existing PIN flow, lockouts, and auto-bcrypt
  upgrade preserved 1:1.

### Tenant-aware route conversions

Every priority data route now filters reads via `tenantWhere(...)` and stamps
`tenant_id = req.tenantId` on inserts. Updates/deletes include the tenant
predicate in their WHERE so cross-tenant mutations are silently 404'd.

- `products.ts` — list, get-by-sku/id/scan, create, patch, delete, stock
  IN/OUT/ADJUSTMENT, next-sku, bulk-import, bulk-assign-supplier, QR.
- `bills.ts` — checkout (transactional + tenant-stamped
  stock_logs/sale_items/sales), list, detail.
- `sales.ts`, `stock-logs.ts`, `returns.ts`, `categories.ts`,
  `suppliers.ts`, `dashboard.ts`, `reports.ts`, `customers.ts`,
  `settings.ts`, `license.ts`, `staff.ts` — full tenant scoping.

### Non-DB tenant leaks closed

- **SSE (`lib/sse.ts`)** — `addClient(res, tenantId)` per connection;
  `broadcast(event, data, tenantId)` fans out to matching clients + legacy
  NULL clients while migration is in progress.
- **Shared cart (`lib/shared-cart.ts`)** — switched from a single in-memory
  array to `Map<tenantKey, cart>`. Each tenant gets its own cart bucket;
  legacy NULL cart still works for the existing Hira install.

## Verification status (this iteration)

| Check | Status |
|---|---|
| Read-only DB inventory (12 tables, 326 rows confirmed) | ✅ |
| Read-only DISTINCT inspection (every existing `tenant_id` is NULL) | ✅ |
| Hand-written additive SQL (`lib/db/migrations/0001_tenant_additive.sql`) | ✅ |
| Migration applied to live DB (idempotent, in transaction) | ✅ |
| Post-migration verification — `tenants` table + 2 missing cols + 15 indexes | ✅ |
| Re-inventory — all 326 original rows preserved | ✅ |
| `pnpm typecheck:libs` | ✅ |
| `pnpm --filter @workspace/api-server run typecheck` | ✅ |
| `pnpm --filter @workspace/api-server run build` | ✅ |
| Runtime smoke test — tenantId=null sees all 326 legacy rows | ✅ |
| Runtime smoke test — new tenant + STRICT_TENANT=off sees all 326 (OR-IS-NULL) | ✅ |
| Runtime smoke test — new tenant + STRICT_TENANT=on sees 0 (legacy hidden) | ✅ |
| API smoke test — login + wrong-PIN + /auth/me + logout (cookie flow) | ✅ |
| Test side effects rolled back (failed_attempts reset to 0) | ✅ |
| `STRICT_TENANT=true` enablement | 🔴 Deferred until backfill verified |

### Pre-existing typecheck issue (not caused by this migration)

`artifacts/toy-mall/src/pages/Labels.tsx:68 & :409` references
`lowStockThreshold` on `LabelProduct`. Unrelated to tenant work — no
frontend files were touched.

## Files added / changed

### New files
- `lib/db/src/schema/tenants.ts`
- `lib/db/migrations/0001_tenant_additive.sql`
- `artifacts/api-server/src/lib/tenant.ts`
- `artifacts/api-server/src/middlewares/tenant.ts`
- `scripts/src/tenant-migration-inventory.mjs` (read-only audit)
- `scripts/src/tenant-distinct.mjs` (read-only data audit)
- `scripts/src/tenant-migrate-apply.mjs` (apply additive SQL)
- `scripts/src/tenant-runtime-smoke.mjs` (SQL-level smoke test)

### Edited files
- `lib/db/src/schema/{products,bills,sales,sale_items,stock_logs,returns,categories,suppliers,staff,store_settings,license_status,index}.ts`
- `artifacts/api-server/src/{app.ts,lib/sse.ts,lib/shared-cart.ts,lib/license.ts}`
- `artifacts/api-server/src/routes/{staff,products,bills,sales,stock-logs,returns,categories,suppliers,dashboard,reports,customers,settings,license,shared-cart,events}.ts`

## Compatibility guarantees (verified, not asserted)

- `STRICT_TENANT` disabled by default → every existing Hira & Sons row
  (`tenant_id IS NULL`) remains visible to authenticated users.
- `bootstrapDefaultOwner` continues to seed `tenant_id = NULL` on empty
  installs.
- Login does NOT pre-filter by tenant (staffId is the routing key) so
  legacy staff log in unchanged.
- Singletons keep their `id = 1` legacy row; per-tenant rows allocate
  fresh ids via `MAX(id)+1`.

## Operating instructions (post-deploy)

1. Set `SESSION_SECRET` env (any 32+ char random string). Optional — falls
   back to `LICENSE_SECRET`.
2. No `pnpm db push` is needed against this DB — schema is already aligned.
   For other installs, run `node scripts/src/tenant-migrate-apply.mjs` with
   `DATABASE_URL` set (idempotent, transactional).
3. Hira & Sons workflows continue working immediately because every
   existing row has `tenant_id IS NULL` and the OR-IS-NULL fallback
   matches them.
4. Onboard new tenants by inserting `tenants` rows + creating staff with
   their `tenant_id` set:
   ```sql
   INSERT INTO tenants (id, name) VALUES ('acme-mart', 'Acme Mart');
   INSERT INTO staff_profiles (name, pin, role, tenant_id)
     VALUES ('Acme Owner', '<bcrypt-hash>', 'owner', 'acme-mart');
   ```
5. Once new-tenant data is verified isolated, optionally backfill legacy
   rows:
   ```sql
   INSERT INTO tenants (id, name) VALUES ('hira-sons', 'Hira & Sons Gift Shop');
   UPDATE products          SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
   UPDATE bills             SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
   -- repeat for: sales, sale_items, stock_logs, returns, categories,
   -- suppliers, staff_profiles, staff_permissions, license_status,
   -- store_settings
   ```
   Then flip `STRICT_TENANT=true` (env) and restart.

## Known limitations (deliberate, documented)

- `products.sku` retains its global UNIQUE — two tenants cannot share an
  SKU. Future migration may swap for `(tenant_id, sku)` partial unique
  once STRICT_TENANT is on.
- `products.barcode` and `categories.name` — same caveat.
- `bills.bill_number` SERIAL — globally monotonic; new tenants will see
  gaps. Acceptable for now.
- `bills.customer_name` exists on the live DB but is not in the Drizzle
  schema. Pre-existing drift, untouched.

## Backlog (P1)

- Lift global UNIQUE constraints on `products.sku`, `products.barcode`,
  `categories.name` to `(tenant_id, …)` partial uniques (requires a
  destructive ALTER — postponed until STRICT_TENANT is on and a
  maintenance window is scheduled).
- Frontend: switch fetch/axios to `credentials: "include"` so the cookie
  routes the tenant on every request instead of relying on localStorage
  staffId echo.
- Tenants admin UI (currently tenants must be inserted via SQL).

## Backlog (P2)

- Per-tenant bill numbering.
- Per-tenant Telegram / Cloudinary credentials.
- Per-tenant daily-report scheduler.
- Audit log of cross-tenant request attempts once STRICT_TENANT is on.
