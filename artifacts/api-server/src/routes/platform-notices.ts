/**
 * Notices the vendor shows inside shops' apps.
 *
 * `tenantId: null` broadcasts to every shop. A notice can carry a start/end
 * window; the window is evaluated when the shop app asks for its notices, so
 * a scheduled notice appears and disappears on its own.
 */

import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, announcementsTable, tenantsTable } from "@workspace/db";
import { recordAudit } from "../lib/audit";
import { requirePlatformAdmin } from "../middlewares/platform-admin";

const router: IRouter = Router();

const VALID_LEVELS = new Set(["info", "warning", "critical"]);

function parseWhen(v: unknown): Date | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/* ───── GET /api/platform/notices ─────────────────────────────────── */
router.get("/platform/notices", requirePlatformAdmin, async (_req, res): Promise<void> => {
  try {
    const notices = await db
      .select({
        id:        announcementsTable.id,
        tenantId:  announcementsTable.tenantId,
        shopName:  tenantsTable.name,
        title:     announcementsTable.title,
        body:      announcementsTable.body,
        level:     announcementsTable.level,
        isActive:  announcementsTable.isActive,
        startsAt:  announcementsTable.startsAt,
        endsAt:    announcementsTable.endsAt,
        createdBy: announcementsTable.createdByEmail,
        createdAt: announcementsTable.createdAt,
        /* "Live right now" is the window plus the switch, computed in SQL so
           the panel and the shop app can never disagree about it. */
        isLive: sql<boolean>`(
          ${announcementsTable.isActive}
          and (${announcementsTable.startsAt} is null or ${announcementsTable.startsAt} <= now())
          and (${announcementsTable.endsAt}   is null or ${announcementsTable.endsAt}   >  now())
        )`,
      })
      .from(announcementsTable)
      .leftJoin(tenantsTable, eq(tenantsTable.id, announcementsTable.tenantId))
      .orderBy(desc(announcementsTable.createdAt))
      .limit(200);
    res.json({ notices });
  } catch {
    res.status(500).json({ error: "Failed to load notices" });
  }
});

/* ───── POST /api/platform/notices ────────────────────────────────── */
router.post("/platform/notices", requirePlatformAdmin, async (req, res): Promise<void> => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const level = typeof req.body?.level === "string" ? req.body.level : "info";
  /* "" and null both mean every shop; only a non-empty string scopes it. */
  const tenantId = typeof req.body?.tenantId === "string" && req.body.tenantId.trim() !== ""
    ? req.body.tenantId.trim()
    : null;

  if (title.length < 2 || title.length > 120) { res.status(400).json({ error: "Title must be 2–120 characters" }); return; }
  if (body.length < 2 || body.length > 2000) { res.status(400).json({ error: "Message must be 2–2000 characters" }); return; }
  if (!VALID_LEVELS.has(level)) { res.status(400).json({ error: "Unknown notice type" }); return; }

  const startsAt = parseWhen(req.body?.startsAt);
  const endsAt = parseWhen(req.body?.endsAt);
  if (startsAt === "invalid" || endsAt === "invalid") { res.status(400).json({ error: "Those dates aren't valid" }); return; }
  if (startsAt && endsAt && endsAt <= startsAt) { res.status(400).json({ error: "The end must come after the start" }); return; }

  try {
    if (tenantId) {
      const [shop] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
      if (!shop) { res.status(404).json({ error: "Shop not found" }); return; }
    }

    const [row] = await db
      .insert(announcementsTable)
      .values({ tenantId, title, body, level, startsAt, endsAt, createdByEmail: req.platformActor!.email })
      .returning();

    void recordAudit({
      action:       "platform.notice_created",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { noticeId: row.id, level, everyShop: tenantId === null, title },
    });
    res.status(201).json({ ok: true, notice: row });
  } catch {
    res.status(500).json({ error: "Failed to save that notice" });
  }
});

/* ───── PATCH /api/platform/notices/:noticeId — switch on/off ───────── */
router.patch("/platform/notices/:noticeId", requirePlatformAdmin, async (req, res): Promise<void> => {
  const noticeId = String(req.params.noticeId);
  const isActive = req.body?.isActive;
  if (typeof isActive !== "boolean") { res.status(400).json({ error: "isActive must be true or false" }); return; }
  try {
    const updated = await db
      .update(announcementsTable)
      .set({ isActive })
      .where(eq(announcementsTable.id, noticeId))
      .returning({ id: announcementsTable.id, title: announcementsTable.title, tenantId: announcementsTable.tenantId });
    if (updated.length === 0) { res.status(404).json({ error: "Notice not found" }); return; }
    void recordAudit({
      action:       isActive ? "platform.notice_enabled" : "platform.notice_disabled",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: updated[0].tenantId,
      ip:           req.ip,
      metadata:     { noticeId, title: updated[0].title },
    });
    res.json({ ok: true, isActive });
  } catch {
    res.status(500).json({ error: "Failed to update that notice" });
  }
});

/* ───── DELETE /api/platform/notices/:noticeId ──────────────────────── */
router.delete("/platform/notices/:noticeId", requirePlatformAdmin, async (req, res): Promise<void> => {
  const noticeId = String(req.params.noticeId);
  try {
    const deleted = await db
      .delete(announcementsTable)
      .where(eq(announcementsTable.id, noticeId))
      .returning({ id: announcementsTable.id, title: announcementsTable.title, tenantId: announcementsTable.tenantId });
    if (deleted.length === 0) { res.status(404).json({ error: "Notice not found" }); return; }
    void recordAudit({
      action:       "platform.notice_deleted",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: deleted[0].tenantId,
      ip:           req.ip,
      metadata:     { noticeId, title: deleted[0].title },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete that notice" });
  }
});

export default router;
