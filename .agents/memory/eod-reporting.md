---
name: End-of-day report money math (ledger, dues, profit, returns)
description: How duesCollected / profit / net-of-returns figures are computed and the known duesCreated inaccuracy.
---

# bill_payments ledger
- `bill_payments` (migration 0012) is the money-movement ledger. `kind='sale'` = paid at checkout (cash/UPI); `kind='collection'` = a later payment against an outstanding credit/partial bill.
- EOD `duesCollected` sums **only `collection` rows** by IST date + tenant. `sale` rows are excluded because they're already in cashSales/upiSales (avoids double counting).
- Both write paths live in `bills.ts`: checkout inserts a `sale` row for non-credit bills; `POST /bills/:id/payment` locks the bill `FOR UPDATE`, then inserts a `collection` row for the **actual applied delta** (which can be clamped below the requested amount by the refund cap).
- **How to apply:** any new payment/cashflow path must also write a ledger row, or EOD cash math will silently undercount.

# Known inaccuracy (out of scope — candidate follow-up)
- `duesCreated = today.creditSales` and the cash/UPI/credit split come from `dailyTotals()`, which reads the **mutable** `bills.payment_mode`. When an old credit bill is later settled, `payment_mode` flips to cash/UPI, so a past day's `duesCreated` / payment-mix can retroactively change.
- Proper fix needs an immutable original-mode field or deriving the split from ledger events. `duesCollected` is **not** affected (it's ledger-based).

# Profit (decision)
- EOD `grossProfit` / `margin` are computed over **coveredRevenue** = SUM(subtotal) of items whose `purchase_price IS NOT NULL` — NOT full revenue minus partial cost (which overstated profit).
- **Why:** mixing all-item revenue with cost from only priced items inflates profit. `profitCoverage` (distinct priced-item count) + `coveredRevenue` are returned so the UI can label the figure "based on N priced items". The UI currently still labels it plainly "Profit".

# Net-of-returns (decision)
- Bills stay immutable; refunds are subtracted **in the reporting queries**, attributed to the IST day the return was **processed** (net-sales practice), not the sale day.
- `netRevenue = gross − ALL refunds`. `netProfit = grossProfit − coveredRefunds + returnedCost` — profit adjusts only for returns whose original sale line cost is known (matches the covered philosophy above); returned goods restock, so their cost comes back. `netMargin` over `(coveredRevenue − coveredRefunds)`.
- **Fan-out guard:** aggregate sale_items per (bill_id, product_id) — SUM qty, SUM cost via `COALESCE(sale_items.purchase_price, products.purchase_price)`, count unknown-cost lines — **before** joining returns (`lineCostsCte()` in reports.ts). A product billed on two lines of one bill must not double-count its refund. `unknown_lines > 0` ⇒ excluded from profit adjustment entirely.
- Deliberately still gross: payment-mode splits (refund payout mode is not recorded), top products, hourly, SKU-performance/Analytics (sold-flow views).
- API fields are **additive** (old fields kept); frontend uses `??` fallbacks so stale payloads render.
- Telegram nightly summary stays global/unscoped (legacy single-store report). Its quiet-day branch must check **both** `billCount === 0` and `refundsTotal <= 0` — a return-only day must render the full layout (negative net), not "No sales recorded".
- **How to apply:** any new revenue/profit report must subtract refunds the same way (returns-table tenant scope, IST processing-day bucketing, covered-only profit adjustment) or figures will disagree across pages.
