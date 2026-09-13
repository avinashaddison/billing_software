/**
 * Shop-calendar time formatting. Every date the shop reads is an
 * Asia/Kolkata calendar day regardless of the device's timezone, so the same
 * sale never lands on "yesterday" for one phone and "today" for another.
 */
const IST = "Asia/Kolkata";

/** `YYYY-MM-DD` of the instant on the IST calendar — a stable grouping key. */
export const istDayKey = (iso: string | Date): string =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });

const shiftDay = (day: string, deltaDays: number): string => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + deltaDays)).toISOString().slice(0, 10);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * "Today", "Yesterday", or "Sat, 12 Sep 2026". Assembled from the IST day key
 * rather than `toLocaleDateString`, whose en-IN output varies by engine
 * ("2 Sept, 2026" on some) and would make two devices print the same day differently.
 */
export const formatIstDay = (iso: string | Date): string => {
  const day = istDayKey(iso);
  const today = istDayKey(new Date());
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  const [year, month, date] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
  return `${weekday}, ${date} ${MONTHS[month - 1]} ${year}`;
};

/** "10:42 am" */
export const formatIstTime = (iso: string | Date): string =>
  new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true,
  });

/** "12 Sep 2026, 10:42 am" */
export const formatIstDateTime = (iso: string | Date): string =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: IST, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
