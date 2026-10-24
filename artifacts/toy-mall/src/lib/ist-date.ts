export function istToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
export function isIstToday(date: string | Date): boolean {
  return istToday(new Date(date)) === istToday();
}

/** Both endpoints are inclusive calendar days, independent of device timezone. */
export function isWithinIstDateRange(date: string | Date, from: string, to: string): boolean {
  if (!from || !to || from > to) return false;
  const instant = new Date(date);
  if (!Number.isFinite(instant.getTime())) return false;
  const day = istToday(instant);
  return day >= from && day <= to;
}
