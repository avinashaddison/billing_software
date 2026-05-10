/**
 * License key generator — interactive when run with no flags.
 *
 *   Interactive (recommended):
 *     pnpm --filter @workspace/scripts run gen-license
 *
 *   Scripted:
 *     pnpm --filter @workspace/scripts run gen-license -- \
 *       --shop "Hira & Sons Gift Shop" \
 *       --expiry 2027-05-09 \
 *       --edition standard
 *
 * Auto-creates and persists LICENSE_SECRET in .license-secret on first run
 * (gitignored — never commit it).
 */

import crypto         from "node:crypto";
import fs             from "node:fs";
import path           from "node:path";
import readline       from "node:readline";
import { fileURLToPath } from "node:url";
import { spawnSync }  from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SECRET_FILE = path.join(REPO_ROOT, ".license-secret");

function loadSecret(): string {
  // Priority 1: LICENSE_SECRET env var (used by the api-server runtime too)
  const envSecret = process.env["LICENSE_SECRET"]?.trim();
  if (envSecret) return envSecret;

  // Priority 2: .license-secret file in repo root (gitignored)
  if (fs.existsSync(SECRET_FILE)) {
    const fromFile = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (fromFile) return fromFile;
  }

  // Priority 3: generate one and save it
  const fresh = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(SECRET_FILE, fresh, { encoding: "utf8", mode: 0o600 });
  console.log("");
  console.log("⚠️  No LICENSE_SECRET found — generated a fresh one and saved to:");
  console.log(`     ${SECRET_FILE}`);
  console.log("     Keep this file PRIVATE. Use the same value on every customer's .env.");
  console.log("");
  return fresh;
}

const SECRET = loadSecret();

/* ───── flag parsing ───── */
function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

let shop    = arg("shop");
let expiry  = arg("expiry");
let edition = arg("edition");

/* ───── interactive prompt fallback ───── */
async function prompt(question: string, def?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = def ? ` (${def})` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (ans) => {
      rl.close();
      resolve(ans.trim() || def || "");
    });
  });
}

(async () => {
  if (!shop) {
    console.log("");
    console.log("=".repeat(60));
    console.log("  COUNTER LICENSE GENERATOR");
    console.log("=".repeat(60));
    shop = await prompt("Shop name (e.g. Hira & Sons Gift Shop)");
    if (!shop) { console.error("✗ Shop name is required."); process.exit(1); }
  }
  if (!expiry) {
    expiry = await prompt('Expiry date (YYYY-MM-DD or "perpetual" for lifetime)', "perpetual");
  }
  if (!edition) edition = "pro";

  if (expiry !== "perpetual" && Number.isNaN(new Date(expiry).getTime())) {
    console.error(`✗ Invalid expiry "${expiry}". Use YYYY-MM-DD or "perpetual".`);
    process.exit(1);
  }

  const payload = {
    shop,
    expiry,
    issued: new Date().toISOString().slice(0, 10),
    edition,
  };

  const b64  = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  const key  = `${b64}.${hmac}`;

  console.log("");
  console.log("=".repeat(72));
  console.log("  ✓ LICENSE KEY GENERATED");
  console.log("=".repeat(72));
  console.log(`  Shop    : ${payload.shop}`);
  console.log(`  Edition : ${payload.edition}`);
  console.log(`  Expiry  : ${payload.expiry}`);
  console.log(`  Issued  : ${payload.issued}`);
  console.log("=".repeat(72));
  console.log("");
  console.log(key);
  console.log("");

  // Try to copy to clipboard (Windows clip / macOS pbcopy / Linux xclip)
  try {
    const isWin = process.platform === "win32";
    const cmd   = isWin ? "clip" : process.platform === "darwin" ? "pbcopy" : "xclip";
    const args  = isWin || process.platform === "darwin" ? [] : ["-selection", "clipboard"];
    const r = spawnSync(cmd, args, { input: key, encoding: "utf8" });
    if (r.status === 0) {
      console.log("📋 Copied to your clipboard — just paste in the customer's License page.");
    }
  } catch { /* clipboard not available — never mind */ }

  console.log("");
  console.log("How the customer activates it:");
  console.log("  1. Open the app  →  sidebar  →  License Key button");
  console.log("  2. Paste the key into the Activate field");
  console.log("  3. Click Activate");
  console.log("");
})();
