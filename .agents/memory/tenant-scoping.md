---
name: Tenant scoping helpers (toy-mall api-server)
description: How reads vs mutations must scope by tenant, and the audit pitfall when verifying it.
---

# Tenant scoping: reads vs mutations

`artifacts/api-server/src/lib/tenant.ts` exposes two helpers:

- `tenantWhere(col, tenantId)` — for **reads**. Strict by **default** now (`strictTenantEnabled()` returns `STRICT_TENANT !== "false"`): a real tenant matches `tenant_id = :id` only. Set `STRICT_TENANT=false` to opt back into the legacy fallback (`tenant_id = :id OR tenant_id IS NULL`) during a migration. `tenantId == null` → `IS NULL`, returned BEFORE the strict check (short-circuit), so the legacy null-tenant owner is never affected by the flag.
- `tenantWhereWrite(col, tenantId)` — for **mutations** (UPDATE/DELETE and the lookups that gate them). NEVER includes the NULL fallback for a real tenant (`eq` only), regardless of `STRICT_TENANT`. `tenantId == null` → `IS NULL` (so the legacy null-tenant PIN owner can still edit its own legacy rows).

**Why:** A real tenant must not see or write another tenant's rows. The read default was flipped from migration-fallback to strict because the NULL fallback leaked legacy null-tenant rows into every real shop — symptom: a brand-new shop "already shows products" (the legacy NULL products) and bills/customers created under the NULL account appeared under other accounts. Strict reads + the null short-circuit fix this while keeping the legacy owner's data fully visible to itself. The same flag also scopes `sse.ts` broadcast fan-out, so realtime stays consistent with reads.
**How to apply (prod):** the fix is code-default, so it ships on the next publish; do NOT set `STRICT_TENANT=false` in production or the leak returns.

**How to apply:** Every `.update()`/`.delete()` and every pre-check SELECT that gates one must use `tenantWhereWrite`. Plain SELECTs for display keep `tenantWhere`. The legacy owner logs in via PIN with `tenantId=null`, `staffId` set, role "owner" — both helpers map null→`isNull`, so they are never locked out.

## Audit pitfall (important)
Grepping for `tenantWhere(` to verify mutation safety will **miss** mutations that have NO tenant clause at all — e.g. an UPDATE scoped only by `eq(id)` whose IDs came from a tenant-scoped read. That pattern still leaks writes to legacy NULL rows because the read helper includes them. When auditing, also scan every `.update(`/`.delete(` and confirm a `tenantWhereWrite` is present in its WHERE, not just that no bare `tenantWhere` remains. (This is how the `POST /products/sale-price-recovery/apply` leak was found.)

## requireAdmin and the legacy owner
`requireAdmin` (middlewares/auth.ts) admits owner/admin email users AND `staff_profiles` rows with role `owner` — including the legacy null-tenant PIN owner. Don't gate staff-management mutations in a way that excludes the PIN-owner path.
