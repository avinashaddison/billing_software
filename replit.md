# Counter — Billing & Inventory (toy-mall)

## Overview
A multi-tenant billing and inventory web app for retail shops. It includes an Express API server, a Vite + React frontend (`toy-mall`), a marketing landing page, and a canvas/mockup sandbox. PostgreSQL (via Drizzle ORM) is the datastore. In production a single Express service serves both the `/api` routes and the compiled React SPA.

## Project Layout (pnpm monorepo)
- `artifacts/api-server` — Express 5 API (auth, tenants, billing, inventory). Serves the SPA in production.
- `artifacts/toy-mall` — Vite + React 19 frontend (the main app).
- `artifacts/landing-page` — Standalone marketing landing page.
- `artifacts/mockup-sandbox` — Component preview sandbox (canvas).
- `lib/db` — Drizzle schema + migrations.
- `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` — Shared API contract/client.
- `scripts` — Dev orchestrator and bootstrap/admin scripts.

## Development (Replit)
- Single workflow **Start application** runs `pnpm run dev`, which launches:
  - API server on port **8080** (localhost).
  - Web (Vite) on port **5000** (0.0.0.0, webview). Vite proxies `/api` → `localhost:8080`.
- The web dev port is controlled by `WEB_PORT` (defaults to 5000) in `scripts/src/dev.ts`.
- Vite is configured with `allowedHosts: true` and host `0.0.0.0` for the Replit iframe proxy.

## Database
- Uses `NEON_DATABASE_URL` when set (takes precedence), otherwise `DATABASE_URL`.
- **`NEON_DATABASE_URL` is set in Replit secrets → the app runs against the Neon production database (real shops, products, bills).** The Replit built-in DB (`DATABASE_URL`) also has a full schema copy from initial setup but is empty and unused while the Neon secret exists.
- After adding/changing secrets, restart the "Start application" workflow — the running process keeps its old environment until restarted. A secret change can also reboot the whole environment, in which case the per-artifact `API Server` workflow may grab port 8080 first (without the new secret) and `Start application` fails with EADDRINUSE: stop/kill that artifact process, then restart `Start application` and confirm the API process actually has the new variable.
- **Fresh DB setup (Replit):** `drizzle-kit push` requires a TTY and will fail in the shell. Instead, generate the base schema SQL and apply it directly:
  ```
  cd lib/db && npx drizzle-kit generate --config ./drizzle.config.ts --name init_schema
  psql $DATABASE_URL -f drizzle/0000_init_schema.sql
  ```
  Then restart the app — the boot migration runner applies all additive migrations (0001–0017) automatically.
- The API also runs idempotent boot migrations on startup.

## Production / Deployment
- Target: **autoscale**.
- Build: `pnpm run build:prod` (builds toy-mall, then api-server).
- Run: `NODE_ENV=production node artifacts/api-server/dist/index.mjs`.
- In production the API serves static SPA files from `artifacts/toy-mall/dist/public` with SPA fallback.
- Relevant env vars: `DATABASE_URL` (required), `SESSION_SECRET`, `PORT` (provided by platform), optional `CORS_ORIGIN`, `STRICT_TENANT`, Cloudinary and Telegram settings.
- `STRICT_TENANT` now defaults to **strict** tenant isolation (each shop sees only its own rows). Set `STRICT_TENANT=false` ONLY to temporarily re-expose legacy null-tenant rows to real tenants while backfilling a migration. The legacy null-tenant owner always sees its own (`tenant_id IS NULL`) data regardless of this flag.

