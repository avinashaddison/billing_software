/**
 * One product's movement history as a shop owner reads it: every stock-in,
 * sale, return and correction in date order, each one saying who did it and —
 * for sales and returns — which bill and customer it belongs to.
 *
 * The ledger (`stock_logs`) is the spine, so the events here always add up to
 * the same In / Out / Stock figures the Stock Check sheet prints. Bills carry
 * no pointer back to the ledger row, so a sale is attached to its bill by the
 * one thing they provably share: both rows are written in the same database
 * transaction, and `now()` is frozen for the whole transaction, so their
 * `created_at` values are identical to the microsecond. On the live shop that
 * matches every billed line; OUT rows without a bill are counter sales made
 * from the Scan/Entry screens, which the app records without a bill.
 */

import type { ProductStockTotals } from "./stock-totals";

export type TimelineEventType = "IN" | "OUT" | "RETURN" | "ADJUSTMENT";

/**
 * Who is reading. The owner view carries purchase cost and the customer's
 * phone; the manager view (any staff member let in by a read permission)
 * leaves both fields out entirely — absent, not null — so a staff account can
 * never learn what the shop paid or harvest customer numbers from here.
 */
export type TimelineView = "owner" | "manager";

export interface TimelineBill {
  id: string;
  number: number;
  customerName: string | null;
  /** Owner view only. */
  customerPhone?: string | null;
  paymentMode: string;
  /** Unit price the customer paid on this bill (OUT only). */
  unitPrice: number | null;
  /** This product's line total on the bill (OUT only). */
  lineTotal: number | null;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  /** Units moved. For an absolute ADJUSTMENT (`setsLevel`) it is the resulting level instead. */
  quantity: number;
  /** ADJUSTMENT only: `quantity` is the new stock level, not a change. */
  setsLevel: boolean;
  at: string;
  /** Who recorded it: a staff name, "API key · name", or null when unknown. */
  by: string | null;
  note: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  /** Owner view only. */
  purchasePrice?: number | null;
  bill: TimelineBill | null;
  refundAmount: number | null;
  returnReason: string | null;
}

export interface TimelineProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  supplierName: string | null;
  deleted: boolean;
  createdAt: string;
}

export interface ProductTimeline {
  product: TimelineProduct;
  totals: ProductStockTotals;
  events: TimelineEvent[];
}

/** Raw row shape produced by the timeline query (one row per ledger entry). */
export interface TimelineRow {
  id: string;
  type: TimelineEventType;
  quantity: number;
  userId: string | null;
  staffName: string | null;
  purchasePrice: string | number | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  note: string | null;
  createdAt: Date | string;
  billId: string | null;
  billNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  paymentMode: string | null;
  /** How many lines of the bill carry this product (OUT only). */
  lineCount: string | number | null;
  minPrice: string | number | null;
  maxPrice: string | number | null;
  /** Sum of those lines' subtotals (OUT only). */
  linesTotal: string | number | null;
  refundAmount: string | number | null;
  returnReason: string | null;
}

const API_KEY_PREFIXES = ["apikey-absolute:", "apikey:"] as const;

/**
 * Human label for the ledger row's author. Staff ids resolve to the current
 * staff name; API-key writes keep the key's name so a sync job is never
 * mistaken for a person; anything else (legacy rows) is unknown.
 */
export function staffLabel(userId: string | null, staffName: string | null): string | null {
  if (staffName) return staffName;
  if (!userId) return null;
  for (const prefix of API_KEY_PREFIXES) {
    if (userId.startsWith(prefix)) {
      const name = userId.slice(prefix.length).trim();
      return name ? `API key · ${name}` : "API key";
    }
  }
  return null;
}

/** Older API syncs wrote ADJUSTMENT rows as signed deltas under an `apikey:` author. */
const isLegacyDeltaAdjustment = (row: Pick<TimelineRow, "type" | "userId">): boolean =>
  row.type === "ADJUSTMENT" && row.userId?.startsWith("apikey:") === true;

const num = (value: string | number | null | undefined): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Money for one OUT event. A bill normally carries a product on one line, and
 * checkout writes one OUT row per line, so the line's own figures apply. When
 * the same product was rung up on several lines of one bill every OUT row of
 * that bill matches the same aggregate, and the only honest per-event figure
 * is `quantity × price` — available when all those lines share a price. With
 * differing prices no figure is defensible, so none is shown; the bill itself
 * stays attached either way.
 */
export function saleLineMoney(
  row: Pick<TimelineRow, "quantity" | "lineCount" | "minPrice" | "maxPrice" | "linesTotal">,
): { unitPrice: number | null; lineTotal: number | null } {
  const lineCount = num(row.lineCount) ?? 0;
  const minPrice = num(row.minPrice);
  const maxPrice = num(row.maxPrice);
  if (lineCount === 1 && minPrice != null) {
    return { unitPrice: minPrice, lineTotal: num(row.linesTotal) ?? round2(minPrice * row.quantity) };
  }
  if (lineCount > 1 && minPrice != null && minPrice === maxPrice) {
    return { unitPrice: minPrice, lineTotal: round2(minPrice * row.quantity) };
  }
  return { unitPrice: null, lineTotal: null };
}

export function shapeTimelineEvent(row: TimelineRow, view: TimelineView): TimelineEvent {
  const hasBill = row.billId != null && row.billNumber != null;
  const money = row.type === "OUT" ? saleLineMoney(row) : { unitPrice: null, lineTotal: null };
  const owner = view === "owner";
  return {
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    setsLevel: row.type === "ADJUSTMENT" && !isLegacyDeltaAdjustment(row),
    at: iso(row.createdAt),
    by: staffLabel(row.userId, row.staffName),
    note: row.note ?? null,
    supplierName: row.type === "IN" ? row.supplierName ?? null : null,
    invoiceNumber: row.type === "IN" ? row.invoiceNumber ?? null : null,
    ...(owner ? { purchasePrice: row.type === "IN" ? num(row.purchasePrice) : null } : {}),
    bill: hasBill
      ? {
          id: row.billId as string,
          number: row.billNumber as number,
          customerName: row.customerName ?? null,
          ...(owner ? { customerPhone: row.customerPhone ?? null } : {}),
          paymentMode: row.paymentMode ?? "cash",
          unitPrice: money.unitPrice,
          lineTotal: money.lineTotal,
        }
      : null,
    refundAmount: row.type === "RETURN" ? num(row.refundAmount) : null,
    returnReason: row.type === "RETURN" ? row.returnReason ?? null : null,
  };
}
