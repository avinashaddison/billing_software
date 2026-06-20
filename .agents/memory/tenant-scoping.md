---
name: Tenant scoping helpers (toy-mall api-server)
description: How reads vs mutations must scope by tenant, and the audit pitfall when verifying it.
---

# Tenant scoping: reads vs mutations

`artifacts/api-server/src/lib/tenant.ts` exposes two helpers:

- `tenantWhere(col, tenantId)` — for **reads**. In migration mode (`STRICT_TENANT` unset/false) a real tenant matches `tenant_id = :id OR tenant_id IS NULL`, so legacy null-tenant rows stay visible. `tenantId == null` → `IS NULL`.
- `tenantWhereWrite(col, tenantId)` — for **mutations** (UPDATE/DELETE and the lookups that gate them). NEVER includes the NULL fallback for a real tenant (`eq` only), regardless of `STRICT_TENANT`. `tenantId == null` → `IS NULL` (so the legacy null-tenant PIN owner can still edit its own legacy rows).

**Why:** A real tenant must not be able to UPDATE/DELETE legacy null-tenant rows or another tenant's rows (cross-tenant write leakage). Reads intentionally keep the NULL fallback during the migration window so legacy data stays visible.

**How to apply:** Every `.update()`/`.delete()` and every pre-check SELECT that gates one must use `tenantWhereWrite`. Plain SELECTs for display keep `tenantWhere`. The legacy owner logs in via PIN with `tenantId=null`, `staffId` set, role "owner" — both helpers map null→`isNull`, so they are never locked out.

## Audit pitfall (important)
Grepping for `tenantWhere(` to verify mutation safety will **miss** mutations that have NO tenant clause at all — e.g. an UPDATE scoped only by `eq(id)` whose IDs came from a tenant-scoped read. That pattern still leaks writes to legacy NULL rows because the read helper includes them. When auditing, also scan every `.update(`/`.delete(` and confirm a `tenantWhereWrite` is present in its WHERE, not just that no bare `tenantWhere` remains. (This is how the `POST /products/sale-price-recovery/apply` leak was found.)

## requireAdmin and the legacy owner
`requireAdmin` (middlewares/auth.ts) admits owner/admin email users AND `staff_profiles` rows with role `owner` — including the legacy null-tenant PIN owner. Don't gate staff-management mutations in a way that excludes the PIN-owner path.
