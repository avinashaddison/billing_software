---
name: Owner manual-billing access key
description: Per-bill staff approval, owner-readable key storage and safe retry behavior.
---

The owner maintains exactly one active manual-billing key per shop. Staff need
the current key for each bill containing manual items; owners remain unrestricted.
The user requires the key to be **exactly four digits**, including possible
leading zeroes. Regeneration must actually choose a different value.

**Why:** The user explicitly requested “access key i want 4 digits only”.

**How to apply:** Treat keys as strings, not numbers. Short keys require both
per-actor and shop-wide guessing limits; a bare digest is insufficient against
offline enumeration, so the verifier must remain protected by the server secret.
Do not shorten the high-entropy per-bill approval tokens. Obsolete long keys
require explicit owner replacement after publishing; a read must never silently
rotate access or change pending approvals.

Regeneration replaces the old key and revokes unused approvals. It does not grant
discount editing, billing-history access or any other staff permission.

**Why:** The user requested one owner-generated key, invalidation of the first
key on regeneration, and explicitly chose approval for every manual bill.

**How to apply:** Check live actor/tenant permissions and consume approval in
the same transaction as the bill, lines, stock and collection writes. Staff
manual bills must stay online; do not send them through the offline queue.

The current approval key is deliberately owner-readable, using authenticated
encrypted storage. This is an exception for this approval feature, not a change
to the hash-only rules for login PINs, passwords or public API keys.

**Why:** The user explicitly requested “show current access key” in the owner
panel, not just reveal-once generation.

**How to apply:** Hide it from staff and read-only support sessions, never log or
persist the plaintext in browser storage, and require regeneration if the
encryption secret changes and an old key can no longer be displayed.

A committed approval must replay the same receipt on an exact retry, even after
its unused-approval expiry or key rotation. It must never create another sale
or authorize a changed bill.

**Why:** A server may commit before the browser receives confirmation. Treating
that approval as expired and asking for a fresh one can duplicate the sale.

**How to apply:** Preserve the actor-scoped retry token across reauthentication.
Keep the draft on uncertain errors; a changed request using a spent approval
requires explicit review of the already-saved bill.
