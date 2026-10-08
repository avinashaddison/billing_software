---
name: Owner idle and zero-stock retention
description: User-approved inactivity, continuous-zero grace period, and today's staff billing approval requirements.
---

Owner accounts must sign out after 10 minutes without actual interaction.
Background polling is not activity. Do not change ordinary staff idle policy.
Preserve pending owner offline work under that same account, never transfer it to
the next account on a shared device.

**Why:** The user requested owner auto logout and explicitly required safe live
server/database handling. Automatic sign-out must not silently lose queued sales.

Products qualify for automatic archival after 30 consecutive days at zero stock.
Restocking resets the clock. Existing zero-stock products receive a fresh grace
period when first enabled; never backdate it from historical sales or stock logs.

**Why:** The user requested one month at zero stock and safe live-database
handling. The implementation uses 30 consecutive days and a fresh initial grace
period because historical stock logs are incomplete; old products are not
evidence of continuous zero stock. Permanent deletion would break bill history.

Today's staff billing permission means **view today's bills and totals**, not
permission to create bills. It is a distinct owner-controlled, default-off toggle.
Keep checkout and the cashier's own new receipt usable without this reporting
grant, but do not expose shop-wide money via reports or live notifications.

**Why:** The user explicitly selected viewing rather than checkout creation.
Unlike previous permission splits, this restriction intentionally needs fresh
owner approval; do not copy old history/report grants into it.

**How to apply:** Keep these rules separate; verify retention in temporary
PostgreSQL tables with rollback and authenticated UI with intercepted fixture
responses, never by altering live customer rows or real staff permissions.
