---
name: Device session lifecycle
description: Preserve secure login rotation while preventing duplicate active-device entries.
---

Keep authentication-ID rotation on successful sign-in. Fix duplicate device entries through server logout, retirement of the replaced signed browser session, and consistent expiry filtering—not by reusing authentication IDs or grouping browser fingerprints.

**Why:** The user wants repeated logins not to accumulate active entries. One browser can pass through email authentication and then a separate staff PIN identity. Different shop devices can share both an IP address and User-Agent; fingerprint deduplication would incorrectly merge them.

**How to apply:** Retire only the previous session identified by the verified browser cookie, using its original tenant scope. Preserve unrelated devices and keep revoked IDs revoked. Complete pending cookie-clearing logout responses before issuing another login request. A browser that loses its cookies cannot safely be identified as an existing physical device.
