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

# Splitting an ability OUT of a key that already shipped
Decision (Sep 2026): stock moves on existing products (`POST /products/:id/stock`, Entry Data page, Scan page's "Stock IN" mode, Quick Adjust) require a dedicated `stockEntry` key (none/read/write); `scan` is billing only (checkout, held bills, shared cart, returns). Returns are `scan` OR `billing` write — they had NO gate before.

**Why:** the vendor found a "Product Entry" staff member restocking; the ability had come bundled with `scan: write`, the default for every cashier. Contradicts the "never backfill live rows" rule above on purpose: when the ability ALREADY shipped inside another key, defaulting the new key to `none` would break every shop's stock entry on deploy.

**How to apply:**
- Backfill with a boot-idempotent, insert-only migration that copies the OLD key's level into the new key (`WHERE NOT EXISTS`, `ON CONFLICT DO NOTHING`); encode the vendor's exception (holders of the add-only grant → `none`) in the same SQL and in the editor's missing-key pre-fill. Only touch staff who have a row for the old key — staff with no rows are "nothing until the owner saves", and the editor pre-fills from defaults.
- Persisted client permission maps are seeded at PIN login only, so a new key is invisible on devices that stay signed in. The boot probe (`/api/auth/me`) now re-syncs the map for the SAME staff id (non-owner); keep it identity-bound: snapshot the staff id when the probe starts, ignore the answer if the session changed meanwhile, log out on a different id.
- Grep every `postStockIn`/stock fetch in the SPA — the billing Scan page had its own Stock IN mode with no gate at all; derive `isStockIn = mode==="stockin" && can` so a stale mode can't render the panel.
- The 403 text names the resource key; keep a label map (`stockEntry` → "stock") so toasts read like English.
- Label a permission after the NAV ITEM it unlocks, not the verb. "Stock Entry" (none/read/write) shipped with `read` already meaning "view Entry Data", yet the vendor came back asking for an "Entry Data view" permission — he searched the dialog for the page's name. Renamed to "Entry Data"; description spells out what Read vs Write does.
- Taking a page away from a staff member also removes the workflows that START there (Entry Data's scan → "Add new product" handover). "Staff can't add products" after the split meant "lost the page they add products from", not a broken create gate — check the entry point before the endpoint.

# Editor dialogs and the app-wide staleTime
A dialog that seeds its draft inside `queryFn` breaks on open → Cancel → reopen: the 2-minute app-wide cache skips `queryFn`, so the draft never seeds and the dialog reports "couldn't load". Editors need `staleTime: 0` and must seed the draft from a *completed, successful* fetch (`data && !isFetching && !isError`), exactly once, never from cache.
