# Client PC deployment guide

How to install Hira & Sons Billing on a client's Windows PC so:
- The cashier PC runs the app at `http://localhost:3000`
- Other devices on the shop WiFi can use it at `http://<PC-IP>:3000`
- The owner's phone can scan QR codes from anywhere via an HTTPS ngrok tunnel
- The app auto-starts when Windows boots

---

## ⚡ Fast path: one-line installer (recommended)

**Step 1.** Open a terminal **as Administrator**:
- Press **Win + X** → click **"Terminal (Admin)"** (Windows 11)
- OR press **Win**, type `cmd`, right-click → **"Run as administrator"**

**Step 2.** Paste this single line — it works in both PowerShell and Command Prompt:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/avinashaddison/billing_software/main/install.ps1 | iex"
```

The script auto-installs Node.js, Git, pnpm, ngrok (and updates ngrok), clones the repo to `C:\HiraBilling`, prompts for the values it needs (Neon URL, ngrok token, ngrok domain, optional Telegram/Cloudinary), builds the production bundle, sets up auto-start on boot, and launches the app.

**Total time:** ~5–8 minutes including downloads.

You'll only need to paste 4 values during the run (everything else is automatic):
1. The client's Neon Postgres URL
2. The client's ngrok authtoken
3. The client's ngrok static domain
4. (optional) Telegram bot token + chat ID, Cloudinary URL, store name

When it finishes, the cashier PC has `http://localhost:3000` and the phone has `https://<her-domain>.ngrok-free.dev` — both auto-start at boot.

If you prefer to do it step-by-step manually, follow the rest of this guide ↓.

---

## Manual path (step-by-step)

### Prerequisites (one-time, on the client PC)

1. **Node.js 24 LTS** — install from https://nodejs.org/
2. **Git for Windows** — install from https://git-scm.com/download/win
3. **pnpm** — `setup-client.bat` will install this for you
4. **ngrok** — install from https://ngrok.com/download (free signup gets a permanent static domain)

---

## Step 1: Get the code on the client PC

```powershell
cd C:\
git clone https://github.com/avinashaddison/billing_software.git HiraBilling
cd HiraBilling
```

The folder is now `C:\HiraBilling`.

---

## Step 2: Create the `.env` file

Copy the example file:
```powershell
copy .env.example .env
```

Open `.env` in Notepad and fill in:

| Variable | What to put |
|---|---|
| `NEON_DATABASE_URL` | The client's own Neon Postgres URL (create a new project at https://neon.tech if needed) |
| `DATABASE_URL` | Same as above (kept for compatibility) |
| `PORT` | `3000` |
| `TELEGRAM_BOT_TOKEN` | Optional, for sale alerts |
| `TELEGRAM_CHAT_ID` | Optional, the shop owner's Telegram chat ID |
| `CLOUDINARY_URL` | Optional, for product image + logo uploads |

**Important:** for a new client, create a **new Neon project** so their data is isolated from your dev database.

---

## Step 3: Run the setup script

Double-click `setup-client.bat` (or run it from a terminal). It will:

1. Verify Node.js + pnpm are installed
2. Install all dependencies
3. Push the database schema to Neon (creates tables if missing)
4. Build the production bundle

Takes ~3–5 minutes the first time.

---

## Step 4: Set up ngrok (for phone-camera scanning over HTTPS)

ngrok gives you a free HTTPS URL like `https://hira-sons.ngrok-free.app` that points to the client PC.

1. Sign up at https://ngrok.com/ (free, Google login works)
2. From the dashboard, copy your **Authtoken**
3. In a terminal:
   ```powershell
   ngrok config add-authtoken PASTE_TOKEN_HERE
   ```
4. (Recommended) Reserve a **free static domain** at https://dashboard.ngrok.com/domains so the URL never changes
5. Save the domain in Windows:
   ```powershell
   setx NGROK_DOMAIN your-name.ngrok-free.app
   ```
   (close and reopen any open terminals after running `setx`)

---

## Step 5: Test it

Double-click `start.bat`. Two windows open:

- **Billing Server** — the API + frontend on `http://localhost:3000`
- **Billing Tunnel** — ngrok, prints your HTTPS URL (e.g. `https://abcd.ngrok-free.app`)

Open the local URL on the cashier PC — log in, place a test bill.
Open the ngrok URL on the owner's phone — open `/scan`, the camera should work.

---

## Step 6: Auto-start on Windows boot

1. Press `Win + R`, type `shell:startup`, press Enter — opens the Startup folder
2. Right-click `start.bat` → **Create shortcut**
3. Drag the shortcut into the Startup folder
4. Restart the PC to confirm it boots cleanly

The app will now launch automatically every time the cashier signs in to Windows.

---

## Daily operation

- **Cashier PC** → bookmark `http://localhost:3000`
- **Owner phone** (anywhere with internet) → bookmark the ngrok HTTPS URL
- **Other PCs/tablets on shop WiFi** → `http://<PC-IP>:3000` (run `ipconfig` to find the IP)

To turn off: close both terminal windows.

---

## Troubleshooting

**"Port 3000 already in use"**
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**"ngrok auth required"** — re-run `ngrok config add-authtoken YOUR_TOKEN`.

**Phone camera not opening** — make sure you opened the **HTTPS** ngrok URL, not the local IP. Mobile browsers block camera access on plain HTTP.

**Receipt printer not printing** — the PC must be plugged into the printer via USB. Browser printing dialog appears when you click "Print Receipt"; pick the right printer.

**Database connection errors** — verify `NEON_DATABASE_URL` in `.env` and that the Neon project isn't suspended (free tier suspends after 5 days of inactivity, takes 1 second to wake up).

---

## Updating the software later

```powershell
cd C:\HiraBilling
git pull
pnpm install
pnpm run build:prod
```

Then restart `start.bat`.
