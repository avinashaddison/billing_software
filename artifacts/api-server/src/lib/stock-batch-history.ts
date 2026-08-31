export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT" | "RETURN";

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: number;
  userId?: string | null;
  purchasePrice?: number | string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  note?: string | null;
  createdAt: Date | string;
}

export interface StockBatch {
  id: string;
  addedQuantity: number;
  soldQuantity: number;
  adjustedQuantity: number;
  remainingQuantity: number;
  purchasePrice: number | null;
  supplierId: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  note: string | null;
  addedAt: string;
}

export interface ProductStockHistory {
  productId: string;
  currentStock: number;
  summary: {
    stockedQuantity: number;
    soldQuantity: number;
    returnedQuantity: number;
    unattributedRemaining: number;
    batchCount: number;
  };
  batches: StockBatch[];
}

interface Pool {
  kind: "batch" | "opening" | "return" | "adjustment";
  remaining: number;
  batch?: StockBatch;
}

const isLegacyDeltaAdjustment = (movement: StockMovement): boolean =>
  movement.type === "ADJUSTMENT" &&
  movement.userId?.startsWith("apikey:") === true;

const movementDelta = (movement: StockMovement): number => {
  if (movement.type === "IN" || movement.type === "RETURN") return movement.quantity;
  if (movement.type === "OUT") return -movement.quantity;
  if (isLegacyDeltaAdjustment(movement)) return movement.quantity;
  return 0;
};

/**
 * Replays the complete stock ledger and allocates sales FIFO.
 *
 * Existing products may have opening stock that predates stock_logs. That
 * quantity is deliberately kept in an unattributed pool rather than attached
 * to a dated restock. RETURN and upward ADJUSTMENT quantities are also kept
 * unattributed so supplier stock-ins remain truthful.
 */
export function buildStockBatchHistory(
  productId: string,
  currentStock: number,
  movements: StockMovement[],
): ProductStockHistory {
  const ordered = [...movements].sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime || a.id.localeCompare(b.id);
  });

  const firstAdjustment = ordered.findIndex(
    (movement) =>
      movement.type === "ADJUSTMENT" &&
      !isLegacyDeltaAdjustment(movement),
  );
  // Without an absolute adjustment the ledger and current level can establish
  // the opening gap. Once an absolute correction exists, however, the amount
  // and composition of pre-correction opening stock are both unknowable.
  const openingQuantity = firstAdjustment === -1
    ? Math.max(
        0,
        currentStock -
          ordered.reduce((sum, movement) => sum + movementDelta(movement), 0),
      )
    : 0;

  const pools: Pool[] = [];
  const batches: StockBatch[] = [];

  if (openingQuantity > 0) {
    pools.push({ kind: "opening", remaining: openingQuantity });
  }

  const available = () => pools.reduce((sum, pool) => sum + pool.remaining, 0);

  const consume = (requested: number, reason: "sale" | "adjustment") => {
    let left = Math.max(0, requested);
    for (const pool of pools) {
      if (left === 0) break;
      const used = Math.min(pool.remaining, left);
      if (used === 0) continue;
      pool.remaining -= used;
      left -= used;

      if (pool.batch) {
        if (reason === "sale") pool.batch.soldQuantity += used;
        else pool.batch.adjustedQuantity += used;
      }
    }

    // Defensive support for imported/legacy ledgers whose earlier stock source
    // is absent. The sale total remains truthful without making a batch negative.
  };

  const resetProvenance = (target: number) => {
    for (const pool of pools) {
      if (pool.batch) {
        pool.batch.adjustedQuantity += pool.remaining;
        pool.batch.remainingQuantity = 0;
      }
    }
    pools.length = 0;
    if (target > 0) pools.push({ kind: "adjustment", remaining: target });
  };

  for (const [movementIndex, movement] of ordered.entries()) {
    const signedQuantity = Math.trunc(movement.quantity);
    const quantity = Math.max(0, signedQuantity);
    const isBeforeFirstAbsoluteAdjustment =
      firstAdjustment !== -1 && movementIndex < firstAdjustment;

    if (movement.type === "IN") {
      const batch: StockBatch = {
        id: movement.id,
        addedQuantity: quantity,
        soldQuantity: 0,
        adjustedQuantity: 0,
        remainingQuantity: quantity,
        purchasePrice:
          movement.purchasePrice != null ? Number(movement.purchasePrice) : null,
        supplierId: movement.supplierId ?? null,
        supplierName: movement.supplierName ?? null,
        invoiceNumber: movement.invoiceNumber ?? null,
        note: movement.note ?? null,
        addedAt: new Date(movement.createdAt).toISOString(),
      };
      batches.push(batch);
      pools.push({ kind: "batch", remaining: quantity, batch });
      continue;
    }

    if (movement.type === "RETURN") {
      pools.push({ kind: "return", remaining: quantity });
      continue;
    }

    if (movement.type === "OUT") {
      // An upcoming absolute correction makes every pre-correction source
      // composition plausible. Keep the total sale, but do not claim it came
      // from a dated batch.
      if (!isBeforeFirstAbsoluteAdjustment) consume(quantity, "sale");
      continue;
    }

    // v1 API rows written before stock-batch history stored a signed delta in
    // ADJUSTMENT.quantity and are identifiable by their `apikey:` actor marker.
    // New v1 rows store an absolute level and use `apikey-absolute:` instead.
    if (isLegacyDeltaAdjustment(movement)) {
      if (isBeforeFirstAbsoluteAdjustment) continue;
      if (signedQuantity < 0) {
        consume(Math.abs(signedQuantity), "adjustment");
      } else if (signedQuantity > 0) {
        pools.push({ kind: "adjustment", remaining: signedQuantity });
      }
      continue;
    }

    // An absolute level says nothing about which prior pool survived. Retire
    // every still-attributed batch quantity, then restart attribution from one
    // unattributed pool at the corrected level. Later IN/OUT movements can be
    // tracked defensibly until another absolute correction resets provenance.
    resetProvenance(quantity);
  }

  // Reconcile rare imported or concurrently repaired ledgers to the product's
  // authoritative current level without fabricating a dated stock-in.
  const accounted = available();
  if (currentStock !== accounted) resetProvenance(Math.max(0, currentStock));

  for (const pool of pools) {
    if (pool.batch) pool.batch.remainingQuantity = pool.remaining;
  }

  return {
    productId,
    currentStock: Math.max(0, currentStock),
    summary: {
      stockedQuantity: ordered
        .filter((movement) => movement.type === "IN")
        .reduce((sum, movement) => sum + Math.max(0, movement.quantity), 0),
      soldQuantity: ordered
        .filter((movement) => movement.type === "OUT")
        .reduce((sum, movement) => sum + Math.max(0, movement.quantity), 0),
      returnedQuantity: ordered
        .filter((movement) => movement.type === "RETURN")
        .reduce((sum, movement) => sum + Math.max(0, movement.quantity), 0),
      unattributedRemaining: pools
        .filter((pool) => pool.kind !== "batch")
        .reduce((sum, pool) => sum + pool.remaining, 0),
      batchCount: batches.length,
    },
    // The UI is a history feed, so return the latest restock first.
    batches: batches.reverse(),
  };
}