/**
 * Shop-side endpoint: notices from the vendor, plus a flag telling the app it
 * is being viewed by vendor support.
 *
 * Kept separate from /settings on purpose. The settings response feeds a
 * Save-able form, and adding unrelated keys to it is how that form ends up
 * writing back values it never owned.
 */

import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, announcementsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/app/notices", async (req, res): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    /* A notice is shown when it is switched on and inside its window. The
       window is evaluated here rather than at write time so a scheduled
       notice starts and stops on its own. */
    const notices = await db
      .select({
        id:    announcementsTable.id,
        title: announcementsTable.title,
        body:  announcementsTable.body,
        level: announcementsTable.level,
      })
      .from(announcementsTable)
      .where(sql`
        ${announcementsTable.isActive}
        and (${announcementsTable.startsAt} is null or ${announcementsTable.startsAt} <= now())
        and (${announcementsTable.endsAt}   is null or ${announcementsTable.endsAt}   >  now())
        and (${announcementsTable.tenantId} is null
             ${tenantId ? sql`or ${announcementsTable.tenantId} = ${tenantId}` : sql``})
      `)
      .orderBy(sql`case ${announcementsTable.level} when 'critical' then 0 when 'warning' then 1 else 2 end`,
               announcementsTable.createdAt)
      .limit(5);

    res.json({
      notices,
      /* Drives the read-only support banner in the shop app. The cookie is
         HttpOnly, so the client cannot work this out for itself. */
      viewAs: req.viewAsReadOnly === true,
    });
  } catch {
    /* A failure here must never take the shop app down — it is a banner. */
    res.json({ notices: [], viewAs: req.viewAsReadOnly === true });
  }
});

export default router;
