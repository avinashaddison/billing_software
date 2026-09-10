/**
 * Backup scheduling, catch-up, de-duplication and the staleness watchdog.
 *
 * Replaces the old node-cron job. Once a minute this asks backup-schedule.ts
 * which slots are due, claims each in the `backup_runs` ledger and runs the
 * ones it wins. Consequences, all deliberate:
 *   - The deployment and a dev workspace both tick against the same database
 *     without producing duplicate nightlies (the ledger claim is atomic; the
 *     workspace also waits a few minutes so production gets first pick).
 *   - A server that was asleep at 02:30 takes the nightly when it wakes.
 *   - A failed run is retried (see backup-runs.ts) before anyone is paged.
 *   - Settings are re-read from platform_settings every tick, so a change
 *     made through the admin page on one process is honoured by the other.
 *
 * The watchdog is the missing half of "alert on failure": a failure can only
 * alert if the job RAN. If nothing has succeeded for longer than the schedule
 * allows — process dead at 02:30, destination misconfigured, clock wrong —
 * this sends the alert instead, once, and an all-clear when it recovers.
 * The same reading is served publicly at /api/healthz/backup so an outside
 * uptime monitor can page the vendor even when this process itself is gone.
 */
import { eq } from "drizzle-orm";
import { db, pool, platformSettingsTable } from "@workspace/db";
import { logger } from "./logger";
import { runDatabaseBackup } from "./backup";
import { isR2Configured } from "./r2";
import { isConfigured as isTelegramConfigured, sendBackupFailureAlert, sendBackupStaleAlert, sendBackupRecoveredAlert } from "./telegram";
import { claimSlot, firstRunStartedAt, lastSuccessfulRun, pruneOldRuns, processLabel, MAX_ATTEMPTS } from "./backup-runs";
import {
  dueSlots, assessFreshness, clampBackupHour, normaliseIntradayEvery,
  type BackupScheduleSettings, type BackupFreshness, type DueSlot,
} from "./backup-schedule";

const TICK_MS = 60_000;
const FIRST_TICK_DELAY_MS = 20_000;
/** A dev workspace lets the deployment claim first. */
const NON_DEPLOYMENT_GRACE_MINUTES = 3;
/** Minimum gap between repeated "still stale" alerts. */
const STALE_REALERT_MINUTES = 6 * 60;

const PLATFORM_SETTINGS_ID = 1;

let settings: BackupScheduleSettings = {
  backupHour: clampBackupHour(process.env["BACKUP_HOUR"], 2),
  intradayEveryHours: normaliseIntradayEvery(process.env["BACKUP_INTRADAY_EVERY_HOURS"]),
};

export function isDeploymentProcess(): boolean {
  return process.env["REPLIT_DEPLOYMENT"] === "1";
}

export function getBackupHour(): number {
  return settings.backupHour;
}

export function getBackupSettings(): BackupScheduleSettings {
  return { ...settings };
}

/**
 * Called by the admin routes right after they persist a change, so THIS
 * process honours it immediately; every other process picks it up on its next
 * tick from platform_settings.
 */
export function applyBackupSettings(next: Partial<BackupScheduleSettings>): BackupScheduleSettings {
  settings = {
    backupHour: next.backupHour === undefined ? settings.backupHour : clampBackupHour(next.backupHour, settings.backupHour),
    intradayEveryHours: next.intradayEveryHours === undefined
      ? settings.intradayEveryHours
      : normaliseIntradayEvery(next.intradayEveryHours, settings.intradayEveryHours),
  };
  logger.info({ ...settings, timezone: "Asia/Kolkata" }, "backup schedule updated");
  return getBackupSettings();
}

/** Kept for callers that only know about the nightly hour. */
export function applyBackupSchedule(hour: number): void {
  applyBackupSettings({ backupHour: hour });
}

async function readPersistedSettings(): Promise<BackupScheduleSettings> {
  const [row] = await db
    .select({ data: platformSettingsTable.data })
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.id, PLATFORM_SETTINGS_ID));
  const data = (row?.data ?? {}) as { backupHour?: unknown; intradayEveryHours?: unknown };
  return {
    backupHour: data.backupHour === undefined || data.backupHour === null
      ? settings.backupHour
      : clampBackupHour(data.backupHour, settings.backupHour),
    intradayEveryHours: data.intradayEveryHours === undefined || data.intradayEveryHours === null
      ? settings.intradayEveryHours
      : normaliseIntradayEvery(data.intradayEveryHours, settings.intradayEveryHours),
  };
}

/* ─────────────────────────── Freshness ─────────────────────────── */

export async function getBackupFreshness(now = new Date()): Promise<BackupFreshness> {
  const last = await lastSuccessfulRun();
  /* Never succeeded at all? The clock runs from the first attempt instead, so
     an installation whose backups fail from day one still raises the alarm. */
  const firstAttempt = last ? null : await firstRunStartedAt();
  return assessFreshness(
    last?.finishedAt ? { finishedAt: new Date(last.finishedAt), kind: last.kind } : null,
    settings,
    now,
    firstAttempt,
  );
}

/**
 * Atomically decide whether THIS process sends the stale alert: the timestamp
 * lives in platform_settings so two processes watching the same database do
 * not both page the vendor.
 */
