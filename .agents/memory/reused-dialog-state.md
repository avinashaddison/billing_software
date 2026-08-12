---
name: Long-lived dialogs reused across rows carry stale form state
description: Why a single mounted edit dialog driven by open={!!row} silently keeps one row's typed values when the next row is opened
---

A dialog rendered once at the bottom of a list page and controlled by
`<EditDialog row={selected} open={!!selected} />` **never unmounts**. Its
`useState(row?.name ?? "")` initialisers run exactly once — on first mount,
when `selected` is still `null`.

**Why:** Two failure modes, and the second is a data-integrity bug:
1. The form opens blank instead of pre-filled, because the initialiser ran
   against `null`.
2. Values typed for row A are still in state when row B is opened. The dialog
   shows B's title and A's text. Saving writes A's text onto B. Any "no
   changes" comparison against the current row does not save you here — the
   values genuinely differ, so the write goes through.

This is easy to miss in review because the submit handler correctly targets
`row.id`; only the *values* are from the wrong row.

**How to apply:**
- Re-seed on open: `useEffect(() => { if (open && row) setName(row.name) },
  [open, row?.id, ...fieldsRead])`. Depend on `row?.id`, not the object
  identity, or a list refetch will clobber what the user is typing.
- Or force a remount with `key={row?.id}` at the call site — one line, but it
  resets state mid-animation on close.
- The same applies to non-text state: a duration/preset picker keeps the last
  row's selection, which reads as intentional and is easy to submit by accident.
- Whenever a dialog takes a `row`/`item`/`target` prop *and* an `open` prop
  from the parent, assume it is reused and check how its state initialises.

# The same dialog also leaks *async replies* between rows

Re-seeding state on open fixes the form fields, but a reused dialog has a
second failure mode: a request fired for entity A can resolve after the user
has switched to entity B, and its success handler then writes A's result into
the dialog now showing B. For a one-time credential reveal that is worse than
a crash — the wrong name is shown against a real secret, and A's secret is
lost silently.

**Why:** the dialog outlives the row it is displaying, so "the currently open
row" at request time and at response time are different values.

**How to apply:** capture the target id in a local at call time, keep the live
one in a ref, and drop the response (no state write, no toast) if they no
longer match. Pair it with a single in-flight write at a time — overlapping
mutations from one reused dialog are almost never intentional.
