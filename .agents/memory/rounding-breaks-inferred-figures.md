---
name: Changing a stored total's precision breaks every figure inferred from it
description: Why whole-rupee bill settlement silently corrupted the receipt discount line and refund amounts, and the rule that prevents it.
---

# Changing a stored total's precision breaks every figure inferred from it

When the authoritative stored total stopped being exact — bills now settle at the
**nearest whole rupee**, so lines worth 780.40 collect 780 — two unrelated
features broke instantly, because both had reconstructed a value by algebra
against that total instead of reading it.

1. **The receipt's discount line.** It computed the bill discount as
   `itemsSubtotal − totalAmount`. Once the total is rounded, that gap holds the
   discount *plus* the round-off, so a 40p round-down printed as a 40p
   "discount" on a bill that had none.
2. **Refund amounts.** The returns route reconstructed the bill's subtotal as
   `totalAmount + discountAmount` to build a net-refund ratio. That identity
   only held while the total was exact. Afterwards a fully-returned 780.40 bill
   refunded 780.40 against 780 actually collected — real money out the door, on
   every rounded-down bill.

**The rule:** a derived figure must come from the rows that produced it, not
from an identity between two summary columns. Refund and discount ratios are
computed against `SUM(sale_items.subtotal)` read from the lines; the collected
total is only ever the numerator. Expressed that way the ratio absorbs the order
discount *and* the round-off at once, and yields the identical answer on older
exact bills, so no backfill or migration is needed.

**Why:** summary-column identities are invariants nobody writes a test for.
They are established at insert time by one code path and then silently assumed
by unrelated features, so a change to settlement precision reads as a one-line
edit while quietly changing what customers are refunded.

**How to apply:** before changing how any money column is rounded, stored, or
settled, grep for other code that reconstructs a sibling figure from it
(`total + discount`, `subtotal − total`, any `/ ratio` against a summary
column). Those are the breakages, not the arithmetic you are editing. Verify by
asserting a **full return refunds exactly what was collected** across
round-up, round-down, discounted and legacy-exact bills — that single property
catches all of it.

**Design choice worth keeping:** round only the final total, *after* the
price-integrity ceiling (which must judge the real discount), and leave line
prices and `sale_items.subtotal` exact. Profit and report math aggregate the
lines, so they stay untouched; the receipt shows the difference as a signed
"Round Off" row so the printed lines still add up.
