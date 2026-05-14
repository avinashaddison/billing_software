import app from "./app";
import { logger } from "./lib/logger";
import { startDailyReportScheduler } from "./lib/scheduler";
import { bootstrapDefaultOwner } from "./lib/bootstrap";
import { runBootMigrations } from "./lib/migrate";

// Neon free-tier idle-suspends sockets, which fires async pg-client errors
// AFTER the originating query handler has already returned. Without these
// guards a transient ECONNRESET kills the whole process — and the cashier
// PC has nothing to fall back on. Log loudly and keep serving.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — keeping process alive");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection — keeping process alive");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  /* Apply additive tenant + auth-user migrations to the live DB.
     Idempotent — every statement is `IF NOT EXISTS`. Already-migrated
     databases are unaffected. */
  try {
    await runBootMigrations();
  } catch (err) {
    logger.error({ err }, "Boot migrations failed — server will keep serving but DB schema may be stale");
  }

  startDailyReportScheduler();

  // First-run: if the DB has no staff yet, create a default Owner so the
  // operator can log in. No-op on already-seeded databases.
  await bootstrapDefaultOwner();
});
