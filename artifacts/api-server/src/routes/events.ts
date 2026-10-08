import { Router, type IRouter } from "express";
import { addClient, clientCount } from "../lib/sse";
import { db, authSessionsTable, staffProfilesTable, authUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ownerIdleExpired } from "../lib/owner-idle";
import { canViewTodaysBilling } from "../middlewares/today-billing";

const router: IRouter = Router();

/** GET /api/events  — SSE stream (tenant-scoped via cookie) */
router.get("/events", (req, res) => {
  const isActive = async () => {
    if (!req.sessionId) return false;
    const [session] = await db.select().from(authSessionsTable).where(eq(authSessionsTable.id, req.sessionId));
    if (!session || session.revokedAt) return false;
    const [subject] = req.staffId
      ? await db.select().from(staffProfilesTable).where(eq(staffProfilesTable.id, req.staffId))
      : req.userId ? await db.select().from(authUsersTable).where(eq(authUsersTable.id, req.userId)) : [];
    return !!subject?.isActive && !ownerIdleExpired(subject.role, session.lastActivityAt);
  };
  const cleanup = addClient(res, req.tenantId, {
    isActive,
    canReadMoney: async () => await isActive() && await canViewTodaysBilling(req),
  });
  req.on("close", cleanup);
});

/** GET /api/events/status  — how many clients connected */
router.get("/events/status", (_req, res) => {
  res.json({ clients: clientCount() });
});

export default router;
