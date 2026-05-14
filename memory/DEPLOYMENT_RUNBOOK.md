# Multi-Tenant Migration — Production Deployment Runbook

> **Scope**: this runbook covers deploying the tenant-migration code to your
> production / staging environment, verifying it end-to-end with the real
> `LICENSE_SECRET`, and the controlled rollout of the first real tenant
> ("hira-sons") with backfill. **No commands in this document modify the
> production `license_status` row**. `STRICT_TENANT` stays `false`
> throughout.

---

## 0. Pre-deploy state (already done — do not redo)

The additive SQL migration (`lib/db/migrations/0001_tenant_additive.sql`)
**has already been applied** to the live Neon DB. Re-running it is safe
(every statement is `IF NOT EXISTS`) but unnecessary. Verification:

```bash
node scripts/src/tenant-migration-inventory.mjs   # read-only audit
```

Expected: `tenants` table exists, all 12 priority tables have
`tenant_id text NULL`, row counts match the pre-migration snapshot
(326 total rows). Every existing `tenant_id` is `NULL`.

---

## 1. Required production environment variables

| Variable | Required? | Where it comes from | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | existing | unchanged |
| `PORT` | yes | platform (Render/Railway sets it) | unchanged |
| `LICENSE_SECRET` | yes | existing | unchanged — required to validate the live `key_override` |
| `LICENSE_KEY` | optional | existing | unchanged |
| `ADMIN_PASSWORD` | optional (vendor only) | existing | unchanged |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `STORE_NAME` | optional | existing | unchanged |
| `CLOUDINARY_URL`, `CLOUDINARY_FOLDER` | optional | existing | unchanged |
| **`SESSION_SECRET`** | **new (recommended)** | **generate fresh** | 32+ char random; if unset the code falls back to deriving from `LICENSE_SECRET` (existing installs keep booting) |
| **`STRICT_TENANT`** | **new (must stay `false`/unset)** | **explicit** | leave **unset** or set to `false`. Setting `true` removes the legacy NULL fallback and would hide all current Hira & Sons data |
| **`CORS_ORIGIN`** | new (recommended) | your prod frontend origin | comma-separated allowlist; if unset, CORS reflects the request origin (fine for LAN POS, tighten for public SaaS) |

### Generate a fresh `SESSION_SECRET`

```bash
# Run on your workstation, paste the output into the platform's env-var UI
openssl rand -base64 48
```

### Critical: keep `STRICT_TENANT` disabled

```
STRICT_TENANT=false     # or omit entirely
```

Flipping this on **before** the `hira-sons` backfill is destructive to
functionality — the Hira data would suddenly become invisible. Do not set
it until after the backfill phase completes and you've re-verified.

---

## 2. Deployment steps (Render / Railway / Procfile host)

1. Push the updated code (already on disk under `/app`).
2. The platform's build hook runs:
   ```bash
   pnpm install --frozen-lockfile && pnpm run build:prod
   ```
   `build:prod` runs frontend (`@workspace/toy-mall`) and api-server
   builds. **Skip `pnpm run typecheck`** at deploy time — there is a
   pre-existing unrelated frontend type error in `Labels.tsx` (not
   caused by this migration). The `build:prod` script does not run
   typecheck.
3. Start command (unchanged):
   ```bash
   node artifacts/api-server/dist/index.mjs
   ```
4. **Do not** run `pnpm --filter @workspace/db run push`. The DB is
   already aligned via the additive SQL. Drizzle Kit may attempt
   unrelated ALTERs based on the old schema's index declarations vs
   live state — avoid it.

### What changes on first request after deploy

The server boots normally. The first request:

- Goes through `cookieParser` (new).
- Goes through `tenantContext` (new) — for un-authenticated requests
  `req.tenantId = null`, which is the legacy/Hira mode.
- Goes through the `licenseGate` (existing behaviour, now with a
  per-tenant cache keyed by `null` for the Hira install).

The existing single Hira staff/owner row has `tenant_id IS NULL` →
their PIN login still works exactly as before → the cookie is set with
`{ t: null, s: <staffId> }` → every subsequent query filters via
`tenant_id = null OR tenant_id IS NULL` (which collapses to the legacy
"see everything that is NULL" branch). No behavioural change.

---

## 3. Post-deploy smoke tests (run from your workstation against prod URL)

Replace `$BASE` with the production base URL (e.g. `https://hira.example.com`).

### 3.1 Health & license

```bash
curl -s $BASE/api/healthz
# Expect: {"status":"ok"}

curl -s $BASE/api/license/status
# Expect: { "valid": true, "mode": "licensed"|"trial", ... }
# If mode=="invalid" with reason=="Invalid signature" → LICENSE_SECRET
# env var on the deployed instance does NOT match the secret that signed
# the row's key_override. Fix the env, do not touch the DB row.
```

### 3.2 Auth (cookie + tenant flow)