## Backups (api-server `src/lib/backup*.ts`, `restore.ts`, `r2.ts`; admin UI `/admin → Backups`)
- Scheduler is a 60 s tick that claims calendar **slots** in the `backup_runs` ledger (`nightly:YYYY-MM-DD` at `backupHour`:30 IST, `intraday:YYYY-MM-DDTHH` every `intradayEveryHours`, both stored in `platform_settings.data`). Workspace and deployment share the Neon DB, so only one of them wins a slot; failed slots retry up to 3× (10 min apart), `running` rows older than 20 min are treated as dead. `backup_runs` is never included in snapshots or restores.
- Destinations: nightlies/manual → R2 (`backups/`, keep `R2_BACKUP_KEEP`, default 30) + Telegram when `TELEGRAM_BOT_TOKEN` is set; intraday → R2 only (`backups/intraday/`, 48 h). Set `BACKUP_ENCRYPTION_KEY` (≥12 chars, longer is better; **same value** in workspace and deployment secrets) to get AES-256-GCM `.json.gz.enc` files — a set-but-short key fails every backup on purpose; losing the key makes those files unrestorable.
- Watchdog: `GET /api/healthz/backup` is public — 200 `ok` while the newest success is within `thresholdMinutes` (intraday: every×2 h+30 min; nightly-only: 26 h), 503 `stale` otherwise (also when nothing has ever succeeded since the first attempt); Telegram stale/recovered alerts are deduped across processes via `platform_settings.data.backupStaleAlertedAt`. Point an external uptime monitor at that URL.
- Restore (platform admin only, `RESTORE` confirm): entire platform (TRUNCATE + reinsert) or **one shop** (`tenantId`, tables with `tenant_id` minus vendor-owned ones). Both lock the affected tables (`SHARE ROW EXCLUSIVE`, 20 s lock_timeout), take a safety backup **inside** that lock, and run as one transaction. Per-shop: legacy `tenant_id IS NULL` rows can still reference a shop's rows — those "pinned" rows are overwritten in place (`ON CONFLICT (pk) DO UPDATE … WHERE tenant_id = shop`) instead of deleted; the preview shows the count. Serial sequences are only ever moved forward.
- Rehearse before trusting: `pnpm --filter @workspace/api-server run drill:restore` (~4 min; scratch Postgres in `/tmp/pgdrill`, delete afterwards) proves plain, encrypted and per-shop restores against a copy of live data. Re-run it after any migration that adds a table, FK or identity column.

## Notes
- On first boot with an empty staff table, the API bootstraps a default Owner with PIN `1234` (logged as a warning). Change this PIN immediately in Staff Management on any real deployment.
- Tenant isolation: reads use `tenantWhere` (strict by default — see `STRICT_TENANT` above) and all mutations use `tenantWhereWrite` (always strict, never the NULL fallback). New shops created via the platform admin are fully isolated from each other and from the legacy null-tenant data.
- Stock Check sheet (`/suppliers/stock-check`) can be printed, shared (Web Share API, PDF file) or downloaded. The PDF is built client-side with `jspdf` + `jspdf-autotable` (`toy-mall/src/lib/stock-check-pdf.ts`, lazy-loaded); built-in fonts are WinAnsi-only, so non-Latin characters are replaced with "?".
- Staff permissions: **creating** a product (`POST /api/products`) is allowed with Write on **either** `products` or the dedicated `productEntry` key ("Product Entry" in the Staff Management dialog — a binary None/Allow permission, default `none`), via `requireAnyWrite("products","productEntry")`. `scan: write` does NOT create products. Editing, deleting and bulk import still need `products: write`. The SPA mirrors this in `useCanCreateProducts()` / `PRODUCT_CREATE_RESOURCES` (`toy-mall/src/lib/permissions.ts`) — keep the two lists identical. Staff who can create but cannot open Products get a "Product Entry" nav item to `/products/new` instead, and stay on the form after saving when they can open neither Products nor Entry Data.
- Staff permissions: **changing stock of an existing product** (`POST /api/products/:id/stock` — Entry Data page `/stock-entry`, the Scan page's "Stock IN" mode, Quick Adjust on the product page) needs the dedicated `stockEntry` key (labelled **"Entry Data"** in the Staff dialog — same name as the nav item; none/read/write). `read` = "Entry Data view": open the page, scan, see recent entries & batch history, hand unknown codes to Product Entry — no stock changes. `scan` ("Scan & Billing") is billing only: checkout, held bills, shared cart. `productEntry` never moves stock. Migration `0023` backfilled `stockEntry` from each staff's `scan` level, except staff holding `productEntry: write`, who got `none` (entry-only by design). The boot session probe (`SessionSync`) now re-syncs a signed-in staff's permission map from `/api/auth/me`, so grant changes and new keys apply on next app load without re-login. `POST /api/returns` (restocks + refunds) needs `scan: write` OR `billing: write` (it previously had no permission gate); the Bill page shows "Process Return / Refund" only for those.

## User preferences
(None recorded yet.)
