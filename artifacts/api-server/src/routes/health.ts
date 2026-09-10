import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getBackupFreshness } from "../lib/backup-scheduler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Backup freshness for an OUTSIDE uptime monitor (UptimeRobot, Better Stack,
 * a cron on another box…). Public and deliberately minimal — a timestamp and
 * a verdict, nothing about the data — because the whole point is to be
 * checkable by something that does not depend on this process being alive
 * and alert-capable. 200 while the newest successful backup is within the
 * expected window, 503 otherwise, so any monitor that understands HTTP
 * status codes works with zero configuration.
 */
router.get("/healthz/backup", async (_req, res) => {
  try {
    const fresh = await getBackupFreshness();
    res.status(fresh.state === "ok" ? 200 : 503).json({
      status:           fresh.state,
      lastSuccessAt:    fresh.lastSuccessAt,
      ageMinutes:       fresh.ageMinutes,
      thresholdMinutes: fresh.thresholdMinutes,
    });
  } catch (err) {
    logger.error({ err }, "backup freshness check failed");
    res.status(503).json({ status: "unknown", error: "could not read the backup ledger" });
  }
});

export default router;