```bash
# Save cookies to a jar
COOKIES=/tmp/hira-test-cookies.txt
rm -f $COOKIES

# Login as the existing Owner. PIN is what the live operator already uses.
curl -s -c $COOKIES -b $COOKIES -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"staffId":"<owner-uuid>","pin":"<owner-pin>"}'
# Expect: { "id": ..., "name": "Owner", "role": "owner",
#           "tenantId": null,        ← legacy NULL tenant
#           "permissions": {...} }
# Set-Cookie: tenant_session=<base64url>.<sig>; HttpOnly; SameSite=Lax; ...

curl -s -b $COOKIES $BASE/api/auth/me
# Expect: same { id, name, role, tenantId: null, permissions: {...} }

curl -s -b $COOKIES -X POST $BASE/api/auth/logout
# Expect: { "ok": true } + Set-Cookie that expires the session
```

### 3.3 Data routes — legacy NULL tenant (Hira)

```bash
# After logging in (cookie has tenantId: null)
curl -s -b $COOKIES $BASE/api/products | jq 'length'
# Expect: 126

curl -s -b $COOKIES $BASE/api/bills | jq 'length'
# Expect: 11 (most recent up to 50)

curl -s -b $COOKIES $BASE/api/dashboard/summary
# Expect: { totalProducts: 126, totalStock: ..., lowStockCount: ..., ... }

curl -s -b $COOKIES $BASE/api/categories | jq 'length'
# Expect: 3

curl -s -b $COOKIES $BASE/api/suppliers | jq 'length'
# Expect: 1

curl -s -b $COOKIES $BASE/api/staff | jq 'length'
# Expect: 2  (Owner + Shubham)
```

### 3.4 End-to-end transaction smoke (only if you want to write data)

Skip this in production if you don't want a fake bill in your records.
Or do it and then return/refund the bill to keep stock accurate.

```bash
# Get one product id from /api/products, then:
curl -s -b $COOKIES -X POST $BASE/api/bills/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"<id>","quantity":1,"price":1}],"paymentMode":"cash"}'
# Expect: 201 { bill: {...}, items: [...], saleItems: [...] }
# Verify: stock decreased by 1, stock_logs row added with tenant_id IS NULL,
# bill row has tenant_id IS NULL (legacy mode).
```

---

## 4. Tenant isolation smoke test (without touching prod data)

The runtime smoke script proves isolation at the SQL layer without
inserting anything:

```bash
DATABASE_URL=<prod url> node scripts/src/tenant-runtime-smoke.mjs
```

Expected output (already verified against this exact DB):

| Scenario | Rows visible (every table) |
|---|---|
| `tenantId=null`, STRICT_TENANT=off | full Hira data |
| `tenantId="acme"`, STRICT_TENANT=off | full Hira data (legacy NULL fallback) |
| `tenantId="acme"`, STRICT_TENANT=on | 0 (legacy hidden, no acme rows yet) |
| `tenantId="hira-sons"`, STRICT_TENANT=on | 0 (no rows backfilled yet) |

---

## 5. Post-stabilisation — first real tenant + controlled backfill

**Do not run this in step 3.** Only after smoke tests at steps 3.x all
pass.

### 5.1 Create the `hira-sons` tenant row (idempotent)

```sql
INSERT INTO tenants (id, name, is_active)
VALUES ('hira-sons', 'Hira & Sons Gift Shop', true)
ON CONFLICT (id) DO NOTHING;
```

This change alone has zero impact on existing behaviour — no row in any
data table references `hira-sons` yet, so queries still hit the
`tenant_id IS NULL` branch.

### 5.2 Controlled backfill (one table at a time, wrap each in a tx)

Do this during a quiet window. After **each** table, run a quick
verification curl to confirm Hira & Sons data still appears (queries
should now match the row via `tenant_id = 'hira-sons'` because the
cookie still carries `tenantId=null` until you also update
`staff_profiles`).

> ⚠️ While `STRICT_TENANT=false`, NULL-tenant cookies still see every
> backfilled row through the OR-IS-NULL fallback, so you can backfill
> at your own pace without breaking the live shop.

```sql
-- One table at a time, in a tx each, with explicit row-count assertion.

BEGIN;
  UPDATE products SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 126
COMMIT;

BEGIN;
  UPDATE bills SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 11
COMMIT;

BEGIN;
  UPDATE sales SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 44
COMMIT;

BEGIN;
  UPDATE sale_items SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 15
COMMIT;

BEGIN;
  UPDATE stock_logs SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 114
COMMIT;

BEGIN;
  UPDATE returns SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 1
COMMIT;

BEGIN;
  UPDATE categories SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 3
COMMIT;

BEGIN;
  UPDATE suppliers SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 1
COMMIT;

BEGIN;
  UPDATE staff_permissions SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 13
COMMIT;

-- license_status: only backfill the legacy id=1 row.
BEGIN;
  UPDATE license_status SET tenant_id = 'hira-sons'
   WHERE tenant_id IS NULL AND id = 1;
  -- Expect: UPDATE 1
COMMIT;

-- store_settings: only backfill the legacy id=1 row.
BEGIN;
  UPDATE store_settings SET tenant_id = 'hira-sons'
   WHERE tenant_id IS NULL AND id = 1;
  -- Expect: UPDATE 1
COMMIT;

-- staff_profiles backfill LAST — this is the row that determines
-- which tenant the next login session gets. Once these rows are
-- non-null, the cookie issued at login will carry "hira-sons".
BEGIN;
  UPDATE staff_profiles SET tenant_id = 'hira-sons' WHERE tenant_id IS NULL;
  -- Expect: UPDATE 2
COMMIT;
```

