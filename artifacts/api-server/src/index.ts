import app from "./app";
import { logger } from "./lib/logger";
import { startDailyReportScheduler } from "./lib/scheduler";
import { bootstrapDefaultOwner } from "./lib/bootstrap";
import { runBootMigrations } from "./lib/migrate";
import { pool } from "@workspace/db";
import { runtimeReadiness, verifyDatabase } from "./lib/runtime-readiness";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, "0.0.0.0", async () => {
  logger.info({ port }, "Server listening");

  const startupDeadline = setTimeout(() => {
    logger.fatal("Startup did not become ready within 60 seconds");
    shutdown(1);
  }, 60_000);
  startupDeadline.unref();

  try {
    await runBootMigrations();
    await verifyDatabase();
    await bootstrapDefaultOwner();
    if (shuttingDown) return;
    runtimeReadiness.initialized();
    startDailyReportScheduler();
    logger.info("Application ready");
  } catch (err) {
    logger.fatal({ err }, "Startup failed; refusing to serve an unready application");
    shutdown(1);
  } finally {
    clearTimeout(startupDeadline);
  }
});

// Bound slow clients, allow normal uploads, and drain in-flight transactions
// before disconnecting the database during a deployment/restart.
server.requestTimeout = 60_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 5_000;
let shuttingDown = false;
function shutdown(code: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  runtimeReadiness.drain();
  logger.info({ code }, "Draining server");
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exit(code || 1);
  }, 15_000);
  deadline.unref();
  server.close(() => {
    void pool.end().then(() => {
      clearTimeout(deadline);
      process.exit(code);
    }).catch(() => process.exit(1));
  });
}
server.on("error", (err) => {
  logger.fatal({ err }, "HTTP server failed");
  shutdown(1);
});
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
// Expected idle Postgres socket errors are handled by the pool itself.
// Unknown process-level exceptions must not leave financial writes running
// in a potentially inconsistent process.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  shutdown(1);
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection");
  shutdown(1);
});
