import { Router, type IRouter } from "express";
import { getLicenseStatus, invalidateLicenseCache, verifyLicense, setStoredLicenseKey, type LicenseStatus } from "../lib/license";

const router: IRouter = Router();

/** Flatten the internal LicenseStatus into the wire format the UI consumes. */
function toWireFormat(status: LicenseStatus) {
  return {
    valid:         status.valid,
    mode:          status.mode,
    shop:          status.payload?.shop ?? null,
    edition:       status.payload?.edition ?? null,
    expiry:        status.payload?.expiry ?? null,
    issued:        status.payload?.issued ?? null,
    daysRemaining: status.daysRemaining ?? null,
    trialEndsAt:   status.trialEndsAt ?? null,
    reason:        status.reason ?? null,
  };
}

/**
 * GET /api/license/status
 * Always reachable — even when the license is invalid — so the UI can render
 * a "License expired / enter your key" screen instead of a blank 402.
 */
router.get("/license/status", async (_req, res): Promise<void> => {
  const status = await getLicenseStatus();
  res.json(toWireFormat(status));
});

/**
 * POST /api/license/refresh — clear the in-memory cache so a freshly-edited
 * .env LICENSE_KEY is picked up without restarting the server.
 */
router.post("/license/refresh", async (_req, res): Promise<void> => {
  invalidateLicenseCache();
  const status = await getLicenseStatus(true);
  res.json({ ok: true, status: toWireFormat(status) });
});

/**
 * POST /api/license/activate
 * Body: { key: string }
 * Validates the key and stores it in the DB so it survives reinstalls and
 * can be set without editing .env.
 */
router.post("/license/activate", async (req, res): Promise<void> => {
  const key = String(req.body?.key ?? "").trim();
  if (!key) { res.status(400).json({ error: "License key is required" }); return; }

  const result = verifyLicense(key);
  if (!result.ok) {
    res.status(400).json({ error: result.reason || "Invalid license key" });
    return;
  }

  // Reject expired keys at activation time so the user gets a clear error
  // instead of a deceptive "Activated!" toast followed by a locked UI.
  if (result.payload.expiry !== "perpetual") {
    const expiry = new Date(result.payload.expiry);
    if (Number.isFinite(expiry.getTime()) && expiry.getTime() < Date.now()) {
      res.status(400).json({ error: `License expired ${result.payload.expiry}` });
      return;
    }
  }

  try {
    await setStoredLicenseKey(key);
    const status = await getLicenseStatus(true);
    res.json({ ok: true, status: toWireFormat(status) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save key" });
  }
});

/**
 * DELETE /api/license/remove — clear the in-app license key.
 * After this, verification falls back to the .env LICENSE_KEY (if any),
 * else the trial window.
 */
router.delete("/license/remove", async (_req, res): Promise<void> => {
  try {
    await setStoredLicenseKey(null);
    const status = await getLicenseStatus(true);
    res.json({ ok: true, status: toWireFormat(status) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not remove key" });
  }
});

export default router;
