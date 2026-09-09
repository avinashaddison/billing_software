---
name: Client permission gates must mirror the server's write gate
description: Which resource key to gate a page on when the page's topic and its mutation's permission differ.
---

# Rule
Gate a page's route, its menu entries, its `PATH_RESOURCE` entry and its action button on the resource the **server** checks for the mutation the page exists to perform — not on the resource the page is *about*.

**Why:** these drift apart when a workflow's permission was named after the till rather than the domain (stock-in is gated by `scan`, not `products`, because the permission's label is "Process sales & stock-in"). Gating on the topical resource fails in both directions at once:
- staff who *do* the job are locked out (default staff perms are `products: read`, `scan: write`, so a `products`-gated page hides from the very people meant to use it, and anyone with `products: none` cannot open it at all);
- a catalog-only manager (`products: write`, `scan: none`) gets an enabled button and a 403 on click.

An `A === "write" || B === "write"` client check cannot rescue this: it only widens the button, never the route, and the server still refuses.

**How to apply:** before wiring a new page, grep the route file for the endpoint and read its `requireWrite(...)` / `requireRead(...)` argument — that string is the gate. Note that read endpoints are often bare `requireAuth` with no resource middleware, so the *write* gate is usually the only real constraint and therefore the one to mirror. Introducing a brand-new resource key is almost always wrong: it resolves to `none` for every existing staff row and silently locks everyone out.

# When one action genuinely belongs to two permissions
Decision (Sep 2026): product **creation** is any-of `products: write` OR `scan: write`; edit/delete/bulk-import stay `products: write` only. Implemented as an any-of variant of the write middleware, NOT a new resource key, and the client mirrors the same list from one shared constant.

**Why:** an owner set an "entry" staff member to `products: read` + `scan: write` and expected him to add never-carried items during stock-in ("just entry permission, not full products"). Widening `products` would also grant edit/delete; a new "create" key would be `none` for every existing staff row. Any-of on existing keys was the only option that neither over-grants nor locks anyone out.

**How to apply:** if another action needs an any-of gate, reuse the middleware and mirror the *same* list on the client; keep the 403 naming the primary resource so owners recognise it. The widening applies to every tenant's `scan: write` staff, not just the shop that asked — say so in the report. A route whose form seeds itself from a query param must be re-keyed on that param, or a query-only navigation keeps the previous value.

# Verifying a permission change cheaply
Plain-text 4-digit PINs on throwaway staff rows in the lab tenant are accepted by the PIN login (auto-migrated to bcrypt), so curl and a headless browser can log in for real instead of minting cookies; a browser session = the login response's cookie + the persisted auth store seeded from that response. Toasts auto-dismiss after ~4 s — poll the DOM immediately or a testing pass reports a false "no toast".
