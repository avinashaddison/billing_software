---
name: Client-side PDF export (jspdf + autotable)
description: Non-obvious constraints for generating sheets/reports as PDF in the browser and handing them to the Web Share API — fonts, page-break guarantees, user activation.
---

# Decisions
- PDFs are generated **client-side** with dynamically imported `jspdf` + `jspdf-autotable` (Vite splits them into lazy chunks; the main bundle is untouched). Rejected html2canvas: raster output, ~1400 rows too heavy, tables don't paginate.
- **Why:** the app is an offline-capable PWA; a server render path would fail exactly when the shop is offline, and the API has no headless browser.

# Fonts: built-in fonts are WinAnsi-only
jsPDF's Helvetica/Courier cover cp1252 only. Anything else (Devanagari, ₹, emoji) silently renders as garbage glyphs — not an exception. Sanitise text to "?" for non-cp1252 chars (en/em dashes and curly quotes ARE in cp1252). If Hindi names ever appear in product/supplier data, a TTF must be embedded via `doc.addFileToVFS`/`addFont` — check the DB before assuming.

# Page-break guarantees in autotable
- autotable only guarantees that the **head** fits at `startY`; the first body row can still jump to the next page, leaving an orphan head/title. Measure first: `__createTable(doc, opts)` (exported from the ESM build) → `table.getHeadHeight(table.columns) + table.body[0].height`; if it doesn't fit, `doc.addPage()` and set `table.settings.startY`; then `__drawTable(doc, table)`. `table.finalY` replaces the untyped `doc.lastAutoTable` hack.
- Put a per-group title **inside the head** (a colSpan row, styled `lineWidth: 0`, drawn in `didDrawCell`) rather than as free text above the table: it then repeats on continuation pages and can never be separated from the column header.
- `rowPageBreak: "avoid"` is per-row only; it does not keep a head with its first row.

# Web Share of a generated file needs a live user activation
iOS Safari rejects `navigator.share` with `NotAllowedError` once the tap's activation is gone. So: preload the libs when the page has data, cache them in a module variable, and in the click handler do `getLoaded() ?? (await preload())` followed by a **synchronous** build — no `await` between the tap and `navigator.share` on the warm path. Map outcomes explicitly: AbortError → cancelled (silent), NotAllowedError → "blocked" (ask to tap again; do NOT auto-download and claim success), no file support → fall back to a blob download (desktop only needs no activation).

# Verification
Render in node with the same builder (`tsx`, jspdf has a node build; `Blob` is global) and inspect with `pdftoppm -png` / `pdftotext -layout` — far cheaper than a browser run for layout iterations. Then one headless-Chromium download check for the browser build (see verifying-authenticated-ui.md).
