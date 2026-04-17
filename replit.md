# Toy Mall Inventory Management

## Overview

Mobile-first inventory management web app for a toy mall. Ultra-fast QR-based stock system — scan → IN/OUT in under 5 seconds. Built with React + Vite frontend, Express backend, PostgreSQL (Drizzle ORM), and contract-first OpenAPI codegen.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/toy-mall), Tailwind CSS, shadcn/ui, wouter routing, Recharts
- **Backend**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec at lib/api-spec/openapi.yaml)
- **QR Scanner**: html5-qrcode
- **State**: Zustand persist (auth: `toy-mall-auth-v2` — stores staffId, staffName, role, permissions)
- **Build**: esbuild (CJS bundle)
- **Real-time**: SSE (Server-Sent Events) for live dashboard updates

## Application Structure

### Frontend Pages (artifacts/toy-mall/src/pages/)
- **Dashboard** (/) — Stats, 7-day revenue chart, quick-nav tiles, low stock alerts, category breakdown. LIVE SSE badge.
- **Products** (/products) — Searchable product list with bulk CSV import modal (Admin)
- **Create Product** (/products/new) — Form with category auto-SKU generation, image URL input, loads categories from API
- **Categories** (/categories) — Full CRUD for toy categories: emoji, SKU prefix, product count per category
- **Product Detail** (/product?sku=SKU) — Stock IN/OUT with optimistic UI, QR code, imageUrl field
- **Scan** (/scan) — Full-screen camera QR scanner + USB/manual fallback. Keyboard shortcuts: B=billing, S=stock-in, Enter=checkout, Esc=close modal, Ctrl+K=toggle mode
- **Logs** (/logs) — Paginated stock activity logs with type filter
- **Login** (/login) — Staff selection + 4-digit PIN login. Auto-redirects here if not authenticated
- **Profile** (/profile) — Logged-in user info, Sign Out, Staff Management link (owner only)
- **Staff Management** (/staff) — Owner-only: create/edit/deactivate staff, configure per-page permissions (None/Read/Write per resource)
- **Billing** (/billing) — Recent bills list
- **Bill Detail** (/bill/:id) — Receipt view with print + Return/Refund flow
- **Suppliers** (/suppliers) — Full CRUD for vendor management (Admin-gated)
- **Customers** (/customers) — Customer CRM: purchase history by phone number
- **Reports** (/report) — Revenue trend chart (7/14/30d), EOD daily report with cash/UPI split, top products
- **Labels** (/labels) — QR shelf label printer: select products, generate + print 3-column label sheet

### Database Schema (lib/db/src/schema/)
- **products** — id, name, sku, category, price, stock, low_stock_threshold, image_url, supplier_id, created_at
- **stock_logs** — id, product_id (fk), type (IN/OUT/ADJUSTMENT), quantity, user_id, created_at
- **sales** — id, product_id (fk), quantity, total_price, created_at
- **bills** — id, total_amount, items_count, payment_mode, customer_phone, created_at
- **bill_items** — id, bill_id (fk), product_id (fk), product_name, product_sku, quantity, price, subtotal
- **suppliers** — id, name, contact, email, phone, address, notes, created_at
- **returns** — id, bill_id (fk), reason, total_refund, created_at + return_items sub-records
- **staff_profiles** — id, name, pin (4-digit plain), role (owner|staff), is_active, created_at
- **staff_permissions** — id, staff_id (fk), resource, level (none|read|write) — unique per staff+resource

### API Routes (artifacts/api-server/src/routes/)
- `products.ts` — CRUD + stock update + QR code + bulk-import + imageUrl/supplierId PATCH
- `stock-logs.ts` — Stock log history
- `sales.ts` — Sales records
- `dashboard.ts` — Summary stats, low stock, today activity, category breakdown
- `bills.ts` — Checkout, bill list, bill detail
- `suppliers.ts` — CRUD supplier management
- `returns.ts` — Process return (auto-restocks, SSE broadcast)
- `customers.ts` — Customer list + bill history by phone
- `reports.ts` — Revenue trend + end-of-day summary
- `events.ts` — SSE real-time event broadcast
- `staff.ts` — Staff CRUD + `POST /api/auth/login` (PIN validation) + permissions GET/PUT

## Role Management & Auth
- Owner account seeded in DB (name="Owner", PIN="1234", role="owner") — change via Staff Management
- Staff log in by selecting their name then entering their 4-digit PIN
- Owners always have "write" access to everything; staff permissions are per-resource in DB
- Resources: dashboard, products, scan, billing, logs, reports, customers, categories, labels, suppliers, staff
- Access levels: none (hidden), read (view only), write (full CRUD)
- Route guards: accessing any page without auth → redirect to /login; access denied → "Access Restricted" screen
- Nav (sidebar + bottom) filters items by current user's permissions

## Key Business Rules
- OUT does NOT allow stock < 0 → returns 400 "Insufficient stock"
- Every OUT creates a sale record automatically
- No delete on logs — use ADJUSTMENT type instead
- QR codes encode `/product?sku=SKU_HERE`
- Returns auto-restock the selected item quantities
- Bulk CSV import matches by SKU only — unknown SKUs are skipped
- SSE broadcasts: `stock_updated`, `bill_created`, `product_updated` events

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/toy-mall run dev` — run frontend locally

## Preview

The app is available at the root preview path `/`. The API server runs on port 8080 internally.
