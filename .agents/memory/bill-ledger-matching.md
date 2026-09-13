---
name: Matching ledger rows to bills / returns
description: How to attribute a stock_logs OUT/RETURN row to the bill or return it came from when there is no FK, and how to build history-facing per-product views safely.
---

**Rule:** `stock_logs` has no bill/return FK. Join OUT rows to `sale_items ⋈ bills` and RETURN rows to `returns` by **exact `created_at` equality** (plus product + own-or-legacy tenant), because checkout and refund write the ledger row inside the same transaction, so both carry the same `now()`. Verified on live data: every billed sale line matched an OUT row exactly; the few unmatched OUT rows are counter/quick sales (the app inserts a `sales` row for every non-bill OUT) or very old quick sales written milliseconds apart.

**Why:** Any looser match (same minute, nearest-before) starts pairing counter sales with unrelated bills. An unmatched OUT is honestly a "counter sale · no bill"; a wrong bill number is a support ticket.

**How to apply:**
- Use a lateral `LIMIT 1` subquery per ledger row; aggregate `sale_items` per bill and return `COUNT(*)`, `MIN(price)`, `MAX(price)`, `SUM(subtotal)`. One bill may carry the same product on several lines (checkout does not merge, and writes one OUT row per line, all with the same timestamp) — then every OUT row matches the same aggregate, so per-event money must be `quantity × price` when prices agree and null otherwise, never the aggregate.
- History-facing per-product endpoints must NOT use `liveProduct()` (archived products stay readable) and should gate with `requireRead(...)`; the manager view omits cost and customer phone as absent keys (clients distinguish undefined from null).
- `requireRead` accepts several resources (any-of) for a surface reachable from more than one page.
- Session cookies minted without `sid` register one `auth_sessions` device row per request — clean those up after read-only probes on live tenants.
- Generated client refs (`lib/api-zod`, `lib/api-client-react`) have stale `dist` like `lib/db`: run `npx tsc -b` on both after orval or the new hooks are "not exported".
