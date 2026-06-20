---
name: SSE realtime broadcast tenant scoping
description: Why live updates (shared cart, etc.) could leak across shops, and the rule for broadcasting per-shop realtime events.
---

# SSE realtime broadcast tenant scoping

Realtime push uses `broadcast(event, data, tenantId, forceStrict?)` in `lib/sse.ts`.
SSE clients register with their cookie `req.tenantId` (via `/api/events` → `addClient`),
and `tenantContext` runs before the router so that tenantId is the real signed value.

## The leak (symptom: a live cart shown in shop A appeared in shop B)
`broadcast` fan-out is gated on `strictTenantEnabled()`. In **migration mode**
(`STRICT_TENANT=false`, which was the LIVE production default before strict-by-default
shipped), a `tenantId=null` event is delivered to ALL clients, and a tenant-tagged event
is also delivered to null clients. That legacy "Hira/null owner sees everything" behavior
is fine for *persistent* data during a backfill, but it leaks **ephemeral per-shop UI
state** (the live shared cart) across shops, which looks like a serious data bug to users.

## Rule
For ephemeral, per-shop realtime events (e.g. `cart_updated`), pass `forceStrict=true`
so delivery is ALWAYS exact-tenant-match (null matches null) regardless of the migration
flag. **Why:** there is no legitimate reason to ever share an in-progress cart across
shops, even mid-migration; strict-by-default fixes it for the normal case, but forceStrict
guarantees it can't recur if someone flips `STRICT_TENANT=false` for a backfill.
**How to apply:** leave persistent-data broadcasts on the default (flag-governed) path;
add `true` as the 4th arg only for ephemeral per-shop events.
