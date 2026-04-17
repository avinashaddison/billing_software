# Toy Mall Inventory Management

## Overview

Mobile-first inventory management web app for a toy mall. Ultra-fast QR-based stock system — scan → IN/OUT in under 5 seconds. Built with React + Vite frontend, Express backend, PostgreSQL (Drizzle ORM), and contract-first OpenAPI codegen.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/toy-mall), Tailwind CSS, shadcn/ui, wouter routing
- **Backend**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at lib/api-spec/openapi.yaml)
- **QR Scanner**: html5-qrcode
- **State**: Zustand (role/auth state)
- **Build**: esbuild (CJS bundle)

## Application Structure

### Frontend Pages (artifacts/toy-mall/src/pages/)
- **Dashboard** (/) — Stats: total products, stock value, low stock count, today IN/OUT. Low stock alerts, category breakdown.
- **Products** (/products) — Searchable/filterable product list
- **Create Product** (/products/new) — Form to add new products
- **Product Detail** (/product?sku=SKU) — Stock IN/OUT with optimistic UI, QR code
- **Scan** (/scan) — Full-screen camera QR scanner + USB/manual fallback
- **Logs** (/logs) — Paginated stock activity logs with type filter
- **Profile** (/profile) — Role switcher (Admin/Staff)

### Database Schema (lib/db/src/schema/)
- **products** — id (uuid), name, sku (unique, indexed), category, price, stock, low_stock_threshold, created_at
- **stock_logs** — id, product_id (fk), type (IN/OUT/ADJUSTMENT), quantity, user_id, created_at
- **sales** — id, product_id (fk), quantity, total_price, created_at

### API Routes (artifacts/api-server/src/routes/)
- `products.ts` — CRUD + stock update + QR code generation
- `stock-logs.ts` — Stock log history
- `sales.ts` — Sales records
- `dashboard.ts` — Summary stats, low stock, today activity, category breakdown

## Key Business Rules
- OUT does NOT allow stock < 0 → returns 400 "Insufficient stock"
- Every OUT creates a sale record automatically
- No delete on logs — use ADJUSTMENT type instead
- QR codes encode `/product?sku=SKU_HERE`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/toy-mall run dev` — run frontend locally

## Preview

- Frontend: http://localhost:80/ (preview path: /)
- API: http://localhost:80/api/ (preview path: /api)
