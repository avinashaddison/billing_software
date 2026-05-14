# Email/Password Auth — Phase 2 Implementation Notes

> Companion doc to `DEPLOYMENT_RUNBOOK.md`. Read that first.

## What was added in this phase

A second, parallel auth flow — **email + password** — sitting next to the
existing **staffId + PIN** flow. Both use the same HttpOnly signed
`tenant_session` cookie, discriminated by a new `kind: "pin" | "email"`
field in the cookie payload.

### Schema additions

- New table `auth_users` (`lib/db/migrations/0002_auth_users.sql`,
  idempotent, applied to live DB):

  ```
  id                     uuid PK DEFAULT gen_random_uuid()
  tenant_id              text NULL              -- migration-compat (NULL = legacy)
  email                  text NOT NULL
  password_hash          text NOT NULL          -- bcrypt (10 rounds)
  role                   text NOT NULL DEFAULT 'cashier'
  is_active              boolean NOT NULL DEFAULT true
  last_login_at          timestamptz
  password_reset_token   text
  password_reset_expires timestamptz
  created_at             timestamptz NOT NULL DEFAULT now()
  updated_at             timestamptz NOT NULL DEFAULT now()
  ```

- Indexes:
  - `auth_users_pkey` (PK)
  - `auth_users_tenant_idx` btree on `tenant_id`
  - `auth_users_email_per_tenant` **UNIQUE** on
    `(COALESCE(tenant_id, ''), LOWER(email))` — case-insensitive,
    per-tenant. NULL-tenant rows share a single bucket. Allows the same
    email to exist in two different tenants but never twice within one.
  - `auth_users_reset_token_idx` partial index `WHERE token IS NOT NULL`
    for the future password-reset flow.

### Cookie payload extension

```json
{
  "t":   "tenant-slug-or-null",
  "s":   "staff_profiles.id-or-null",     // PIN sessions
  "u":   "auth_users.id-or-null",         // email sessions
  "k":   "pin" | "email" | null,
  "iat": <unix-ms>
}
```

Older cookies missing `k`/`u` are transparently treated as `kind="pin"`
(if they carry an `s`). No active session is invalidated by the upgrade.

### Endpoints

| Method | Path | Auth | License-gated? |
|---|---|---|---|
| POST | `/api/auth/login-email`           | public | **No** (whitelisted) |
| POST | `/api/auth/logout`                | any   | No |
| GET  | `/api/auth/me`                    | any   | No |
| POST | `/api/auth/users`                 | owner/admin | **Yes** |
| GET  | `/api/auth/users`                 | owner/admin | Yes |
| GET  | `/api/auth/users/:id`             | owner/admin | Yes |
| PATCH| `/api/auth/users/:id`             | owner/admin | Yes |
| POST | `/api/auth/users/:id/password`    | owner/admin | Yes |
| POST | `/api/auth/users/:id/disable`     | owner/admin | Yes |
| POST | `/api/auth/users/:id/enable`      | owner/admin | Yes |

**Admin gate** (`requireAdmin` in `routes/auth.ts`) accepts:

- an `auth_users` row with `role IN ('owner','admin')` in the caller's
  tenant (email session), OR
- a `staff_profiles` row with `role = 'owner'` in the caller's tenant
  (PIN session — covers the legacy Hira owner).

### Existing PIN flow — fully preserved

- `POST /api/auth/login` unchanged: same JSON shape, same lockout,
  same auto-bcrypt upgrade.
- Cookie now carries `kind="pin"` instead of being implicit.
- `GET /api/auth/me` and `POST /api/auth/logout` work for either
  session type. PIN sessions still return the per-resource
  `permissions` map; email sessions return `permissions: {}` and rely
  on role-based access at the route layer.

## Verification (against live DB) — `scripts/src/auth-email-smoke.mjs`

26 assertions, all green:

**Public surface (via live API on a sandboxed port):**

- login-email with correct password → 200, cookie set, returns
  `{ kind, id, email, role, tenantId }`.
