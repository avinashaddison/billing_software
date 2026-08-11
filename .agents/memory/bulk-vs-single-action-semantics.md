---
name: Bulk actions must reuse the single-action helper
description: Why a batch version of an existing per-row action has to share a pure helper with it, using the extend-subscription bug as the worked example
---

When adding a bulk version of an action that already exists for a single row,
extract the decision logic into a **pure function** and call it from both. Do
not re-derive it in the bulk handler.

**Why:** The bulk "extend access" handler resolved one expiry date from
`now() + duration` and wrote that same date to every selected shop. The
single-shop route anchored at `max(now, currentExpiry)`. They looked
equivalent, but for any shop already paid up beyond the new date, the bulk
version moved expiry *backwards* — a paid customer locked out early, from a
button labelled "extend". Nothing about the bulk code looked wrong on its own;
it was only wrong relative to the semantics the single-row route had already
established.

**How to apply:**
- The moment there are two code paths for "the same" action, the shared
  decision belongs in one pure, unit-tested function that both import.
- A batch operation is a loop over per-row decisions, not one decision applied
  to many rows. Anything derived from a row's *current* state (expiry, balance,
  status) must be read per row inside the loop.
- Distinguish an **extension** (relative — add to what's there, never subtract)
  from an **assignment** (absolute — an explicit date/value applied verbatim).
  Presets are extensions; an explicit date is an assignment. Mixing them is how
  the bug above happens.
- Test the direction, not just the arithmetic: assert the new value is strictly
  greater than the old one for every preset, including a far-future starting
  point. A test that only checks "expired shop + 30d = now + 30d" passes while
  the bug is live.
- Report per-row outcomes back to the caller. A bulk endpoint that returns only
  a count hides partial failure.
