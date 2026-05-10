import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { generateLicense, verifyLicense } from "../lib/license";
import { listLicenses, appendLicense, markRevoked, deleteRecord, type LicenseRecord } from "../lib/admin-store";

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"]?.trim();

/**
 * Gate every admin route:
 *   1. If ADMIN_PASSWORD env is unset → 404 (admin features hidden completely
 *      from customer installs that don't opt in).
 *   2. Otherwise compare the X-Admin-Password header with constant-time check.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_PASSWORD) { res.status(404).end(); return; }

  // Allow the existence-check route through (returns 401 instead of 404 so
  // the UI can show a login screen rather than "not found").
  if (req.path === "/admin/check-mode") { next(); return; }

  const provided = String(req.headers["x-admin-password"] ?? "");
  if (provided.length !== ADMIN_PASSWORD.length) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const ok = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ADMIN_PASSWORD));
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return; }

  next();
}

router.use(requireAdmin);

/* ───── Existence check (no auth needed beyond ADMIN_PASSWORD being set) ───── */
router.get("/admin/check-mode", (_req, res) => {
  res.json({ enabled: true });
});

/* ───── Login / verify password ───── */
router.post("/admin/login", (_req, res) => {
  // requireAdmin already rejected if password was wrong
  res.json({ ok: true });
});

/* ───── List licenses ───── */
router.get("/admin/licenses", (_req, res) => {
  const records = listLicenses();
  const now = Date.now();
  const enriched = records.map((r) => {
    const isRevoked = !!r.revokedAt;
    const isPerpetual = r.expiry === "perpetual";
    let isExpired = false;
    let daysRemaining: number | null = null;
    if (!isPerpetual) {
      const exp = new Date(r.expiry).getTime();
      if (Number.isFinite(exp)) {
        isExpired = exp < now;
        daysRemaining = Math.floor((exp - now) / 86_400_000);
      }
    }
    return { ...r, isRevoked, isExpired, isPerpetual, daysRemaining };
  });
  res.json({ records: enriched });
});

/* ───── Generate a new license ───── */
router.post("/admin/licenses", (req, res) => {
  const shop    = String(req.body?.shop ?? "").trim();
  const expiry  = String(req.body?.expiry ?? "perpetual").trim();
  const edition = String(req.body?.edition ?? "standard").trim();
  const notes   = req.body?.notes ? String(req.body.notes).trim() : undefined;

  if (!shop) { res.status(400).json({ error: "Shop name is required" }); return; }
  if (expiry !== "perpetual" && Number.isNaN(new Date(expiry).getTime())) {
    res.status(400).json({ error: "Expiry must be YYYY-MM-DD or 'perpetual'" }); return;
  }

  const issued = new Date().toISOString().slice(0, 10);
  const key    = generateLicense({ shop, expiry, issued, edition });

  const record = appendLicense({ shop, edition, expiry, issued, key, notes, revokedAt: null });
  res.status(201).json({ record: { ...record, isRevoked: false, isExpired: false, isPerpetual: expiry === "perpetual" } });
});

/* ───── Mark a license revoked (just a vendor note — keys can't be remotely killed) ───── */
router.post("/admin/licenses/:id/revoke", (req, res) => {
  const updated = markRevoked(req.params.id);
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ record: updated });
});

/* ───── Delete a record from the local registry ───── */
router.delete("/admin/licenses/:id", (req, res) => {
  const ok = deleteRecord(req.params.id);
  if (!ok) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

/* ───── Verify any pasted key ───── */
router.post("/admin/verify", (req, res) => {
  const key = String(req.body?.key ?? "").trim();
  if (!key) { res.status(400).json({ error: "Key is required" }); return; }
  const result = verifyLicense(key);
  if (!result.ok) { res.json({ valid: false, reason: result.reason }); return; }
  const { payload } = result;
  const isPerpetual = payload.expiry === "perpetual";
  const now = Date.now();
  let isExpired = false; let daysRemaining: number | null = null;
  if (!isPerpetual) {
    const exp = new Date(payload.expiry).getTime();
    if (Number.isFinite(exp)) { isExpired = exp < now; daysRemaining = Math.floor((exp - now) / 86_400_000); }
  }
  res.json({ valid: true, payload, isPerpetual, isExpired, daysRemaining });
});

/* ───── Stats summary ───── */
router.get("/admin/stats", (_req, res) => {
  const records = listLicenses();
  const now = Date.now();
  let active = 0, expired = 0, expiringSoon = 0, perpetual = 0, revoked = 0;
  for (const r of records as LicenseRecord[]) {
    if (r.revokedAt) { revoked++; continue; }
    if (r.expiry === "perpetual") { perpetual++; active++; continue; }
    const exp = new Date(r.expiry).getTime();
    if (!Number.isFinite(exp)) continue;
    if (exp < now) { expired++; continue; }
    active++;
    if (exp - now < 7 * 86_400_000) expiringSoon++;
  }
  res.json({ total: records.length, active, expired, expiringSoon, perpetual, revoked });
});

export default router;
