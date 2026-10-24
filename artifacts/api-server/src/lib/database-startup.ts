type StartupOperations = {
  migrate: () => Promise<void>;
  verify: () => Promise<unknown>;
  bootstrap: () => Promise<void>;
};

/** A live-connected development preview must not run production maintenance. */
export function shouldStartScheduledJobs(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "production" || env.ENABLE_DEVELOPMENT_SCHEDULERS === "true";
}

/**
 * Existing databases are verified, never changed implicitly at startup.
 * Schema changes and development account creation require separate opt-ins.
 */
export async function initializeDatabase(
  operations: StartupOperations,
  env: Record<string, string | undefined>,
): Promise<void> {
  if (env.RUN_DB_MIGRATIONS === "true") await operations.migrate();
  await operations.verify();
  if (env.NODE_ENV !== "production" && env.BOOTSTRAP_DEFAULT_OWNER === "true") {
    await operations.bootstrap();
  }
}
