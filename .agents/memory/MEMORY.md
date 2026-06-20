# Memory Index

- [Tenant scoping helpers](tenant-scoping.md) — reads use `tenantWhere` (incl. legacy NULL); mutations use `tenantWhereWrite` (strict). Auditing by grepping the helper name MISSES unscoped UPDATE/DELETE.
- [Express req.params widening](express-req-params.md) — middleware before a handler widens `req.params.x` to `string|string[]`; convention is `String(req.params.x)`.
