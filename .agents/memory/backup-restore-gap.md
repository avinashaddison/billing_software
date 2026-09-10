---
name: Backup delivery vs restore sources
description: A backup with no restore path is not a backup; plus the CASCADE collateral trap and how to rehearse a restore without risking production.
---

# Prod deployment can hold delivery secrets the workspace lacks

The production deployment keeps its own secret set: the R2_* keys were absent
from the workspace while the prod scheduler had been uploading nightlies for
days. Workspace secret listings say nothing about prod delivery — list the
bucket itself before concluding backups are not running. Both environments
share one bucket/prefix, so a workspace left running overnight would add
duplicate nightlies (harmless; halves effective retention days).

# A table-by-table dump is not a snapshot

Dumping each table with its own query on a shared pool captures every table at
a different instant. A write committed mid-dump can put child rows in the file
whose parent rows are missing — a backup the restore must refuse, discovered
only on the day it is needed. Nightly runs rarely hit this; a manual "backup
now" during business hours is exactly when it happens.

**How to apply:** run the entire dump on ONE connection inside
`REPEATABLE READ READ ONLY` (single MVCC snapshot covers all tables), and make
the restore rehearsal call the same dump function the real backup uses, so the
two can never drift apart.

# Check that every backup destination has a restore path

Backups delivered to one place while restore reads from another is a silent,
total failure: the owner believes they are protected and are not. A snapshot job
that can deliver to object storage **or** a chat/webhook fallback, paired with a
restore path that only downloads from object storage, means every backup taken
while object storage is unconfigured is unrestorable.

**Why:** backup and restore get written at different times and drift apart. The
delivery side grows a fallback destination; the restore side never learns about
it.

**How to apply:** whenever a backup can land somewhere new, either give restore
a way to read from there or accept a file upload, which covers every
destination at once. Then rehearse it — see below.

## TRUNCATE ... CASCADE quietly destroys tables you are not restoring

A snapshot-restore that truncates the tables it is about to refill will also
empty, via CASCADE, any table holding a foreign key into them. A table added
*after* the backup was taken is not in the snapshot, so it gets emptied and
never refilled — data loss reported as a successful restore.

**How to apply:** before truncating, walk the FK graph from the target tables,
find reachable tables that are not in the snapshot, and refuse if any hold rows.
Empty ones are harmless, so let an evolved schema still restore.

## Rehearsing a restore without risking production

Restore into a throwaway cluster the script starts itself; read production with
SELECTs and `pg_dump --schema-only` only.

**"It's on localhost" is not proof of a safe target.** A tunnel, a proxy or an
env override can put production behind a loopback port, and the rehearsal runs
`DROP SCHEMA CASCADE`. Pin the target's *identity* instead: ask the server for
`current_setting('data_directory')` and require the throwaway path. A managed
database cannot match it and usually refuses the question, so it fails closed.

Structure the restore so the scratch database and the no-op safety backup are
**injected parameters**, and refuse at runtime to skip the safety backup unless
a database was also injected — that way no future caller can disarm the last
line of defence on the real one.

**Gotcha:** managed Postgres is often a newer major than the sandbox's default
client tools, and `pg_dump` refuses a server newer than itself. Detect the
server major and locate matching binaries rather than hardcoding a path.

**Gotcha (workspace):** `drill:restore` runs through `tsx` (now a devDependency
of the api-server — keep it). Stopping the scratch cluster leaves ~50 MB in
`/tmp/pgdrill` (+ `/tmp/pgdrill.log`, `/tmp/drill-schema.sql`) to delete. The
drill now also proves an encrypted round-trip and a per-shop restore. Last PASS
drill: 2026-09-10 (26 tables; plain + encrypted + per-shop).

## Restore assumes today's schema shapes — re-drill after migrations

The json-snapshot restore handles serial/uuid keys, plain FKs and json/jsonb,
but NOT `GENERATED ALWAYS AS IDENTITY` (inserts lack `OVERRIDING SYSTEM VALUE`,
and the sequence-reset query only matches `nextval(...)` defaults) and NOT
self-referential/cyclic FKs (chunked inserts aren't dependency-ordered within a
table). **How to apply:** any migration adding either must extend the restore
first, and the restore drill is the release gate that catches it.

## Per-shop restore: rows pinned by legacy NULL-tenant references

The live DB still holds a handful of pre-tenancy rows with `tenant_id IS NULL`
(one bill + its line, four products, a category, two stock logs). One such
legacy `sale_items` row points at a `hira-sons` product, so a per-shop restore
that "fails closed on any outside reference" makes the one shop that owns the
legacy data the one shop that can never be restored. The drill caught it; unit
tests could not.

**How to apply:** delete child-first `WHERE tenant_id = $1 AND NOT EXISTS
(<any referrer>)`, keep whatever survives ("pinned"), then upsert the snapshot
rows `ON CONFLICT (pk) DO UPDATE … WHERE <row>.tenant_id = $1` so pinned rows
are overwritten in place and a PK collision with another shop is refused, never
hijacked. Upsert pinned rows first within a table so unique keys (SKU) they
still hold are released. Report `rowsKept`/`rowsKeptStale`; the preview's
"pinned" estimate uses `tenant_id IS DISTINCT FROM $1` on referrers and must
equal what the restore finds (the drill asserts it).

## Tenant ids are slugs, not UUIDs

`tenants.id` is text like `hira-sons`; a UUID regex on a tenant id rejects
every real shop. Validate with the slug pattern used at creation.

## Multi-process scheduling: claim named slots in the DB

Workspace and deployment run the same scheduler against one Neon DB. Instead of
env-sniffing or leader election, each scheduled run is a slot named on the IST
calendar (`nightly:YYYY-MM-DD`, `intraday:YYYY-MM-DDTHH`) claimed with
`INSERT … ON CONFLICT … DO UPDATE … WHERE` in `backup_runs` (re-claim only when
`running` for >20 min or `failed` with attempts left). The ledger is excluded
from snapshots and never restored — it is metadata about backups. A ledger
failure must never stop a backup: fall back to an in-process claim. The
non-deployment process waits a grace period so prod gets first dibs.

## Restore barrier and safety copy ordering

Take the write barrier (`LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE` on the
tables being rewritten AND every table with an FK into them, with a
lock_timeout) BEFORE the safety backup, inside the restore transaction. Taken
after, a write can land between "copied" and "replaced" and is unrecoverable;
without it, the per-shop FK guards judge a world that can change under them.
Reads (the dump connection) still pass. Sequences are shared across shops and
`setval` survives rollback — only ever move them forward, comparing against
the sequence's own last_value, never MAX(column).

## "Delivered" must mean accepted

A send helper that swallows HTTP failures turns a pre-restore safety copy into
a success that went nowhere. Delivery helpers must return how many recipients
accepted; zero is a failure at the call site.
