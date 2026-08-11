---
name: Price integrity guard
description: Why checkout price checking warns instead of blocking, and the sale-price rule it must mirror to avoid false alarms.
---

# Checkout price integrity is detection, not prevention

Checkout accepts a client-sent unit price. A server-side guard recomputes the
expected price, logs deviations, and hard-blocks only absurd values
(>100x catalogue, negative, non-finite). Mode: `PRICE_GUARD_MODE` = `off` |
`warn` (default) | `strict`.

**Why:** measured against live data, ~87% of recent sale lines sit BELOW the
product's current catalogue price for entirely legitimate reasons — cashier line
discounts, catalogue price changes made after the sale, and a cart that persists
for hours. Enforcing catalogue price would reject most genuine sales and stop a
working shop from selling. That is strictly worse than the tampering it prevents.

**Do not "fix" this by turning on strict mode.** The real fix is a product
change: the client must send a server-verifiable discount (an authorised
discount reason, or a signed price snapshot) so the server can derive the price
itself and reject anything else. Until then, warn mode still stores the
submitted price — this is auditable detection, not a security control, and
saying otherwise in a comment or to the user is a lie.

## The sale-price rule that must stay in sync

The guard's notion of "current catalogue price" must mirror
`effectiveSalePrice()` in the products route: **any non-null sale price is
live.** A sale is switched off by nulling the price, not by dating it — an
open-ended sale price is a running sale, not an expired one.

**Why:** getting this backwards makes every sale of an open-ended discounted
product raise a warning, which buries the real signal in noise. This has already
been introduced and fixed once.

**How to apply:** the guard matches the submitted price against *every*
plausible basis (normal price and sale price, each with the declared discount
applied), not just one. That keeps it quiet across genuinely ambiguous cases —
a sale that ended between scan and checkout, a client that priced from the base
while the server sees a sale — while still catching a ₹500 toy billed at ₹1.
