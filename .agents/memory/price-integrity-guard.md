---
name: Price integrity guard
description: Why checkout enforces a discount CEILING rather than catalogue price, why the ceiling must ignore client-declared discounts, and why it has to exist at bill level too.
---

# Checkout price integrity: warn on mismatch, enforce a ceiling

Checkout accepts a client-sent unit price and a client-sent bill discount. Two
different questions get two different answers:

- **"Does this match the catalogue?"** → warn only. Ordinary discounting, an
  edited price and a stale cart all land here, and refusing them stops a working
  shop from selling.
- **"Could any honest discount explain this?"** → enforced. Anything past a
  ceiling (`PRICE_GUARD_MAX_DISCOUNT_PCT`, default 70% off) is refused.

## Measure before deciding this is unenforceable

An earlier pass concluded enforcement was impossible because "87% of sale lines
are below catalogue price". That number was wrong — it compared against the raw
catalogue price while ignoring **the sale price and the declared discount**.
Measured properly over 60 days: **961 of 969 lines matched exactly**, and the
deepest real discount was **50.5%**, nowhere near a 70% ceiling.

**Why:** the difference between "we can't enforce this" and "we can enforce this
safely" was entirely an artefact of a sloppy query. Re-measure against every
basis the server would actually accept before concluding a guard is unshippable.

## The ceiling must ignore the client's declared discount

**Why:** whoever can send `price: 1` can just as easily send
`discountValue: 99.8` next to it, making the line "match" perfectly. A guard
that trusts the declared discount is not a guard. Measure the total gap from the
catalogue price and treat it as the discount whether it was declared or not.

## A line-level ceiling alone does nothing

**Why:** send every line at its honest catalogue price, then discount the whole
bill 100%. Total is zero, no line ever looked wrong. Any per-line money guard
needs an equivalent check on the final bill total.

**How to apply:** measure the bill against the catalogue value of the lines that
have a catalogue price, apportioning the bill discount. Manual lines (no
product) have no listed price, so exclude them from *both* sides — counting them
as worth zero would refuse honest bills.

## The sale-price rule that must stay in sync

The guard's notion of "current catalogue price" must mirror
`effectiveSalePrice()` in the products route: **any non-null sale price is
live.** A sale is switched off by nulling the price, not by dating it.

**Why:** getting this backwards makes every sale of an open-ended discounted
product raise a warning, burying the real signal. Introduced and fixed once
already.

**How to apply:** match the submitted price against *every* plausible basis
(normal and sale price, each with the declared discount applied), and measure
the ceiling against the **cheapest** basis — judging a discounted product
against the list price it is no longer sold at would refuse real sales.
