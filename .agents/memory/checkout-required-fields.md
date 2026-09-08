---
name: Required fields at checkout (customer mobile, manual-line cost)
description: The owner's standing rules for what a bill must carry, where each is enforced (server + both billing pages + before the offline queue), and the UX pattern used so future "make X required" asks stay consistent.
---

# Rules in force (owner asks, Sep 2026)

- **Customer mobile (10 bare digits) is required on EVERY customer bill** — cash, UPI and
  credit alike. Only the supplier-payment mode is exempt (it bills no lines; it records a
  payment to a supplier). This superseded the older "required for credit only" rule.
- **Manual (non-catalogue) line needs a purchase price** (0 allowed) — see eod-reporting.md
  for the report-side reasoning.

**Why:** the mobile is the key the customer ledger, credit collection and repeat-customer
lookups run on; an anonymous bill is invisible to all three. The owner wants no walk-in
escape hatch.

# Where a rule must be enforced (all four, every time)

1. `POST /bills/checkout` — a specific, cashier-readable 400 AFTER the generic shape check
   (the shape check only refuses a value that is present but malformed, so the specific
   message can name the problem). Server enforcement is what stops stale tabs, held bills,
   shared carts and replayed offline bills.
2. Checkout page `handleCheckout` — BEFORE the offline-enqueue branch, or the bill lands in
   the queue as a permanent 400 that retries forever (the queue has no drop path).
3. Scan page — both the Confirm Checkout modal's submit AND the page-level
   `handleConfirmCheckout` (the modal is not the only thing that can call it).
4. OpenAPI `CheckoutInput` (`required` + `pattern`), then orval regen (see
   orval-codegen-gotchas.md). Nothing outside `generated/` consumes these types today.

# UX pattern that was accepted

- Blank required field: button stays ENABLED; clicking it sets the inline error, toasts,
  focuses + scrolls the field. (A disabled button gives no click feedback and the field can
  be scrolled out of view on mobile.)
- Partially typed / malformed value: inline error immediately and button DISABLED.
- Something that cannot be fixed in place (an uncosted legacy manual line that must be
  removed and re-added): button DISABLED with a rose message above it.
- Shared helper modules per rule (`lib/customer-phone.ts`, `lib/manual-cost.ts` on the web;
  `lib/customer-phone.ts`, `lib/price-integrity.ts` on the API) so both pages and the
  server share one message and one regex.

**How to apply:** any future "make X required at billing" request follows the same four
enforcement points and the same three UX states; do not add a per-tenant toggle unless the
owner asks for one (these were global product rules, not shop settings).
