---
name: API error-handling contract (api-server)
description: How centralized error handling, JSON 404, and 5xx leak prevention are wired in the Express 5 API
---

# API error-handling contract (artifacts/api-server)

## Centralized handler
There is ONE error contract: routes either send `res.status().json({ error })`
themselves, or throw — a thrown/rejected error reaches the centralized 4-arg
`errorHandler` (in `middlewares/error.ts`), which returns `{ error }` JSON.

**Express 5 auto-forwards rejected async route handlers to the 4-arg error
middleware** — no `asyncHandler` wrapper is needed. Before this handler existed,
an async route without try/catch would hang the request (the process-level
`unhandledRejection` guard in index.ts keeps the process alive but never
responds).

## Wiring order in app.ts (do not reorder)
`app.use("/api", router)` → `app.use("/api", apiNotFound)` →
(prod only: `express.static` + SPA `index.html` fallback) → `app.use(errorHandler)` LAST.
**Why:** `apiNotFound` must sit after the router but BEFORE the prod SPA fallback,
or an unmatched `/api/*` request returns `index.html` instead of a JSON 404.
The 4-arg `errorHandler` must be registered last so it catches errors from
everything (it's invoked by arity only when `next(err)` fires).

## Auth gate vs 404
`requireAuth` in `routes/index.ts` runs BEFORE route matching, so an
unauthenticated request to a nonexistent `/api/*` path returns **401**, not 404.
Authenticated-but-unmatched paths fall through to `apiNotFound` → 404. Both are
clean JSON — this is by design, not a bug.

## Leak prevention
- 5xx responses must never echo raw `err.message`/stack. The handler returns a
  generic "Internal server error" for 5xx in production (full error logged
  server-side); dev surfaces `err.message` to aid debugging.
- Upstream-dependency failures (Cloudinary in `upload.ts`, Telegram Bot API in
  `telegram.ts`) log the real cause and return a safe message with **502**.
  **Why:** raw provider errors previously leaked account/config detail.

## ZodError detection without importing zod
`api-server` does not declare `zod` directly (schemas come from
`@workspace/api-zod`). The handler detects a ZodError **structurally**
(`err.name === "ZodError" && Array.isArray(err.issues)`) → 400, so it needs no
zod import. Use `AppError`/`badRequest()` from `lib/errors.ts` for new throws.

## Scope note
Most mutation routes (staff, categories, suppliers, settings, returns) already
validate inputs with manual 400 guards. Don't churn the existing
`safeParse`/manual-validation routes on this live app — add guards only to
genuine gaps.
