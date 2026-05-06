import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const CLEANUP_TOKEN = "98da34ba1e94585382fe50a2978e19589d7306fcd9389b0c";

router.post("/admin/cleanup", async (req, res): Promise<void> => {
  const token = req.headers["x-cleanup-token"];
  if (token !== CLEANUP_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.execute(sql`
    TRUNCATE TABLE
      sale_items,
      bills,
      sales,
      stock_logs,
      returns,
      products,
      suppliers,
      categories
    RESTART IDENTITY CASCADE
  `);

  res.json({ ok: true, message: "All data cleared except staff" });
});

export default router;
