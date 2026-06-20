# Memory Index

- [Tenant scoping helpers](tenant-scoping.md) — reads use `tenantWhere` (incl. legacy NULL); mutations use `tenantWhereWrite` (strict). Auditing by grepping the helper name MISSES unscoped UPDATE/DELETE.
- [Express req.params widening](express-req-params.md) — middleware before a handler widens `req.params.x` to `string|string[]`; convention is `String(req.params.x)`.
- [Auth & session model](auth-session.md) — tenant identity is in a signed cookie; email is unique PER-tenant (match password across all rows); SESSION_SECRET fail-fast in prod; 1yr cookie ⇒ requireAuth must recheck isActive.
- [SSE tenant fan-out](sse-tenant-fanout.md) — broadcast() fan-out is flag-gated; migration mode leaks ephemeral per-shop events (live cart) across shops. Pass forceStrict=true for per-shop realtime events.
- [DB verify & migrations](db-verify-and-migrations.md) — app uses NEON_DATABASE_URL (not DATABASE_URL=local helium); NEVER `drizzle push` (proposes destructive renames) — add idempotent SQL to migrate.ts MIGRATION_FILES.
- [SPA white-page on 401](spa-auth-401-white-page.md) — client localStorage `isLoggedIn` desyncs from server cookie after SESSION_SECRET rotation; raw fetch must gate on r.ok or 401 objects crash render. Need ErrorBoundary + boot /auth/me reconcile.
