---
name: IST date ranges for reports and history views
description: The Asia/Kolkata calendar-day convention for filtering and displaying time data, plus the month-end arithmetic trap.
---

# The convention
The shop's business day is an **Asia/Kolkata calendar day**, but the DB stores UTC `timestamptz`. Dashboard counters, reports and stock-history filters all compare IST calendar dates, not raw timestamps.

- Filter in SQL with `DATE(<col> AT TIME ZONE 'Asia/Kolkata')` compared against a `YYYY-MM-DD` value; this is inclusive at both ends, which is what "from 1 May to 3 May" means to a shopkeeper.
- Build the range on the **client** from IST too (`toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })`), never from the device clock.
- **Display returned timestamps in IST as well.** If filtering is IST but rendering uses the browser locale, a device outside India shows a "last entry" date that contradicts the range the user just selected.

**Why:** these three have to agree or the numbers look wrong to the user even when the query is right.

# Trap: month arithmetic must clamp to the month's last day
Naive `date.setUTCMonth(m - n)` **overflows** rather than clamping: 31 March minus one month normalises to 3 March, because February is short. A "past 1 month" preset built that way silently drops most of the range, and only on month-end days — so it looks fine in testing on any other date.

**How to apply:** compute the target month first, find that month's last day, then clamp the day-of-month before constructing the date. Cover 31 Mar → 28 Feb, 31 Jan → 31 Dec (year rollover), and a leap year (31 Mar → 29 Feb) whenever you touch this.

# Trap: validate real dates, not just the shape
A `^\d{4}-\d{2}-\d{2}$` regex accepts `2026-02-30`. Casting that to `::date` makes Postgres raise, turning a bad request into a 500 instead of a 400. Check the date actually exists (round-trip it through `Date.UTC`) and reject `from > to` before it reaches SQL.

# Trap: totals over a capped list
When a summary endpoint returns a row list capped by `limit`, compute range-wide totals in a **separate aggregate query**, not by summing the returned rows — otherwise anything labelled "period total" silently under-reports as soon as the cap is hit. Expose a `truncated` flag so the UI can say the list is partial while the totals are not.
