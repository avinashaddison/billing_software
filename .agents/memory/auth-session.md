---
name: Auth & session model (toy-mall api-server)
description: How login, tenant resolution, and session revocation work — and the multi-tenant pitfalls fixed for the public launch.
---

# Auth & session model

Tenant identity lives in a signed (HMAC-SHA256) `tenant_session` cookie, NOT in any
client-supplied header/subdomain. `tenantContext` (middlewares/tenant.ts) verifies the
HMAC and sets `req.tenantId / staffId / userId / authKind`. Two login flows write the
same cookie shape: PIN login (staff_profiles, `kind:"pin"`) and email login
(auth_users, `kind:"email"`). `requireAuth` is mounted globally before all tenant data
routers; only PUBLIC_PATHS (login/logout/me/health) are open.

## Pitfalls fixed (matter only once MANY shops exist)

- **Email is unique PER tenant, not globally** — the DB index is `auth_users_email_per_tenant`.
  So `select ... where email = ?` can return MULTIPLE rows. Login MUST bcrypt-compare the
  password against EVERY matching row and keep the one that verifies; picking `matches[0]`
  routes a valid login to the wrong shop or rejects it outright.
  **Why:** the looked-up row's `tenantId` becomes the session tenant, so the wrong row = wrong shop.
  **How to apply:** keep one bcrypt compare for the zero-match case (anti email-enumeration timing);
  loop for the multi-match case. Residual known edge (not fixed): same email AND identical password
  in two tenants stays ambiguous → would need a tenant/shop selector in the login UI.

- **SESSION_SECRET must fail-fast in production** — `loadSecret()` previously fell back to a
  hardcoded string visible in (public) source. With that fallback, anyone could forge a cookie
  for any `tenantId` = full impersonation. Now: throw at module load if `NODE_ENV==="production"`
  and the secret is blank; dev keeps the fallback. The secret IS set in prod today; this guards
  against future misconfig. (Build runs without NODE_ENV=production, so the build won't throw.)

- **Signature validity ≠ still-authorized** — the cookie's `maxAge` is **1 year**. `requireAuth`
  must re-check `isActive` from the DB on every request (one PK lookup), or a disabled staff
  member (fired cashier) keeps full API access for up to a year via the raw API even though the
  SPA logs them out via `/auth/me`. `requireAdmin` already did this for privileged routes; it now
  also applies to all data routes. Note `tenantActiveGate` (routes/index.ts) separately re-checks
  the TENANT's `is_active`/`expiresAt` live, so a suspended SHOP is cut off immediately.

## New-shop onboarding
Platform admin (`routes/platform.ts`) creates the tenant + an email owner (admin-set password)
+ a staff "Owner" with a constant default PIN. Owner signs in with email+password first (that
establishes the tenant), then enters the PIN. The default PIN is the same for every new shop and
is meant to be changed in Staff Management — acceptable because the PIN is a second step inside an
already-authenticated tenant session, not a primary credential.
