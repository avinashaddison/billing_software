---
name: Checkout discount authorization
description: Why cashier discounts need separate approval and how that differs from catalogue sale prices.
---

Category discount toggles control **extra item discounts**, not catalogue sale
prices, coupons, or bill-level promotions. Enabling a category does not grant
staff the separate checkout-discount permission. Keep the existing ability on
by default; unmanaged historical categories retain their prior behavior.

Supplier controls apply to **every product linked to that supplier**. Extra
item discounts require both the category and the supplier to allow them;
enabling either one cannot override the other's block.

**Why:** The user requested “if block discount in supplier toggle product all
block of that supplier”, as the supplier equivalent of category controls.

**How to apply:** Resolve rules from current product associations in both
billing screens and server checkout. Do not overwrite individual product
prices or category settings to apply a supplier block.

**Why:** The user requested category-specific visibility without asking to
remove existing promotions or change pending-cart totals.

**How to apply:** Use current category policy in both billing screens and at
checkout. Refuse disabled-category discounts explicitly, preserve the draft,
and offer an intentional discount-removal action rather than changing totals
automatically. Product editing must select an existing managed category;
never manufacture an option for an obsolete free-text category.

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

Owner-generated coupons also count as pre-approved promotions, not permission
to edit manual discounts. Their limited redemption rules are recorded in
[Coupon redemption rules](coupon-redemption-rules.md).

**Why:** A sale price can be legitimately below MRP without any cashier edit.
The original mismatch-warning rule still applies to authorized editors, but
staff without this ability must not bypass it by omitting discount metadata.

**How to apply:** Keep bill-level and item-level controls consistent with live
authorization, including before offline enqueue. On revocation or resumed
discounted drafts, do not silently change totals or erase discounts: keep the
draft and explicitly refuse checkout until approved or corrected. Isolate
financial verification from live customer data.