**Total backfill: 332 rows updated. Zero rows deleted. `STRICT_TENANT`
remains `false` throughout.**

### 5.3 Validation after backfill

```bash
# Sanity inventory: every priority table should now have 0 NULL-tenant rows.
DATABASE_URL=<prod url> node scripts/src/tenant-distinct.mjs
# Expect (per table): one bucket only, tenant_id="hira-sons", count matches above.

# Smoke script: every scenario except "tenantId=null" should now see the
# Hira data; "tenantId=null" sees 0 because no NULL rows remain.
DATABASE_URL=<prod url> node scripts/src/tenant-runtime-smoke.mjs

# Force a fresh login from the shop's browser. The new cookie should
# carry "tenantId": "hira-sons" in the login JSON response.
```

### 5.4 Re-verification curl pack (post-backfill, BEFORE STRICT_TENANT)

```bash
# Same tests as §3.3 — every count should still match (126/11/3/1/2/...).
# Now they're served because tenant_id='hira-sons' = cookie tenant.
```

---

## 6. Final hardening — flipping `STRICT_TENANT=true`

Only after:

- §5.3 says every priority table has 0 NULL-tenant rows.
- §5.4 curl tests all pass with `tenantId="hira-sons"` cookie.
- You're ready to onboard a second tenant.

```
# Platform env-var UI:
STRICT_TENANT=true
```

Restart the server. Re-run §3.3 — counts must match. The OR-IS-NULL
fallback is now gone; any future stray NULL-tenant row will be
invisible (intentional — it surfaces accidental writes to backfill).

---

## 7. Onboarding a second tenant (after STRICT_TENANT=true)

```sql
INSERT INTO tenants (id, name) VALUES ('acme-mart', 'Acme Mart');

-- Create a fresh owner for the new tenant. Use a bcrypt hash of the
-- desired 4-digit PIN — generate it via the existing /api/staff POST
-- endpoint while logged in as the vendor admin, or with:
--   node -e "import('bcryptjs').then(b=>b.default.hash('1234',10).then(console.log))"
INSERT INTO staff_profiles (name, pin, role, is_active, tenant_id)
VALUES ('Acme Owner', '<bcrypt-hash-of-1234>', 'owner', true, 'acme-mart');
```

The acme owner's login sets `tenantId="acme-mart"` in the cookie, and
every subsequent query is automatically scoped via `tenantWhere(...)`.

---

## 8. Rollback plan

The migration is purely additive. If something goes wrong at deploy
time, revert the application code only — the DB columns remain
nullable and unused, no rows have been changed, and the previous code
ignores the new columns entirely. **No DB rollback is necessary.**

If you need to back out partial backfill SQL from §5.2 (e.g. wrong
tenant slug):

```sql
-- Only run if you ran the backfill with the wrong slug. Replace
-- 'wrong-slug' with whatever you mistakenly set.
BEGIN;
  UPDATE products          SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE bills             SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE sales             SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE sale_items        SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE stock_logs        SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE returns           SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE categories        SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE suppliers         SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE staff_profiles    SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE staff_permissions SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE license_status    SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
  UPDATE store_settings    SET tenant_id = NULL WHERE tenant_id = 'wrong-slug';
COMMIT;
```

---

## Quick checklist (paste into your deploy ticket)

- [ ] Generate fresh `SESSION_SECRET` (`openssl rand -base64 48`); add to env.
- [ ] Confirm `STRICT_TENANT` env is **unset or `false`**.
- [ ] (Optional) Add `CORS_ORIGIN` allowlist for your prod frontend.
- [ ] Deploy code. Do NOT run `pnpm db push`.
- [ ] §3.1 — healthz + license/status return 200 + valid licensed/trial.
- [ ] §3.2 — login/me/logout cycle issues + clears the cookie.
- [ ] §3.3 — products=126 / bills=11 / categories=3 / staff=2.
- [ ] §4 — runtime smoke script confirms tenant isolation flag.
- [ ] §5.1 — insert `hira-sons` tenant row.
- [ ] §5.2 — backfill 332 rows across 12 tables, one tx each.
- [ ] §5.3 — re-inventory: 0 NULL-tenant rows on priority tables.
- [ ] §5.4 — Hira workflow still functional via new tenant cookie.
- [ ] §6 — flip `STRICT_TENANT=true`, restart, re-verify.
- [ ] §7 — onboard first additional tenant.
