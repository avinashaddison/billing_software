import { defineConfig } from "drizzle-kit";
import path from "path";

// Load workspace-root .env so `pnpm --filter @workspace/db run push` works
// outside of Replit (which injects env vars automatically).
try {
  process.loadEnvFile(path.join(__dirname, "../../.env"));
} catch {
  // .env is optional — if it's missing, env vars must come from the shell.
}

const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