- `/auth/me` with cookie → 200, identifies email session.
- wrong password → 401.
- unknown email → 401 (constant-time-ish: always runs a bcrypt compare
  so timing doesn't leak which emails exist).
- malformed email → 400.
- `/auth/logout` → 200 + cleared cookie.
- `/auth/me` after logout → 401.
- `POST /auth/users` on an installation with an invalid license signature
  → 402 (admin endpoints **are** license-gated, as required for a SaaS
  install — login itself stays available so the operator can see the
  expired-license screen).

**Tenant isolation on `auth_users`:**

- `tenantId=null` sees only NULL-tenant rows.
- `tenantId='X'` with `STRICT_TENANT=off` sees own + NULL (OR-IS-NULL).
- `tenantId='X'` with `STRICT_TENANT=on` sees only own (legacy hidden).
- Cross-tenant: `t1` and `t2` never see each other's users.

**Email uniqueness:**

- Case-insensitive duplicate inside one tenant rejected (`23505`).
- Same email allowed inside a different tenant.

**Legacy:**

- `POST /api/auth/login` (PIN flow) still executes — 401 on wrong PIN,
  no crash, lockout counter increments (and gets reset by the smoke
  test). End-to-end the legacy Hira workflow is untouched.

**Test side effects:** every row inserted by the smoke test is removed
on cleanup. `failed_attempts` counter on the real Owner is reset to 0.
**No production data was modified.**

## Operating instructions

### 1. Deploy

Same as Phase 1 — no new env vars beyond `SESSION_SECRET` (already
required by Phase 1). The 0002 migration is **already applied** to the
live DB; re-running is a no-op (every statement uses `IF NOT EXISTS`).

For other installs:
```bash
DATABASE_URL=<...> node scripts/src/auth-users-migrate-apply.mjs
```

### 2. Create the first email-login user(s)

Until the vendor admin panel ships, seed admin rows directly. Use the
existing `gen-key.bat`-style approach or a one-off psql:

```bash
# 1. Generate the bcrypt hash on your workstation:
node -e "import('bcryptjs').then(b=>b.default.hash('your-real-password',10).then(console.log))"
# 2. Insert (no quotes around the tenant_id when it's NULL — leave it bare):
psql "$DATABASE_URL" <<SQL
INSERT INTO auth_users (tenant_id, email, password_hash, role)
VALUES ('hira-sons', 'owner@hira-sons.example.com', '<bcrypt-hash>', 'owner');
SQL
```

> If you haven't created the `hira-sons` tenant row yet (still in
> Phase 1's pre-backfill state), set `tenant_id` to `NULL` instead. The
> session cookie will carry `tenantId=null` and the user behaves
> exactly like the legacy Hira owner.

### 3. Pointing the frontend at email login

The frontend keeps working as-is during this phase — none of the
existing PIN screens have changed, none of the existing `/api/staff` or
`/api/auth/login` calls have changed. To wire up email login on the
frontend:

1. Add a new login screen calling `POST /api/auth/login-email`
   with `credentials: "include"`.
2. Persist nothing — the HttpOnly cookie is the session. Drop the
   localStorage staffId echo for email sessions.
3. Call `GET /api/auth/me` on app boot to rehydrate the session.

## Files touched in this phase

### New
- `lib/db/src/schema/auth_users.ts`
- `lib/db/migrations/0002_auth_users.sql`
- `artifacts/api-server/src/routes/auth.ts`
- `scripts/src/auth-users-migrate-apply.mjs`
- `scripts/src/auth-email-smoke.mjs`

### Edited
- `lib/db/src/schema/index.ts` — export `auth_users`.
- `artifacts/api-server/src/middlewares/tenant.ts` — extended cookie
  payload with `kind` + `userId`, preserves v1 cookie format.
- `artifacts/api-server/src/routes/staff.ts` — `login` now stamps
  `kind: "pin"`, `/auth/me` routes email sessions to `auth_users`.
- `artifacts/api-server/src/routes/index.ts` — mount the new auth router.
- `artifacts/api-server/src/lib/license.ts` — whitelist `/auth/login-email`
  so unlicensed installs can still display a useful login screen.

## Known gaps / backlog

- **Forgot-password flow** is wired up at the column level
  (`password_reset_token`, `password_reset_expires`) but not exposed as
  endpoints yet — needs an email integration (SendGrid/Resend) to be
  meaningful. Schema is ready.
- **Vendor admin UI** for "create tenant / create owner / disable
  account" not yet built. The backend endpoints are all in place;
  this is a frontend task.
- **2FA / TOTP** — backlog. Schema would need a `totp_secret` column;
  another phase.
- **Audit log** of admin actions (who created/disabled which user).
  Backlog.
