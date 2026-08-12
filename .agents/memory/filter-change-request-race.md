---
name: Filter changes need newest-request-wins, and no stale numbers under a new label
description: Rapidly switching a date/status filter lets an older response paint last; a suppressed request leaves the previous filter's totals under the new filter's heading.
---

# Rule
Any list or report view whose filter triggers a refetch needs (a) a monotonic request token so only the newest response may paint, and (b) a rule that summary tiles are hidden or zeroed whenever no request was fired for the current filter.

**Why:** filter chips invite rapid clicking, and each click starts a request. Responses can return out of order, so a slower earlier one lands last and leaves the rows *and* the roll-up totals describing a range nobody selected — with the new filter's label sitting above them. There is no error and nothing looks broken, which is what makes it dangerous on numbers an operator acts on.

The second half bites in the validation path specifically: guarding against an invalid combination (an inverted from/to, an empty required field) by returning early *before* fetching is correct, but the previously-loaded totals stay mounted and silently re-label themselves as the new selection.

**How to apply:**
- `const req = ++reqRef.current;` at the top of the loader; gate both the data setter and the loading-flag reset on `reqRef.current === req`. Gating only the data setter leaves the spinner stuck off/on at the wrong time.
- Wrap summary tiles in the same condition that decides whether a request goes out; the empty/error state in the list area is not enough, because the tiles sit above it and read as current.
- Totals computed over a capped page are not authoritative. Say so in the UI when the returned row count hits the limit rather than presenting a partial sum as the answer.
