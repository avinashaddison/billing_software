export function istToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
export function isIstToday(date: string | Date): boolean {
  return istToday(new Date(date)) === istToday();
}
