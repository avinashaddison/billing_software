/**
 * The shop's business day is an Asia/Kolkata calendar day. Every "today"
 * filter (dashboard counters, stock-log filters, reports) must resolve the
 * day through these helpers — using the server's local midnight instead
 * makes dashboard numbers disagree with reports when the host runs in UTC.
 */
export const istToday = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Shift a YYYY-MM-DD day string by whole days (calendar math, no TZ). */
export function istShiftDay(day: string, days: number): string {
  const [yyyy, mm, dd] = day.split("-").map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
