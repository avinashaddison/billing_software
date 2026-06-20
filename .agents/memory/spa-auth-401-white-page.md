---
name: SPA white-page on 401 (client auth vs server cookie)
description: Why the toy-mall SPA white-pages after a deploy, and the invariants that prevent it.
---

# White-page after deploy: client localStorage login vs server cookie

## The trap
The toy-mall SPA stores `isLoggedIn` (+ role/permissions) in **localStorage** (zustand persist), while the real session is an **httpOnly cookie**. These desync whenever the server invalidates cookies — most commonly when a deploy **sets/rotates `SESSION_SECRET`** (which signs the cookie). After such a deploy every returning user has `isLoggedIn:true` locally but a dead cookie, so the router renders the authed app shell and every `/api/*` returns `401 {error:...}`.

## Why that becomes a *blank white page*
Many pages fetch with `fetch(url).then(r => r.json()).then(setState)` **without checking `r.ok`**. On a 401 they store the error *object* into state typed as an array (or an `EodReport`), then a render-time `data.reduce/.map` or `eod.yesterday.x` throws. There was **no React error boundary**, so one thrown render tore the whole tree down to a blank page. Truthiness guards like `eod ? ...` do NOT protect you — a `{error}` object is truthy.

## Invariants to keep (the fix)
1. **Never feed an unchecked response into state.** Raw `fetch` must gate on `r.ok` and shape: `.then(r => r.ok ? r.json() : [])` then `Array.isArray(d) ? d : []` (or `null` for object state, or `Promise.reject` to hit an error UI).
2. **Keep a top-level `ErrorBoundary`** wrapping the app so any future render crash degrades to a recovery screen, never a white page.
3. **Reconcile client auth with the server cookie on boot.** Probe `/api/auth/me`; on a definitive **401** drop the client session (→ router redirects to `/login`). The SPA's `isLoggedIn` means a completed **PIN/staff** session, so also drop it when `/auth/me` returns `200` with `kind !== "pin"` (a stale pre-PIN email cookie) — otherwise old permissions linger. **Only act on definitive responses; ignore network/5xx errors** so a transient blip never logs out a valid user.
4. **Mount the global 401 guard.** `AuthFetchGuard` (wraps `window.fetch`, logs out + redirects on protected 401s) existed but was never mounted — verify safety-net components are actually rendered, not just defined. `/api/auth/me`, `/api/auth/login*`, `/api/platform/*` must stay exempt to avoid redirect loops.

**Why:** these four are defense-in-depth; #1 stops the specific crash, #2 stops all of them, #3 makes the post-deploy case land on login cleanly, #4 handles mid-session expiry.
**How to apply:** any time you add a page that fetches protected data with raw `fetch`, or change session/cookie/SECRET handling, re-check #1–#4.
