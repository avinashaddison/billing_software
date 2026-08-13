---
name: Printable sheets rendered inside the app shell
description: Hazards when a tenant page adds a print view (A4 or thermal) while mounted inside AppLayout
---

- **Shell chrome prints unless explicitly `no-print`.** The global print CSS hides only `aside`, `nav`, and `.no-print`. Everything else in AppLayout prints ABOVE the sheet: the offline banner, AppNotices (vendor notices + view-as banner), and decorations. Those three now carry `no-print`; any NEW banner/overlay added to the shell must too.
  **Why:** the A4 stock-check sheet initially printed active vendor notices/offline banner as first-page content, pushing and splitting the real sheet.
  **How to apply:** when adding a print view or any new shell-level chrome, audit every sibling of `main` in AppLayout for print visibility; verify with a notice active.

- **Client-side group-by-parent-id needs a fallback group.** The schema has no FK cascade from products to suppliers, so deleting a supplier leaves products with a dangling `supplier_id`. Grouping strictly by the ids returned from `/api/suppliers` silently drops those rows. Route unmatched ids into the "no parent" group so count sheets list every product exactly once.
  **Why:** a physical stock-count sheet that silently omits inventory defeats its purpose; the omission is invisible on screen too.
  **How to apply:** any UI bucketing children by parent id (suppliers, categories, customers) — build a known-id set first and fallback-route misses; never `continue` past them.
