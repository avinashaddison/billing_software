---
name: Tenant-side audit events
description: Rules for writing tenant actions into audit_events (actor FK trap, naming, fire-and-forget)
---

- **audit_events.actor_id FK targets auth_users — PIN-staff ids must NEVER go there.** Tenant sessions carry either `userId` (auth_users) or `staffId` (staff_profiles). Use the `tenantActor(req)` helper in the api-server audit lib: it puts staff into the `actorEmail` label (`staff:<name>`) and leaves actorId null.
  **Why:** writing staffId as actorId violates the FK and the audit insert silently fails (recordAudit swallows errors) — the trail just never appears.
  **How to apply:** any new tenant-route audit call goes through `tenantActor`; only platform routes may use `actorFromReq`.

- **Naming + shape:** tenant actions use `tenant.<entity>.<verb>` (e.g. `tenant.supplier.update` with per-field `{from,to}` diffs, `tenant.supplier.delete` with cascade counts). Snapshot the row BEFORE update/delete — cascades (supplier→payments) leave the audit row as the only trace. Fire the audit inside `void (async () => …)()` so responses never wait on identity lookups.

- **Forensic blindness was the root complaint enabler:** suppliers had no updated_at and no audit trail, so "did data vanish or was it never entered?" was unanswerable. When a tenant table gets edit/delete flows, wire audit events in the same change.
