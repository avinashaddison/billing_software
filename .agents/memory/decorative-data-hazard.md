---
name: Decorative chart data hazard
description: Fake/seeded sparklines or padded chart totals beside real financial figures fail review — plot real series or render nothing.
---

# Decorative chart data beside real metrics

**Rule:** Never render invented data (seeded sparklines, "growth-boosted" last points, `total || 1` shown as the total) next to real business figures. A mini-chart on a metric card will be read as the metric's actual trend. Either feed it real observations or omit the chart for that card.

**Why:** The admin dashboard redesign shipped seeded pseudo-random sparklines (with an artificial upward final point) on Shops/Revenue/Bills/Products cards, and a donut whose divide-by-zero guard displayed "₹1 Total Revenue" on a ₹0 platform. Architect review failed the build over both — fabricated financial visualization, not a style nit.

**How to apply:**
- Sparkline/chart components should accept `data: number[]` (real observations) and render nothing below 2 points — no seed-based generators.
- Zero-total guards belong in the geometry denominator only (`denom = total || 1`); the *displayed* figure must stay the real total (₹0), ideally with an explicit empty state.
- Cards with no real series (e.g. no history endpoint) get NO sparkline — don't fake balance.
- The platform overview endpoint returns a gap-filled 14-IST-day `series` (revenue+bills, NULL-tenant rows excluded to match totals) for exactly this purpose; per-shop detail has its own.
