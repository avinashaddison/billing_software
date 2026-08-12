---
name: Credentials can be replaced, never retrieved
description: Why the admin panel cannot "check" a staff PIN or password, and the reset-and-reveal-once pattern used instead.
---

Staff PINs and user passwords are bcrypt hashes. A request to "check the PIN of
any store" cannot be built as asked — there is no plaintext anywhere to read.

The rule: offer **set a new one and reveal it exactly once** in the response
body, never a lookup. The plaintext must never reach the audit log, server logs,
or any list endpoint — audit the *fact* of the reset plus who and which account,
nothing more.

**Why:** the vendor's real need is "the shop can't get in, fix it now", and a
reset satisfies that completely. Building any retrieval path would mean storing
credentials reversibly, which is a far worse trade than the small friction of
telling staff a new number.

**How to apply:** when a support-style feature is phrased as "show me their
password/PIN", say plainly that it cannot be read, then ship the reset. Say it
in the UI too, next to the control, or the vendor will assume the feature is
missing or broken.

Two details specific to this app:
- Staff sign in with **staff id + PIN**, not the PIN alone, so PINs do not need
  to be unique across a shop. Do not add a collision check.
- There is a 5-strike / 30-minute lockout on PIN entry. "Locked out" and "forgot
  the PIN" are the same phone call, so a reset must clear the lockout counters
  too — and a standalone unlock (no PIN change) is worth having on its own.
