---
name: Tenant scoping on writes
description: Where a tenant predicate genuinely helps on UPDATE/DELETE, and the two places adding one actively causes bugs.
---

# Put the tenant predicate on the row you own, not on its dependents

Repeating the tenant predicate on a mutation (not just on the SELECT that gates
it) is good defense-in-depth for the **primary** row — the product being deleted,
the bill being paid, the product whose stock is moving. Use the write-scoped
helper there, so the guarantee survives a refactor that drops the gating SELECT.

**Do NOT add a tenant predicate to dependent-row cleanups or aggregates.**
Two concrete ways it backfires, both found in review:

- **Refund sums.** Summing a bill's returns with a tenant predicate EXCLUDES a
  legacy return row whose `tenant_id` is NULL. That under-counts refunds,
  inflates the outstanding cap, and lets the bill over-collect. A money bug.
- **Cascade deletes.** Deleting a product's stock logs with a tenant predicate
  skips any legacy log row with a NULL `tenant_id`, leaving an orphan that then
  breaks the product delete on its foreign key.

**Why:** the dependent rows are already reached through a foreign key to a row
whose ownership was just verified, and those ids are globally unique — so the
predicate adds no isolation at all, while silently filtering out legacy
NULL-tenant rows that must still be included.

**How to apply:** scope dependents by their foreign key alone and leave a
comment saying the omission is deliberate, or someone will "harden" it back.

## Helper semantics worth remembering

The read helper is only NULL-tolerant when strict tenancy is explicitly disabled;
under the default it behaves the same as the write helper. So reaching for the
read helper on a mutation to "keep legacy rows reachable" does nothing under
normal configuration — it just reads as though it does.
