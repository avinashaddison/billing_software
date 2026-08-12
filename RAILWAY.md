# Deploying to Railway

One Railway service runs the whole app. The Express server serves the API **and**
the compiled React app on the same port, so there is no separate frontend
service, no CORS setup, and no second domain to manage.

The database is **not** part of this deploy. It stays wherever it is now (Neon),
and Railway connects to it over the network. Nothing is copied or moved.

---

## 1. Put the code on GitHub

Railway deploys from a Git repository. Push this project to a GitHub repo first.

## 2. Create the service

1. Railway dashboard → **New Project** → **Deploy from GitHub repo**.
2. Pick the repo. Leave the root directory as `/` — this is a monorepo and the
   build script already knows where everything lives.
3. Railway reads `railway.json` in the repo root, so the build command, start
   command and health check are already set. Do not fill them in by hand.

## 3. Set the variables

Railway → your service → **Variables**. `PORT` is injected by Railway
automatically; do not set it yourself.

### Required — the app will not start or will not work without these

| Variable | What to put in it |
| --- | --- |
| `NODE_ENV` | `production` — **this one is easy to forget.** Without it the server runs but serves no web pages, only the API. |
| `DATABASE_URL` | Your full Postgres connection string. The same one the app uses today. (`NEON_DATABASE_URL` also works and is used first if both are set.) |
| `SESSION_SECRET` | A long random string. It signs the login cookies. Changing it later logs every shop out. |

### Optional — only if you use that feature

| Variable | Feature |
| --- | --- |
| `STORE_NAME` | Name shown on Telegram messages. Defaults to "Toy Mall". |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Daily sales report to Telegram — **and** a valid destination for the nightly database backup on its own. |
| `DAILY_REPORT_HOUR` | Hour (IST) the daily report is sent. Default 21. |
| `CLOUDINARY_URL`, `CLOUDINARY_FOLDER` | Product image uploads. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Stores the nightly backup in Cloudflare R2. All four are needed for R2 specifically. |
| `BACKUP_HOUR` | Hour (IST) the nightly backup runs, at HH:30. Default 2. |
| `BACKUP_TELEGRAM_CHAT_ID` | Sends backup files to a different chat than the sales report. Falls back to `TELEGRAM_CHAT_ID`. |
| `R2_BACKUP_KEEP` | How many backups to keep in R2 before deleting the oldest. |
| `CORS_ORIGIN` | Only if you later split the frontend onto a different domain. Leave unset for this single-service setup. |
| `SESSION_IDLE_DAYS` | How long a device stays signed in without use. |
| `PRICE_GUARD_MODE`, `PRICE_GUARD_MAX_DISCOUNT_PCT` | Discount ceiling enforcement. |
| `STRICT_TENANT` | Leave unset or `false`. Setting it `true` hides legacy rows that have no shop attached. |

## 4. Generate a domain

Service → **Settings** → **Networking** → **Generate Domain**. Railway serves it
over HTTPS, which the login cookies require.

---

## What happens on each deploy

1. Railway installs dependencies with pnpm (version pinned in `package.json`,
   Node version pinned in `.node-version`).
2. `pnpm run build:prod` builds the React app, then bundles the server.
3. `node artifacts/api-server/dist/index.mjs` starts it.
4. On boot the server applies any pending database migrations itself. They are
   additive and safe to re-run, so a redeploy against an already-migrated
   database changes nothing.
5. Railway waits for `/api/healthz` to answer before sending traffic, and
   restarts the service up to 10 times if it crashes.

## If the deploy fails

- **Build fails on install** — the lockfile is out of date. Run `pnpm install`
  locally, commit `pnpm-lock.yaml`.
- **Health check times out** — usually a missing or wrong `DATABASE_URL`. Open
  the deploy logs; the server logs the reason on startup.
- **Site loads the API but shows no pages** — `NODE_ENV` is not set to
  `production`.
- **Everyone gets logged out after a deploy** — `SESSION_SECRET` changed or was
  not set, so Railway generated a different one. Set it explicitly and keep it.

## Note on backups

The nightly backup needs **at least one destination**, and there are two:

- **Telegram** (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) — the backup file is
  sent to the chat. This works on its own, with no R2 account.
- **Cloudflare R2** (the four `R2_*` variables) — durable off-site storage with
  automatic pruning of old copies.

Set both and the backup goes to both; it is only treated as failed if every
destination fails. Set neither and the server says so loudly at startup rather
than pretending it has backups.

The Health page in the admin panel reports R2 specifically, so with
Telegram-only backups it will still say off-site storage is not configured.