async function claimStaleAlert(): Promise<boolean> {
  const { rows } = await pool.query(
    `INSERT INTO platform_settings (id, data)
     VALUES ($1, jsonb_build_object('backupStaleAlertedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
     ON CONFLICT (id) DO UPDATE SET
       data = platform_settings.data || jsonb_build_object('backupStaleAlertedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
       updated_at = now()
     WHERE COALESCE((platform_settings.data->>'backupStaleAlertedAt')::timestamptz, 'epoch'::timestamptz)
           < now() - make_interval(mins => $2)
     RETURNING id`,
    [PLATFORM_SETTINGS_ID, STALE_REALERT_MINUTES],
  );
  return rows.length > 0;
}

/** Clears the alert marker; true for the one process that actually cleared it. */
async function clearStaleAlert(): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE platform_settings SET data = data - 'backupStaleAlertedAt', updated_at = now()
      WHERE id = $1 AND data ? 'backupStaleAlertedAt' RETURNING id`,
    [PLATFORM_SETTINGS_ID],
  );
  return rows.length > 0;
}

async function watchFreshness(): Promise<void> {
  const fresh = await getBackupFreshness();
  if (fresh.state === "stale") {
    if (await claimStaleAlert()) {
      logger.error({ ...fresh }, "no successful backup within the expected window");
      await sendBackupStaleAlert(fresh.ageMinutes ?? 0, fresh.lastSuccessAt);
    }
  } else if (fresh.state === "ok") {
    if (await clearStaleAlert()) {
      await sendBackupRecoveredAlert(fresh.lastSuccessAt);
    }
  }
  /* "unknown" (nothing attempted yet) never alerts: the first tick after this
     ledger was introduced takes the current slot within a minute, and from
     then on the first attempt's timestamp bounds how long silence may last. */
}

/* ─────────────────────────── Due slots ─────────────────────────── */

/** Slots this process already finished (or saw finished) — skips the claim query. */
const settled = new Set<string>();
/** Fallback when the ledger itself is unreachable: at most once per slot per process. */
const localClaims = new Set<string>();

async function tryClaim(due: DueSlot): Promise<number | null> {
  try {
    return await claimSlot(due.slot, due.kind, processLabel());
  } catch (err) {
    /* The ledger table is missing or the query failed. Backups must not stop
       because their bookkeeping did — degrade to the old behaviour (each
       process runs its own), which at worst duplicates a file. */
    logger.error({ err, slot: due.slot }, "backup_runs claim failed — falling back to a per-process claim");
    if (localClaims.has(due.slot)) return null;
    localClaims.add(due.slot);
    return 1;
  }
}

async function runDueBackups(now: Date): Promise<void> {
  const grace = isDeploymentProcess() ? 0 : NON_DEPLOYMENT_GRACE_MINUTES;
  for (const due of dueSlots(now, settings, grace)) {
    if (settled.has(due.slot)) continue;
    const attempt = await tryClaim(due);
    if (attempt === null) continue;

    logger.info({ slot: due.slot, kind: due.kind, attempt, by: processLabel() }, "running scheduled backup");
    try {
      await runDatabaseBackup({ kind: due.kind, slot: due.slot, attempt });
      settled.add(due.slot);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error({ err, slot: due.slot, attempt }, "scheduled backup failed");
      /* The nightly is the archive copy; its failure is worth a message even
         though a retry is coming. Intraday failures are covered by the
         watchdog once two in a row are missed. */
      if (due.kind === "nightly") {
        const willRetry = attempt < MAX_ATTEMPTS;
        void sendBackupFailureAlert(
          `${reason}${willRetry ? " — will retry automatically" : " — giving up for tonight"} (attempt ${attempt}/${MAX_ATTEMPTS})`,
        );
      }
      if (attempt >= MAX_ATTEMPTS) settled.add(due.slot);
    }
  }
  /* Slots are per IST day; forget yesterday's so the set cannot grow forever. */
  if (settled.size > 200) settled.clear();
}

/* ─────────────────────────── The tick ─────────────────────────── */

let ticking = false;
let ticks = 0;

async function tick(): Promise<void> {
  /* A backup can outlast the interval on a slow day; never overlap two. */
  if (ticking) return;
  ticking = true;
  try {
    try {
      settings = await readPersistedSettings();
    } catch (err) {
      logger.warn({ err }, "could not read backup settings — using last known values");
    }
    const now = new Date();
    await runDueBackups(now);
    await watchFreshness();
    if (ticks++ % 720 === 0) await pruneOldRuns().catch(() => undefined);
  } catch (err) {
    logger.error({ err }, "backup scheduler tick failed");
  } finally {
    ticking = false;
  }
}

let started = false;

export function startBackupScheduler(): void {
  if (started) return;
  started = true;

  /* A backup with nowhere to go is not a backup. Complain loudly at boot rather
     than letting the shop find out on the day it needs to restore. */
  if (!isR2Configured() && !isTelegramConfigured()) {
    logger.error(
      "DATABASE BACKUPS ARE NOT CONFIGURED — the scheduler will run but has nowhere to " +
      "store the file. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET, " +
      "or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID.",
    );
  }

  logger.info(
    { ...settings, tickSeconds: TICK_MS / 1000, process: processLabel(), timezone: "Asia/Kolkata" },
    "backup scheduler started (nightly at HH:30 IST + intraday snapshots; slots claimed in backup_runs)",
  );
  setTimeout(() => { void tick(); }, FIRST_TICK_DELAY_MS);
  setInterval(() => { void tick(); }, TICK_MS);
}
