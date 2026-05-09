/**
 * License key generator.
 *
 *   pnpm --filter @workspace/scripts run gen-license -- \
 *     --shop "Hira & Sons Gift Shop" \
 *     --expiry 2027-05-09 \
 *     --edition standard
 *
 * Or for a perpetual license:
 *
 *   pnpm --filter @workspace/scripts run gen-license -- \
 *     --shop "Hira & Sons Gift Shop" \
 *     --expiry perpetual
 *
 * Keep this script + LICENSE_SECRET private. Never commit a real secret.
 */

import crypto from "node:crypto";

const SECRET =
  process.env["LICENSE_SECRET"] ||
  "counter-billing-license-v1-do-not-leak-this-to-customers";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const shop    = arg("shop");
const expiry  = arg("expiry") ?? "perpetual";
const edition = arg("edition") ?? "standard";

if (!shop) {
  console.error("Usage: gen-license --shop <name> [--expiry YYYY-MM-DD|perpetual] [--edition standard|pro]");
  process.exit(1);
}

if (expiry !== "perpetual" && Number.isNaN(new Date(expiry).getTime())) {
  console.error(`Invalid --expiry value: "${expiry}". Use YYYY-MM-DD or "perpetual".`);
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
console.log("  COUNTER LICENSE KEY");
console.log("=".repeat(72));
console.log(`  Shop    : ${payload.shop}`);
console.log(`  Edition : ${payload.edition}`);
console.log(`  Expiry  : ${payload.expiry}`);
console.log(`  Issued  : ${payload.issued}`);
console.log("=".repeat(72));
console.log("");
console.log(key);
console.log("");
console.log("Paste this into the customer's .env as:");
console.log(`  LICENSE_KEY="${key}"`);
console.log("");
