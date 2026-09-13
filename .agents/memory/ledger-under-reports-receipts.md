---
name: Stock ledger under-reports receipts
description: Why "all-time stock in" can never be read off stock_logs alone in this app, and the reconciliation rule that keeps lifetime in/out figures honest.
---

# The trap
Most of the catalogue's stock never went through a stock entry. Product creation, product edit and bulk import all set `products.stock` directly and write **no** ledger row; only restocks (IN), sales (OUT), returns (RETURN) and the public API's absolute corrections (ADJUSTMENT) are logged. On the live shop roughly 80% of all units that ever arrived are "unlogged" opening stock — a report that sums IN rows shows "0 in, 3 out, 1 in stock" and reads as nonsense to the owner.

# The rule
Treat `products.stock` as authoritative and reconcile the ledger against it per product:
`gap = stock − (in − out + returned)`. A positive gap is stock that arrived without an entry (opening stock, upward edits); a negative gap is stock that left without a sale (downward edits, write-offs). Report the gap as **unlogged in / unlogged out** — never as sales, never as extra restock entries, never silently folded into a logged figure. Read products and logs in one statement so the two sides come from the same snapshot, otherwise the identity breaks under a concurrent sale.

**Why:** the owner's mental model is "how much did I buy from this supplier, how much sold, how much left" — the truthful answer includes opening stock, but pretending it was a logged restock would inflate the entry count and misdate purchases. Keeping the halves separate lets the sheet show "In" (incl. opening) while the FIFO/batch views still refuse to attribute it (see stock-batch-provenance).

**How to apply:** any lifetime or per-supplier in/out figure. Also: scope movements through the tenant-checked product only — a couple of pre-tenancy OUT rows carry a NULL tenant_id, and repeating the tenant predicate on the log join drops them, which mis-states sold and, by difference, opening stock. Strict tenant mode is the default, so the "migration mode includes NULLs" branch does not save you.
