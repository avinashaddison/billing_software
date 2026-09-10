---
name: Client permission gates must mirror the server's write gate
description: Which resource key to gate a page on, and how to add an ability owners want to grant by name.
---

# Rule
Gate a page's route, its menu entries and its action button on the resource the **server** checks for the mutation the page exists to perform — not on the resource the page is *about*.

**Why:** these drift apart when a workflow's permission was named after the till rather than the domain (stock-in is gated by `scan`, not `products`). Gating on the topical resource fails both ways: staff who do the job are locked out, and a catalog-only manager gets an enabled button and a 403. An `A || B` client check cannot rescue it — it widens the button, never the route, and the server still refuses.

**How to apply:** grep the route file for the endpoint and read its `requireWrite(...)` / `requireAnyWrite(...)` argument — that list is the gate; mirror the *same* list from one shared client constant. Read endpoints are usually bare auth, so the write gate is the constraint that matters.

# Owners want a named switch, not an implicit any-of
Decision (Sep 2026): product **creation** is any-of `products: write` OR a dedicated `productEntry: write` ("Product Entry", binary None/Allow); edit/delete/bulk-import stay `products: write`.

**Why:** the first cut piggybacked creation on `scan: write` (no new key, nobody locked out). The owner rejected it within a day — he wanted a permission he could **see and toggle** in the Staff dialog for one specific person. Widening an unrelated key is invisible to owners and reads as an over-grant.

**How to apply:**
- A new key defaults to `none` for every existing staff row: only safe when the ability it replaces never shipped; otherwise it silently locks people out. Either way, every owner must grant it by hand after publishing — name the exact dialog and click in the report, and never backfill live tenant rows.
- A binary ability offers only None/Allow, shows "Allowed" (not "Full Access"), and normalises a stray `read` to `none` on load.
- Whoever holds only the new key needs an entry point (nav item) and a post-save destination that doesn't require pages they can't open.
- A form that seeds itself from a query param must be re-keyed on that param, or a query-only navigation keeps the previous value.

# Editor dialogs and the app-wide staleTime
A dialog that seeds its draft inside `queryFn` breaks on open → Cancel → reopen: the 2-minute app-wide cache skips `queryFn`, so the draft never seeds and the dialog reports "couldn't load". Editors need `staleTime: 0` and must seed the draft from a *completed, successful* fetch (`data && !isFetching && !isError`), exactly once, never from cache.
