---
name: Read-only "view as" session scope
description: Why the blanket write-refusal for vendor support sessions covers the tenant API only, and why platform-admin routes are deliberately exempt.
---

# Scope of the read-only support session

A vendor can mint a signed, short-lived tenant cookie carrying a read-only
claim in order to see a shop's own screens. A middleware turns that claim into
a real guarantee by refusing every non-GET/HEAD/OPTIONS request and by
re-checking the session age server-side (a copied cookie has no maxAge).

**The rule:** that gate governs the *tenant* surface — everything a shop's own
app can call. The vendor's platform/admin control plane is mounted ahead of the
gate and guarded by its own admin check instead.

**Why:** the person holding the support session is the platform admin, who
already has full mutation power over every shop from the admin console. The
support session grants no privilege they did not already hold, so gating the
platform routes buys no security. It costs a lot though: the admin console is
normally open in another tab of the *same browser*, sending both cookies, so
extending the gate would freeze the entire console for the hour the support
session lasts. A code review will flag this as a bypass — it is not one, and
the fix it suggests is a functional regression.

**Also:** normal sign-in must stay allowed from inside a read-only session. It
requires real credentials and replaces the cookie with an ordinary one, so
refusing it only strands the browser until the session expires.

**How to apply:** when adding a new router, decide which surface it belongs to.
Tenant-facing routers mount *after* the gate. Anything behind the platform
admin check mounts before it. Keep the honest scope written next to both
mounts, or the next reviewer re-raises it.
