---
name: End-of-day report money math (ledger, dues, profit)
description: How duesCollected / profit are computed and the known duesCreated inaccuracy.
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
