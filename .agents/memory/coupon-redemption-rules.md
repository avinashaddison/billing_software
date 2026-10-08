---
name: Coupon redemption rules
description: Owner-approved coupon scope, lifetime limits and safe online-only redemption.
---

The user chose BOTH a maximum total usage count and once per customer mobile
number, per coupon. The customer identity is the same bare ten-digit number
required on bills.

**Why:** The owner wants to control how many bills a code can discount and stop
the same customer redeeming that code repeatedly.

Owner-issued coupons are pre-approved promotions: staff with checkout access
can redeem a valid code without the separate manual-discount editing grant.
Coupon entry must not grant authority to change item prices or discretionary
discounts, and existing overall price-integrity ceilings still apply.

**Why:** The owner fixes coupon terms, rather than the cashier choosing the
reduction. Coupon code input is not manual discount approval.

Redemption is online-only and one coupon per bill, replacing—not stacking
with—the manual bill discount. A preview never consumes a use. Actual
redemption must serialize on the coupon and commit stock, bill, usage count
and customer claim together; otherwise a failed sale or last-use race breaks
the owner's limits.

Refunds and bill deletion do not reset lifetime usage or customer eligibility.
Keep the claim even when its bill reference is removed. Expiry is entered and
displayed in IST; availability uses the server clock.

**Why:** A return/void must not provide a way to recycle one-use promotions.
Preserving counters is the conservative rule; the owner can issue a new code
when they intentionally want to offer another promotion.

**How to apply:** Revalidate quotes on customer/cart changes without silently
changing an existing quote. Block stale quotes and offline enqueue, and do not
silently lose coupons when parking a bill. Financial verification must use
browser-local API fixtures or transaction-scoped temporary tables, never
fictional bills inserted into real shop tables.
