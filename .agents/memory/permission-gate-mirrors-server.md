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
