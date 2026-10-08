/**
 * Read-only HTTP checks against the real production app configuration.
 * No migrations, schedulers, login attempts with credentials, or data writes.
 * Requires the frontend build and the existing database/session secrets.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { pool } from "@workspace/db";
import app from "../app";
import { runtimeReadiness } from "../lib/runtime-readiness";

assert.equal(process.env.NODE_ENV, "production", "Run with NODE_ENV=production");
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;

try {
  let res = await fetch(`${base}/api/readyz`);
  assert.equal(res.status, 503, "Not ready before initialization");
  assert.equal(res.headers.get("cache-control"), "no-store");
  runtimeReadiness.initialized();
  res = await fetch(`${base}/api/readyz`);
  assert.equal(res.status, 200, "Existing database/schema must be reachable");
  assert.deepEqual(await res.json(), { status: "ok" });

  res = await fetch(`${base}/login`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(res.headers.get("cache-control"), "no-cache");
  const csp = res.headers.get("content-security-policy") ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /fonts\.googleapis\.com/);
  const html = await res.text();
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert(asset, "Compiled JavaScript entry must exist");
  const js = await fetch(`${base}${asset}`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get("cache-control") ?? "", /immutable/);

  res = await fetch(`${base}/api/auth/me`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(res.status, 401, "Anonymous session remains denied");
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");

  res = await fetch(`${base}/api/auth/login-email`, {
    method: "POST",
    headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(res.status, 403, "Cross-origin browser writes must be rejected");
  res = await fetch(`${base}/api/auth/login-email`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(res.status, 400, "Same-origin writes reach normal input validation");

  runtimeReadiness.drain();
  res = await fetch(`${base}/api/readyz`);
  assert.equal(res.status, 503);
  res = await fetch(`${base}/api/auth/me`);
  assert.equal(res.status, 503, "Draining requests must fail safely");
  console.log("Production HTTP smoke checks passed (read-only; no customer data modified).");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
