---
name: Public API keys (tenant-scoped programmatic access)
description: Design decisions and gotchas for the /api/v1 key-auth surface — key storage, tenant scoping, creation caps, and how to test it.
---

# Issuing is vendor-only
- Key create/revoke lives ONLY on platform-admin routes (`/platform/tenants/:id/api-keys`, requirePlatformAdmin); the shop-owner surface (tenant router + Settings page) was deleted at the user's explicit request ("for now"). Don't reintroduce an owner-facing surface without being asked.
- Admin issuing UI: bind the tenant into the MUTATION VARIABLES and show the shop name inside the reveal-once dialog. Reading the shop picker's current state in onSuccess misattributes a cross-tenant credential when the admin switches shops while a create is in flight.

# Key handling
- Keys are `adb_` + 48 hex; stored ONLY as a sha256 hex hash (unique) plus a 12-char display prefix. The raw key appears exactly once, in the create response. No un-revoke — mint a new key instead.
- sha256 (not bcrypt) is fine because keys are high-entropy random strings, not human passwords.

# Auth middleware contract
- `apiKeyAuth` overrides `req.tenantId` from the key row and must set `req.staffId`/`req.userId` to **undefined**, not null — the Express type augmentation declares them optional strings, so null breaks tsc.
- A key only works while its tenants row is ACTIVE and unexpired (LEFT JOIN gate). Test keys therefore need a real tenants row; never mint NULL-tenant keys (that is the legacy hira-sons data space).
- Public v1 replies use explicit column maps everywhere so tenantId/keyHash can never leak.

# Stock writes from the API
- API stock changes log type "ADJUSTMENT" with SIGNED quantity and actor `apikey:<name>`. Chosen because the app itself never writes ADJUSTMENT rows, so sales/returns reports stay unpolluted. If the app ever starts writing ADJUSTMENT, API rows will need their own marker.

# requireAdmin tenant binding
- requireAdmin 403s when the signed cookie's tenant differs from the admin record's tenant (`(record ?? null) !== (cookie ?? null)`).
- **Why:** an otherwise-valid stale cookie (account reassigned after login) must not manage API keys — or anything admin — in the cookie's tenant on the strength of a role held elsewhere.
- **How to apply:** safe here because prod has no null-tenant owner/admin records (the lone platform_admin is already rejected by the role check) and login mints the cookie tenant from the record. Re-verify those two facts before copying the pattern elsewhere.

# INSERT caps need an advisory lock, not FOR UPDATE
- "Count active rows, insert if under cap" cannot be fixed with FOR UPDATE on sibling rows: a rival's INSERT is not visible to the waiting statement's snapshot, so both transactions insert past the cap.
- Fix: `pg_advisory_xact_lock(hashtext('api-keys:'||tenant)::bigint)` as the transaction's first statement; the COUNT that follows is a NEW statement and (READ COMMITTED) sees the winner's committed insert. Verified: 3 parallel creates at 9/10 → exactly one 201.
- Contrast with the FOR UPDATE sibling-lock pattern (invariant-guards-need-locks.md), which fits guarded UPDATEs/DELETEs of existing rows.
