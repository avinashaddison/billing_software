/**
 * Run default owner bootstrap
 * Usage: node scripts/dist/run-bootstrap.mjs
 */

import("../artifacts/api-server/src/lib/bootstrap.ts").then(async (m) => {
  await m.bootstrapDefaultOwner();
  console.log("Bootstrap complete");
  process.exit(0);
});
