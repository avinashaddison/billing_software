---
name: Express req.params type widening (api-server)
description: Why route handlers wrap req.params.x in String() in this codebase.
---

# `req.params.x` can be `string | string[]`

When a middleware runs before a route handler in this api-server's TS setup, `req.params.<name>` is typed as `string | string[]` (not just `string`). Passing it straight into Drizzle `eq(col, req.params.id)` then fails typecheck.

**Why:** The auth/tenant middlewares widen the inferred `Request` params type. This surfaced as typecheck errors only after adding `requireAuth`/`requireAdmin` ahead of the handlers in `routes/staff.ts`.

**How to apply:** Wrap with `String(req.params.id)` (the established convention in this codebase) when passing a route param into a query or comparison. Run `pnpm run typecheck` to catch these.
