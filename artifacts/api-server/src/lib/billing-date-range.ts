import { sql, type SQLWrapper } from "drizzle-orm";

/** Validate calendar dates before PostgreSQL casts them (invalid dates are 400s). */
export function parseBillingDateRange(from: unknown, to: unknown): { from: string; to: string } | null {
  if (from === undefined && to === undefined) return null;
  const validDay = (day: unknown): day is string => {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith("0000")) return false;
    const date = new Date(`${day}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
  };
  if (!validDay(from) || !validDay(to)) throw new Error("Select valid From and To dates");
  if (from > to) throw new Error("From date must be on or before To date");
  return { from, to };
}

export function billingDateCondition(column: SQLWrapper, range: ReturnType<typeof parseBillingDateRange>) {
  return range
    ? sql`DATE(${column} AT TIME ZONE 'Asia/Kolkata') BETWEEN ${range.from}::date AND ${range.to}::date`
    : undefined;
}
