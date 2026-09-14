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

# Cheap browser check without the testing agent (headless Chromium over CDP)
There is no playwright/puppeteer in the workspace, but `/repl/tools/bin/chromium` exists and Node 20 has a global `WebSocket` behind `node --experimental-websocket`. A ~60-line script gives a real browser run for a fraction of a testing-agent pass: launch `chromium --headless=new --no-sandbox --remote-debugging-port=<port> --user-data-dir=/tmp/... about:blank`, read the page's `webSocketDebuggerUrl` from `http://127.0.0.1:<port>/json`, then send CDP: `Network.setCookie` (domain `127.0.0.1`) for the minted session, `Page.addScriptToEvaluateOnNewDocument` to seed the localStorage store, `Emulation.setDeviceMetricsOverride` for mobile widths, `Page.captureScreenshot` (supports `clip`), `Runtime.evaluate` to click by `data-testid`, and `Browser.setDownloadBehavior {allow, downloadPath, eventsEnabled}` + `Browser.downloadProgress` events to capture files the page generates (validate PDFs with `pdfinfo`/`pdftotext`). Use it for layout/download checks; use the testing agent for multi-step journeys.
- The test tenant `restock-lab-*` normally has **zero products**; pages that render nothing without data need a couple of rows created through the real API (so constraints hold) and deleted again by id afterwards — never against a live tenant.

- CDP gotchas that each cost a debugging cycle: `/json` lists a `background_page` target FIRST — connect to the entry with `type === "page"` or `Page.*` commands hang silently; Node buffers console output to pipes asynchronously, so a script killed by `timeout` prints NOTHING — trace with `appendFileSync` to a file; and `pkill -f cdp-profile` matches the ShellExec bash line itself (kills your own command, "No output") — use a bracketed pattern like `pkill -f "[c]dp-profile"`.

# Watch out
- A `ReferenceError` for a symbol you just deleted (e.g. a removed date-fns import) can be a **stale HMR module**, not a real fault. If typecheck and a fresh production build pass and the identifier is gone from the source, hard-refresh and re-check before "fixing" it.
- A UI test that runs while a query is still in flight can report a false failure. Distinguish "empty" from "loading" in the UI itself, then re-verify.
- CDP navigation landing on `chrome-error://chromewebdata/` (with `net::ERR_CONNECTION_REFUSED`) is not a Chromium problem: the dev server is down. A secret change or session start reboots every workflow and the orchestrator/artifact clash can take port 5000 with it — `curl 127.0.0.1:5000` first, fix the workflow, then retry.
- Do NOT seed a fake role/permission map on a **real** staff id to test a restricted branch: the boot probe re-syncs permissions from the server, and for an owner id the synced map is empty, so the whole page renders "Access Restricted" instead of the branch you wanted. Create a real staff row with exactly those permissions in the lab tenant (products + staff_profiles + staff_permissions via SQL), mint its cookie, and delete the rows and its auth_sessions afterwards.
- Product-page checks want data-rich SKUs; hira-sons TB-011 / KR-016 / M-562 have the most ledger movements (read-only, never write to that tenant).
