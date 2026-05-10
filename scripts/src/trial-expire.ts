/**
 * Dev-only: backdate the trial start so the trial_expired UI is visible
 * for screenshots / QA. Re-run with --reset to put first_boot_at back to
 * "now" (giving you the full 14 days again).
 *
 *   pnpm --filter @workspace/scripts run trial-expire           # expire it
 *   pnpm --filter @workspace/scripts run trial-expire -- --reset
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(__dirname, "../../.env"));

const { db, licenseStatusTable } = await import("@workspace/db");
const reset = process.argv.includes("--reset");

const targetDate = reset
  ? new Date()                                  // back to "now" → full 14 days
  : new Date(Date.now() - 30 * 86_400_000);     // 30 days ago → trial_expired

await db
  .insert(licenseStatusTable)
  .values({ id: 1, firstBootAt: targetDate })
  .onConflictDoUpdate({
    target: licenseStatusTable.id,
    set:    { firstBootAt: targetDate },
  });

console.log("");
console.log(reset
  ? `✓ Trial reset — first_boot_at set to ${targetDate.toISOString()} (full 14 days)`
  : `✓ Trial backdated — first_boot_at set to ${targetDate.toISOString()} (≈30 days ago)`,
);
console.log("");
console.log("Now refresh the License page and click Re-check.");
console.log("");
process.exit(0);
