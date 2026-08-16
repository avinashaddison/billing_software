---
name: Verifying authenticated UI without creating users
description: How to get a working logged-in browser session for e2e/UI checks on this app when you have no credentials and must not write to the live DB.
---

# The problem
Every app route except `/`, `/login` and the legal pages is behind auth, and the API is behind `requireAuth`. Staff PINs are bcrypt-hashed and the default-owner bootstrap does not apply once staff rows exist, so there is **no known password**. The database holds live client data, so creating a throwaway test user is not acceptable.

# The approach: mint a session instead of logging in
Auth has two independent halves, and a working session needs **both**:

1. **Server side** — an HttpOnly `tenant_session` cookie, HMAC-signed with `SESSION_SECRET`. The signing helper lives in the API server's tenant middleware; mint the same payload shape it does (tenant slug, staff id, auth kind, issued-at) and sign it identically.
2. **Client side** — a Zustand `persist` store in `localStorage`. Without it the SPA's router redirects to `/login` before any request is made, so the cookie alone is not enough. Seed it with `page.addInitScript` so it exists *before* app scripts run.

**Why:** the client never asks the server "am I logged in?" on boot — it trusts its persisted store — while the server never looks at localStorage. Seeding only one half fails in a confusing way (either an instant redirect to /login, or a rendered page whose every API call 401s).

**How to apply:** use a **real** staff row's id. `requireAuth` validates the staff/session row against the DB, so a fabricated id is rejected with 401 even though the HMAC is valid — that check is a useful confirmation that isolation works, not a bug to route around. Write the cookie + localStorage values to a file and have the test agent read it, rather than pasting a live session credential into a prompt. Keep such sessions read-only.

# Curl-only variant (API-route testing without a browser)
For server-route tests skip the localStorage half: mint just the cookie with node (HMAC over the base64url payload, same shape the middleware signs) and send `Cookie: tenant_session=...`. A cookie with `sid:null` takes the legacy path through session validation, so no auth_sessions row is needed — but requests may lazily CREATE session rows; delete them in cleanup.
- bash gotcha: `$UID` is a readonly shell builtin (always your uid) — `UID=$(...)` silently keeps 1000 and every DB lookup 500s on the uuid cast. Use another variable name.
- psql capture gotcha: without `-q`, a `-tA -c "INSERT ... RETURNING id"` capture also grabs the `INSERT 0 1` command tag; the polluted value later aborts the whole cleanup batch. Capture with `-qtA ... | head -1 | tr -d '[:space:]'`.

# Watch out
- A `ReferenceError` for a symbol you just deleted (e.g. a removed date-fns import) can be a **stale HMR module**, not a real fault. If typecheck and a fresh production build pass and the identifier is gone from the source, hard-refresh and re-check before "fixing" it.
- A UI test that runs while a query is still in flight can report a false failure. Distinguish "empty" from "loading" in the UI itself, then re-verify.
