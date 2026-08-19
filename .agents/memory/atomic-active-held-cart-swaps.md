---
name: Atomic active and held cart swaps
description: Why parking or resuming a cart requires durable state, tenant serialization, and revision checks.
---

An active cart and a parked cart are two states of the same customer order. Never commit one side to durable storage while leaving the other side only in process memory, and never accept an unversioned cart mutation.

**Why:** A process-local lock does not coordinate multiple API replicas, and a crash between deleting a parked snapshot and restoring an in-memory active cart loses the order. Client-supplied snapshots without compare-and-swap can also overwrite scans from another device.

**How to apply:** Store both states in the shared database. Perform hold/resume transitions in one database transaction under a tenant-scoped row lock, require the caller's expected cart revision, and return a conflict with the latest snapshot rather than retrying a stale overwrite.