---
name: Adding a store setting (toy-mall)
description: The places that must stay in sync when adding a new field to StoreSettings, and why no DB migration is needed.
---

# Adding a new field to StoreSettings (toy-mall)

`store_settings.data` is a JSON blob, so adding a new setting needs **no DB migration** — just code.

To add a field without breaking Save/Reset, update ALL of these in lockstep:
- `artifacts/toy-mall/src/lib/store-info.ts` — `StoreSettings` interface + `SETTINGS_DEFAULTS`.
- `artifacts/toy-mall/src/pages/Settings.tsx` — module-level `DEFAULTS`, the `useState` form init, AND the `isDirty` comparison object. If the field is missing from the `isDirty` object, the Save button state desyncs (always dirty, or never enables). Use the same default fallback (e.g. `?? "center"`) in both the form init and the isDirty object so a freshly-hydrated form is not falsely "dirty".
- If it appears in the live preview, also thread the prop through the preview component (`ReceiptHeaderPreview`) and its prop type.

**Why:** the dirty-state is a stringified-object compare of `form` vs a hand-rebuilt object; any field present in one side but not the other makes them never match.

**Receipt header alignment:** `headerAlign: "center" | "left"` controls the printed bill header in `Bill.tsx`. Default "center" (unchanged for all existing shops). "left" = compact: logo left, brand/subtitle/tagline stacked beside it. Implemented as an early-return branch BEFORE the existing centered return; `renderedName`/`subName` (ampersand styling + gift-shop split regex) are computed before the branch so both layouts share them.
