---
name: "Last one standing" guards need row locks, not a prior SELECT
description: Why count-the-siblings-then-write guards fail under concurrency, and the locking order that fixes it.
---

A guard shaped like "refuse this if it would remove the last active X" is a
write-skew hazard when written as SELECT-count-then-UPDATE. Two concurrent
requests targeting two different rows each observe the *other* as still active,
both pass the check, and both write — leaving zero.

The fix: inside one transaction, take `SELECT ... FOR UPDATE` over **the whole
sibling set** (all active owners of that shop), and order the lock by a stable
key such as `id`. Decide and write inside the same transaction.

**Why:** a plain `EXISTS` subquery inside the UPDATE does not help under READ
COMMITTED — the subquery sees the pre-transaction snapshot. Locking only the two
target rows in whatever order each request happens to pick deadlocks instead;
a single ordered locking SELECT makes concurrent attempts queue up cleanly.

**How to apply:** verify it by firing a burst of concurrent requests at the
guard and asserting every one is refused *and* the row survives — a
single-request test passes just as happily against the broken version.

Related invariant in this app: the last active **owner** login of a shop cannot
be switched off. The intended way to cut a shop off is to suspend the shop,
which is reversible in one click; the error message should say so.
