import { Router, type IRouter } from "express";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();
const exec = promisify(execFile);

/* Walk up to repo root (the one containing pnpm-workspace.yaml) */
function findRepoRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = path.dirname(__filename);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();
const isWin     = process.platform === "win32";

/* ───── 5-minute cache so we don't hit GitHub on every poll ───── */
interface CheckResult {
  updateAvailable: boolean;
  currentSha:      string | null;
  remoteSha:       string | null;
  behindBy:        number;
  lastMessage:     string | null;
  checkedAt:       string;
  error?:          string;
}
let cached: CheckResult | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60_000;

async function checkForUpdates(): Promise<CheckResult> {
  try {
    const cwd = REPO_ROOT;
    const { stdout: localOut } = await exec("git", ["rev-parse", "HEAD"], { cwd });
    const localSha = localOut.trim();

    // Fetch remote ref without merging — short timeout so an offline shop
    // doesn't wait forever
    await exec("git", ["fetch", "--quiet", "origin", "main"], { cwd, timeout: 15_000 });

    const { stdout: remoteOut } = await exec("git", ["rev-parse", "origin/main"], { cwd });
    const remoteSha = remoteOut.trim();

    const { stdout: behindOut } = await exec(
      "git", ["rev-list", "--count", `${localSha}..${remoteSha}`], { cwd },
    );
    const behindBy = parseInt(behindOut.trim(), 10) || 0;

    let lastMessage: string | null = null;
    if (behindBy > 0) {
      const { stdout: msgOut } = await exec(
        "git", ["log", "-1", "--pretty=%s", remoteSha], { cwd },
      );
      lastMessage = msgOut.trim();
    }

    return {
      updateAvailable: behindBy > 0,
      currentSha:      localSha.slice(0, 7),
      remoteSha:       remoteSha.slice(0, 7),
      behindBy,
      lastMessage,
      checkedAt:       new Date().toISOString(),
    };
  } catch (err) {
    return {
      updateAvailable: false,
      currentSha:      null,
      remoteSha:       null,
      behindBy:        0,
      lastMessage:     null,
      checkedAt:       new Date().toISOString(),
      error: err instanceof Error ? err.message : "git check failed",
    };
  }
}

/* ───── GET /api/updates/check ─────
 * Admin-only: this spawns `git fetch`, and /install below runs a full
 * pull+install+schema-push+build. A non-owner must never reach either. */
router.get("/updates/check", requireAdmin, async (req, res): Promise<void> => {
  const force = req.query.force === "1";
  if (!force && cached && Date.now() - cachedAt < CACHE_MS) {
    res.json(cached); return;
  }
  cached = await checkForUpdates();
  cachedAt = Date.now();
  res.json(cached);
});

/* ───── In-progress install state ───── */
type InstallStage = "idle" | "pulling" | "installing" | "schema" | "building" | "done" | "failed";
interface InstallState {
  stage:   InstallStage;
  log:     string;
  error?:  string;
  started: string | null;
  ended:   string | null;
}
let installState: InstallState = { stage: "idle", log: "", started: null, ended: null };

function append(line: string): void {
  installState.log += line + "\n";
  if (installState.log.length > 20_000) {
    installState.log = installState.log.slice(-15_000);
  }
}

async function runStep(stage: InstallStage, cmd: string, args: string[]): Promise<void> {
  installState.stage = stage;
  append(`\n──── ${stage.toUpperCase()} ────`);
  append(`$ ${cmd} ${args.join(" ")}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: REPO_ROOT, shell: isWin });
    child.stdout?.on("data", (d) => append(String(d).trimEnd()));
    child.stderr?.on("data", (d) => append(String(d).trimEnd()));
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${stage} exited ${code}`)));
  });
}

/* ───── POST /api/updates/install — run update.bat steps in sequence ───── */
router.post("/updates/install", requireAdmin, async (_req, res): Promise<void> => {
  if (installState.stage !== "idle" && installState.stage !== "done" && installState.stage !== "failed") {
    res.status(409).json({ error: "An update is already running", state: installState });
    return;
  }

  installState = { stage: "pulling", log: "", started: new Date().toISOString(), ended: null };
  res.status(202).json({ ok: true, state: installState });

  // Run in background — request has already returned
  (async () => {
    try {
      await runStep("pulling",    "git",  ["pull", "--ff-only"]);
      await runStep("installing", "pnpm", ["install", "--frozen-lockfile"]);
      await runStep("schema",     "pnpm", ["--filter", "@workspace/db", "run", "push"]);
      await runStep("building",   "pnpm", ["run", "build:prod"]);
      installState.stage = "done";
      installState.ended = new Date().toISOString();
      append("\n✓ Update complete. Restart the server to load the new code.");
      // Bust the check cache so the UI immediately reflects "up to date"
      cached = null;
    } catch (err) {
      installState.stage = "failed";
      installState.error = err instanceof Error ? err.message : "unknown";
      installState.ended = new Date().toISOString();
      append(`\n✗ Update failed: ${installState.error}`);
      logger.error({ err }, "update install failed");
    }
  })();
});

/* ───── GET /api/updates/status — poll for progress ───── */
router.get("/updates/status", (_req, res): void => {
  res.json(installState);
});

export default router;
