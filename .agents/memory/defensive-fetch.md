---
name: Defensive fetch handling in toy-mall pages
description: How to harden frontend fetch responses without introducing data-integrity bugs
---

# Defensive fetch in toy-mall React pages

## The crash class
Many pages call `await r.json()` (or `.then(r => r.json())`) **before** checking
`r.ok`. A non-2xx error from the proxy/auth layer often returns a **non-JSON HTML
page**, so `r.json()` throws a SyntaxError. In a render-triggering effect without
a `.catch`, that can blank the panel.

**The pattern:** check `r.ok` first (or parse safely with `.json().catch(() => null)`),
then validate the shape (`!data || typeof data !== "object"` / `Array.isArray`)
before using it. For list loads use `r.ok ? r.json() : []` and keep `Array.isArray`
guards.

## The non-obvious trap: don't fall back to defaults on a load that feeds an editable form
**Rule:** When a fetch loads existing state into a form the user can then **Save**,
a failed load must NOT silently fall back to fabricated defaults — that lets the
user overwrite real data with defaults.

**Why:** The StaffManagement permissions dialog originally hardened its load by
falling back to `DEFAULT_STAFF_PERMISSIONS` and setting `loaded=true` on failure.
That enabled the Save button, so an owner clicking Save on a transient load error
would silently overwrite a staff member's real access-control permissions with
defaults. Architect flagged this as an access-control integrity bug.

**How to apply:** On a failed/malformed load, THROW (don't poison state and don't
set the `loaded` flag). Drive the render as `isLoading -> spinner`, else
`!loaded -> explicit error panel`, else editor. Keep the Save button
`disabled={... || !loaded}` so it can't submit until real data actually loaded.
Defaulting *missing keys* after a successful response is fine; defaulting the
*whole payload* on failure is not.

## The sibling trap: "failed to load" must never render as "there is nothing"
**Rule:** Every react-query call must destructure `error` and render a distinct
error branch. `!data?.items?.length -> "No backups found"` is a lie when the
request 500'd, and it is the most reassuring possible lie.

**Why:** An operator reading "No recent backups" during an incident concludes
the backups are *gone* and starts recovering from a worse source. Same for an
empty audit log (reads as "nobody touched it") and a "shop not found" detail
view (reads as "the shop was deleted"). The fallback inverts the meaning of the
screen precisely when someone is relying on it.

**How to apply:** Order the branches `isLoading -> error -> empty -> data`.
Say what failed and that it does not imply absence. Also surface *soft* errors
the server reports in a 200 body (e.g. a `listError` field when an upstream
bucket is unreachable) — those never reach react-query's `error`. Reserve the
empty state for a successful response that genuinely contained nothing.

### "My data got deleted" complaints are usually this bug
A raw fetch that resolves `[]` on `!r.ok` makes the page render its EMPTY state ("No suppliers yet") after a network blip or expired/revoked session — shopkeepers report it as "data automatically deleted". Fix pattern: throw on !ok → dedicated error branch with retry + "your data is safe" copy; on a failed REFRESH keep showing the stale list and toast instead (full error screen only when there is nothing to show). Checkout/Labels still swallow supplier-list errors this way (low stakes, dropdowns only).
