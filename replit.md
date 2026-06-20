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
- Uses `DATABASE_URL` (or `NEON_DATABASE_URL`). Already provisioned in Replit.
- Push schema: `pnpm --filter @workspace/db run push`.
- The API also runs idempotent boot migrations on startup.

## Production / Deployment
- Target: **autoscale**.
- Build: `pnpm run build:prod` (builds toy-mall, then api-server).
- Run: `NODE_ENV=production node artifacts/api-server/dist/index.mjs`.
- In production the API serves static SPA files from `artifacts/toy-mall/dist/public` with SPA fallback.
- Relevant env vars: `DATABASE_URL` (required), `SESSION_SECRET`, `PORT` (provided by platform), optional `CORS_ORIGIN`, `STRICT_TENANT`, Cloudinary and Telegram settings.

## Notes
- On first boot with an empty staff table, the API bootstraps a default Owner with PIN `1234` (logged as a warning). Change this PIN immediately in Staff Management on any real deployment.

## User preferences
(None recorded yet.)
