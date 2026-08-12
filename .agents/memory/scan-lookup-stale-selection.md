---
name: Scan-then-confirm screens must clear the selection when the lookup starts
description: The async window between "code scanned" and "product loaded" lets a confirm button act on the previous item.
---

# Rule
On any screen where scanning/picking a code triggers an **async lookup** and a button then commits an action against the result, clear the current selection at the *start* of the lookup, not when it resolves. Funnel every selection path through one helper that does the clearing.

**Why:** setting only the pending code leaves the previously-loaded item on screen with its confirm button still enabled. A fast operator who scans B and immediately hits Add writes B's quantity onto A — silent inventory corruption with no error anywhere. The window is small but it is exactly the window a barcode gun operates in.

**How to apply:**
- One `beginLookup(code)` that nulls the product, its history and any "just did it" banner, *then* sets the pending code. Never call the pending-code setter directly from a handler.
- Audit for extra entry points — they multiply quietly. A page can easily grow four: USB gun, camera, typed code, manual search result, plus a "recent activity" row that re-selects a product. Grep for the raw setter after any edit; each new one is a fresh instance of the bug.
- Clearing on every scan also makes an unexpected re-scan (e.g. a camera left running that catches another label) *visible* rather than silent, which is why it beats trying to suppress the alternate input paths.
- Prefer the server's returned row over `local + delta` when showing the new value; a concurrent sale between lookup and write makes the arithmetic a lie.
- If a write can be lost after committing, never word the failure toast as a definite failure — point the operator at the authoritative feed, because a blind retry doubles the quantity.
