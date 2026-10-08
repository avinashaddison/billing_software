---
name: Checkout discount authorization
description: Why cashier discounts need separate approval and how that differs from catalogue sale prices.
---

The user requested: "staff permissions need discount editable in checkout time".
This is a separate owner-controlled ability, not implicit in permission to create
bills. The chosen default is denied until the owner grants it; owners retain
their normal access.

**Why:** Cashier access should not automatically authorize reductions in what
the shop collects. Hiding an editor alone would still permit forged checkout
prices, so authorization applies to the submitted bill too.

Catalogue promotions are not cashier-added discounts. Compare unauthorized
submitted unit prices to the current effective catalogue price, not MRP, and
allow the normal currency precision. Authorized discounts still follow existing
price-integrity ceilings; the new ability does not bypass them.

**Why:** A sale price can be legitimately below MRP without any cashier edit.
The original mismatch-warning rule still applies to authorized editors, but
staff without this ability must not bypass it by omitting discount metadata.

**How to apply:** Keep bill-level and item-level controls consistent with live
authorization, including before offline enqueue. On revocation or resumed
discounted drafts, do not silently change totals or erase discounts: keep the
draft and explicitly refuse checkout until approved or corrected. Isolate
financial verification from live customer data.
