import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { broadcast } from "./sse";
import { logger } from "./logger";
import { ARCHIVE_ZERO_STOCK_SQL } from "./zero-stock-policy";

/** Single atomic UPDATE: a restock racing this query either prevents archival
 * or is refused by existing liveProduct guards. No bills/FKs are deleted. */
export async function archiveOldZeroStockProducts(): Promise<void> {
  const result = await db.execute(sql.raw(ARCHIVE_ZERO_STOCK_SQL));
  for (const row of result.rows) {
    broadcast(
      "product_updated",
      { productId: row.id, deleted: true },
      row.tenant_id as string | null,
      true,
    );
  }
  logger.info(
    { archivedCount: result.rowCount },
    "30-day zero-stock archive completed",
  );
}
