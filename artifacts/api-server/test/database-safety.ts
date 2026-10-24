import pg from "pg";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

// These changes are local to Vitest workers, never workspace Secrets.
// Original module imports can construct a pool, but can never use a real URL.
for (const key of [
  "NEON_DATABASE_URL", "DATABASE_URL", "PGHOST", "PGPORT", "PGUSER",
  "PGPASSWORD", "PGDATABASE", "PGSERVICE", "PGSERVICEFILE",
  "CLOUDINARY_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID", "R2_BUCKET", "TELEGRAM_CHAT_ID", "TELEGRAM_BOT_TOKEN",
]) {
  delete process.env[key];
}
process.env.DATABASE_URL = "postgresql://blocked.invalid/tests";
process.env.SESSION_SECRET = "isolated-test-session-secret-not-for-production";
delete process.env.DAILY_BOOK_BROWSER_FIXTURE;
delete process.env.MANUAL_BILLING_BROWSER_FIXTURE;

const originalConnect = pg.Client.prototype.connect;
Object.defineProperty(pg.Client.prototype, "connect", {
  configurable: true,
  writable: true,
  value: function (this: { host?: string }, ...args: unknown[]) {
    const host = this.host;
    const allowed = typeof host === "string"
      && dirname(resolve(host)) === resolve(tmpdir())
      && /^(daily-book-test-|manual-key-test-|shared-cart-test-)/.test(basename(host));
    if (!allowed) {
      const error = new Error("Test database safety: only isolated temporary Unix-socket databases are allowed");
      const callback = args[0];
      if (typeof callback === "function") {
        queueMicrotask(() => callback(error));
        return;
      }
      return Promise.reject(error);
    }
    return Reflect.apply(originalConnect, this, args);
  },
});
