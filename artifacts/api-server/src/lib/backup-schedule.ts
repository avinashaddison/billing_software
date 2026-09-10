/**
 * Backup schedule arithmetic — pure functions, no database, unit-tested.
 *
 * The scheduler is no longer a cron job that fires once and hopes. It is a
 * once-a-minute tick that asks "which backup SLOTS are due right now?" and
 * tries to claim each one in the shared `backup_runs` ledger (see
 * backup-runs.ts). Naming slots by their IST calendar position gives three
 * things cron could not:
 *   - exactly-once across processes: the deployment and a dev workspace both
 *     tick against the same database, but only one can claim a slot;
 *   - catch-up: a server that was down at 02:30 finds the nightly slot still
 *     unclaimed when it boots at 09:00 and takes it then;
 *   - a durable answer to "when did the last backup succeed?".
 *
 * Everything here is computed on the Asia/Kolkata wall clock, because that is
 * the clock the shop and the vendor live on.
 */

export type BackupKind = "nightly" | "intraday" | "manual" | "safety";

export interface BackupScheduleSettings {
  /** Hour (IST, 0–23) of the nightly full backup; it runs at HH:30. */
  backupHour: number;
  /** Intraday snapshot interval in hours; 0 switches intraday backups off. */
  intradayEveryHours: number;
}

export interface DueSlot {
  slot: string;
  kind: "nightly" | "intraday";
}

/** Intervals the admin panel offers. 0 = off. */
export const INTRADAY_CHOICES: readonly number[] = [0, 1, 2, 3, 4, 6, 12];
export const DEFAULT_INTRADAY_EVERY_HOURS = 1;
/** Intraday snapshots are a short ring buffer; nightlies are the archive. */
export const INTRADAY_RETENTION_HOURS = 48;
/** Nightly backups run at :30 past the configured hour (unchanged from cron). */
export const NIGHTLY_MINUTE = 30;

export function clampBackupHour(h: unknown, fallback = 2): number {
  const n = Number(h);
  return Number.isFinite(n) ? Math.max(0, Math.min(23, Math.trunc(n))) : fallback;
}

export function normaliseIntradayEvery(h: unknown, fallback = DEFAULT_INTRADAY_EVERY_HOURS): number {
  const n = Number(h);
  return INTRADAY_CHOICES.includes(n) ? n : fallback;
}

const IST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export interface IstClock {
  /** YYYY-MM-DD on the IST calendar. */
  date: string;
  hour: number;
  minute: number;
}

/** Wall-clock reading in IST for an instant. */
export function istClock(now: Date): IstClock {
  const parts = Object.fromEntries(IST_PARTS.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date:   `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    hour:   Number(parts["hour"]) % 24,
    minute: Number(parts["minute"]),
  };
}

export function nightlySlot(date: string): string {
  return `nightly:${date}`;
}

export function intradaySlot(date: string, boundaryHour: number): string {
  return `intraday:${date}T${String(boundaryHour).padStart(2, "0")}`;
}

/**
 * Slots that are due at `now` and have not necessarily been taken yet.
 *
 * `graceMinutes` is a soft priority: a non-production process passes a few
 * minutes so the deployment gets first claim on every slot. It is only a
 * courtesy — if the deployment is down, the workspace still takes the slot a
 * few minutes later. Keep it under 30 so a slot can never slide past midnight.
 *
 * Only the CURRENT intraday boundary is ever due. A server that was down for
 * six hours does not fire six catch-up snapshots; the most recent one is the
 * only one that still describes data worth capturing.
 */
export function dueSlots(now: Date, settings: BackupScheduleSettings, graceMinutes = 0): DueSlot[] {
  const grace = Math.max(0, Math.min(29, Math.trunc(graceMinutes)));
  const { date, hour, minute } = istClock(now);
  const minuteOfDay = hour * 60 + minute;
  const due: DueSlot[] = [];

  const nightlyAt = clampBackupHour(settings.backupHour) * 60 + NIGHTLY_MINUTE + grace;
  if (minuteOfDay >= nightlyAt) due.push({ slot: nightlySlot(date), kind: "nightly" });

  const every = normaliseIntradayEvery(settings.intradayEveryHours, 0);
  if (every > 0) {
    const boundary = Math.floor(hour / every) * every;
    /* The nightly already covers this hour — two snapshots 30 minutes apart
       would just burn retention slots. */
    const coveredByNightly = boundary === clampBackupHour(settings.backupHour);
    if (!coveredByNightly && minuteOfDay >= boundary * 60 + grace) {
      due.push({ slot: intradaySlot(date, boundary), kind: "intraday" });
    }
  }
  return due;
}

/**
 * How old the newest successful backup may be before it counts as stale.
 *
 * With intraday snapshots on: two missed intervals plus slack, so a single
 * failed hourly run does not page anyone but two in a row do. Nightly-only:
 * a day plus two hours of slack for a late or retried run.
 */
export function freshnessThresholdMinutes(settings: BackupScheduleSettings): number {
  const every = normaliseIntradayEvery(settings.intradayEveryHours, 0);
  if (every > 0) return every * 60 * 2 + 30;
  return 24 * 60 + 120;
}

export type FreshnessState = "ok" | "stale" | "unknown";

export interface BackupFreshness {
  state: FreshnessState;
  lastSuccessAt: string | null;
  lastKind: BackupKind | null;
  ageMinutes: number | null;
  thresholdMinutes: number;
}

/**
 * `firstAttemptAt` matters only when nothing has ever succeeded: silence is
 * "unknown" until the first run is attempted, then becomes "stale" once that
 * first attempt is older than the threshold — so failing from day one pages
 * the vendor just like failing after years of success would.
 */
export function assessFreshness(
  last: { finishedAt: Date; kind: BackupKind } | null,
  settings: BackupScheduleSettings,
  now: Date = new Date(),
  firstAttemptAt: Date | null = null,
): BackupFreshness {
  const thresholdMinutes = freshnessThresholdMinutes(settings);
  const minutesSince = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
  if (!last) {
    const waited = firstAttemptAt ? minutesSince(firstAttemptAt) : null;
    return {
      state: waited !== null && waited > thresholdMinutes ? "stale" : "unknown",
      lastSuccessAt: null,
      lastKind: null,
      ageMinutes: waited,
      thresholdMinutes,
    };
  }
  const ageMinutes = minutesSince(last.finishedAt);
  return {
    state: ageMinutes > thresholdMinutes ? "stale" : "ok",
    lastSuccessAt: last.finishedAt.toISOString(),
    lastKind: last.kind,
    ageMinutes,
    thresholdMinutes,
  };
}

/** Where a stored object lives decides which retention rule owns it. */
export function classifyBackupKey(key: string): "nightly" | "intraday" {
  return key.startsWith("backups/intraday/") ? "intraday" : "nightly";
}

/** Next nightly run as an IST wall-clock label, e.g. "Tomorrow 02:30" — for the admin page. */
export function describeNextNightly(now: Date, settings: BackupScheduleSettings): string {
  const { hour, minute } = istClock(now);
  const h = clampBackupHour(settings.backupHour);
  const label = `${String(h).padStart(2, "0")}:${String(NIGHTLY_MINUTE).padStart(2, "0")} IST`;
  const later = hour * 60 + minute < h * 60 + NIGHTLY_MINUTE;
  return `${later ? "Today" : "Tomorrow"} ${label}`;
}
