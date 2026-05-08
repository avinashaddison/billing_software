import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // .env optional
}

const isWin = process.platform === "win32";
const pnpm = isWin ? "pnpm.cmd" : "pnpm";

function launch(label: string, color: number, env: Record<string, string>): ChildProcess {
  const child = spawn(
    pnpm,
    ["--filter", env.WORKSPACE_PKG, "run", "dev"],
    {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["inherit", "pipe", "pipe"],
      shell: isWin,
    },
  );
  const prefix = (data: Buffer) =>
    process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${data.toString()}`);
  child.stdout?.on("data", prefix);
  child.stderr?.on("data", prefix);
  return child;
}

const api = launch("api", 36, {
  WORKSPACE_PKG: "@workspace/api-server",
  PORT: "8080",
  NODE_ENV: "development",
});

const web = launch("web", 32, {
  WORKSPACE_PKG: "@workspace/toy-mall",
  PORT: "5173",
  API_PORT: "8080",
  NODE_ENV: "development",
});

let exiting = false;
function cleanup(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const p of [api, web]) {
    if (!p.killed) p.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));
api.on("exit", (code) => {
  console.log(`[api] exited (${code ?? 0})`);
  cleanup(code ?? 0);
});
web.on("exit", (code) => {
  console.log(`[web] exited (${code ?? 0})`);
  cleanup(code ?? 0);
});
