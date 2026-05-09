import { Router, type IRouter } from "express";
import { getLicenseStatus, invalidateLicenseCache } from "../lib/license";

const router: IRouter = Router();

/**
 * GET /api/license/status
 * Always reachable — even when the license is invalid — so the UI can render
 * a "License expired / enter your key" screen instead of a blank 402.
 */
router.get("/license/status", async (_req, res): Promise<void> => {
  const status = await getLicenseStatus();
  res.json({
    valid:         status.valid,
    mode:          status.mode,
    shop:          status.payload?.shop ?? null,
    edition:       status.payload?.edition ?? null,
    expiry:        status.payload?.expiry ?? null,
    daysRemaining: status.daysRemaining ?? null,
    trialEndsAt:   status.trialEndsAt ?? null,
    reason:        status.reason ?? null,
  });
});

/**
 * POST /api/license/refresh — clear the in-memory cache so a freshly-edited
 * .env LICENSE_KEY is picked up without restarting the server.
 */
router.post("/license/refresh", async (_req, res): Promise<void> => {
  invalidateLicenseCache();
  const status = await getLicenseStatus(true);
  res.json({ ok: true, status });
});

export default router;
