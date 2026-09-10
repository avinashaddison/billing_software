/**
 * The `backup_runs` ledger (migration 0022): one row per backup attempt.
 *
 * It is both the lock and the record. A scheduled backup is a named slot that
 * a process must claim with a single INSERT ... ON CONFLICT before it dumps
 * anything — whichever process wins the primary key wins the slot, so the
 * deployment and a dev workspace ticking against the same database can never
 * both take the 02:30 nightly. The same row then holds the outcome, which is
 * what the admin page, the public freshness endpoint and the staleness alert
 * read: "last successful backup" no longer has to be inferred from R2 file
 * dates (and Telegram-only deliveries used to leave no trace at all).
 *
 * Re-claim rules, so a crash mid-backup or a transient failure self-heals:
 *   - a `running` row older than STALE_RUNNING_MINUTES is treated as dead;
 *   - a `failed` row is retried after RETRY_AFTER_MINUTES, up to MAX_ATTEMPTS.
 */
import { pool } from "@workspace/db";
import type { BackupKind } from "./backup-schedule";

export type BackupRunStatus = "running" | "ok" | "failed";

export interface BackupRun {
  slot: string;
  kind: BackupKind;
  status: BackupRunStatus;
  attempts: number;
  claimedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  r2Key: string | null;
  telegram: boolean;
  encrypted: boolean;
  sizeBytes: number | null;
  tables: number | null;
  totalRows: number | null;
  error: string | null;
}

export interface BackupRunOutcome {
  r2Key: string | null;
  telegram: boolean;
  encrypted: boolean;
  sizeBytes: number;
  tables: number;
  totalRows: number;
}

export const STALE_RUNNING_MINUTES = 20;
export const RETRY_AFTER_MINUTES   = 10;
export const MAX_ATTEMPTS          = 3;

interface RunRow {
  slot: string; kind: string; status: string; attempts: number; claimed_by: string | null;
  started_at: Date; finished_at: Date | null; r2_key: string | null; telegram: boolean;
  encrypted: boolean; size_bytes: string | null; tables: number | null; total_rows: string | null;
  error: string | null;
}

const COLS = `slot, kind, status, attempts, claimed_by, started_at, finished_at, r2_key,
              telegram, encrypted, size_bytes, tables, total_rows, error`;

function toRun(r: RunRow): BackupRun {
  return {
    slot: r.slot,
    kind: r.kind as BackupKind,
    status: r.status as BackupRunStatus,
    attempts: r.attempts,
    claimedBy: r.claimed_by,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
    r2Key: r.r2_key,
    telegram: r.telegram,
    encrypted: r.encrypted,
    sizeBytes: r.size_bytes === null ? null : Number(r.size_bytes),
    tables: r.tables,
    totalRows: r.total_rows === null ? null : Number(r.total_rows),
    error: r.error,
  };
}

/** A label for the process taking the slot — for the ledger and the logs. */
export function processLabel(): string {
  const where = process.env["REPLIT_DEPLOYMENT"] === "1" ? "deployment" : "workspace";
  return `${where}#${process.pid}`;
}

/**
 * Try to take a slot. Returns the attempt number when this process now owns
 * it, or null when another process has it (running, or already succeeded, or
 * failed too many times).
 */
export async function claimSlot(slot: string, kind: BackupKind, claimedBy = processLabel()): Promise<number | null> {
  const { rows } = await pool.query<{ attempts: number }>(
    `INSERT INTO backup_runs (slot, kind, status, claimed_by)
     VALUES ($1, $2, 'running', $3)
     ON CONFLICT (slot) DO UPDATE SET
       status      = 'running',
       claimed_by  = EXCLUDED.claimed_by,
       started_at  = now(),
       finished_at = NULL,
       error       = NULL,
       attempts    = backup_runs.attempts + 1
     WHERE backup_runs.attempts < $6
       AND (   (backup_runs.status = 'running' AND backup_runs.started_at < now() - make_interval(mins => $4))
            OR (backup_runs.status = 'failed'  AND backup_runs.started_at < now() - make_interval(mins => $5)))
     RETURNING attempts`,
    [slot, kind, claimedBy, STALE_RUNNING_MINUTES, RETRY_AFTER_MINUTES, MAX_ATTEMPTS],
  );
  return rows[0]?.attempts ?? null;
}

/** Open a row for an unscheduled run (manual button, pre-restore safety copy). */
export async function beginAdHocRun(kind: BackupKind, claimedBy = processLabel()): Promise<string> {
  const slot = `${kind}:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO backup_runs (slot, kind, status, claimed_by) VALUES ($1, $2, 'running', $3)`,
    [slot, kind, claimedBy],
  );
  return slot;
}

/**
 * Outcome writes are fenced by the attempt number: a worker whose slot was
 * declared dead and re-claimed (it was merely slow) finds `attempts` moved on
 * and writes nothing, so the successor's outcome stands. Ad-hoc runs pass no
 * attempt — nobody else can claim their unique slot. Resolves false when the
 * write was fenced out.
 */
export async function finishRun(slot: string, outcome: BackupRunOutcome, attempt: number | null = null): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE backup_runs SET status = 'ok', finished_at = now(), error = NULL,
            r2_key = $2, telegram = $3, encrypted = $4, size_bytes = $5, tables = $6, total_rows = $7
      WHERE slot = $1 AND status = 'running' AND ($8::int IS NULL OR attempts = $8)
      RETURNING slot`,
    [slot, outcome.r2Key, outcome.telegram, outcome.encrypted, outcome.sizeBytes, outcome.tables, outcome.totalRows, attempt],
  );
  return rows.length > 0;
}

export async function failRun(slot: string, error: string, attempt: number | null = null): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE backup_runs SET status = 'failed', finished_at = now(), error = $2
      WHERE slot = $1 AND status = 'running' AND ($3::int IS NULL OR attempts = $3)
      RETURNING slot`,
    [slot, error.slice(0, 1000), attempt],
  );
  return rows.length > 0;
}

/** When the very first run (of any outcome) was attempted — the moment the
 *  watchdog's clock starts for an installation that has never succeeded. */
export async function firstRunStartedAt(): Promise<Date | null> {
  const { rows } = await pool.query<{ first: Date | null }>(`SELECT min(started_at) AS first FROM backup_runs`);
  return rows[0]?.first ?? null;
}

export async function lastSuccessfulRun(): Promise<BackupRun | null> {
  const { rows } = await pool.query<RunRow>(
    `SELECT ${COLS} FROM backup_runs WHERE status = 'ok' ORDER BY finished_at DESC NULLS LAST LIMIT 1`,
  );
  return rows[0] ? toRun(rows[0]) : null;
}

export async function recentRuns(limit = 12): Promise<BackupRun[]> {
  const { rows } = await pool.query<RunRow>(
    `SELECT ${COLS} FROM backup_runs ORDER BY started_at DESC LIMIT $1`,
    [Math.max(1, Math.min(100, limit))],
  );
  return rows.map(toRun);
}

/** Keep the ledger small: outcomes older than this are only noise. */
export async function pruneOldRuns(keepDays = 90): Promise<void> {
  await pool.query(
    `DELETE FROM backup_runs WHERE started_at < now() - make_interval(days => $1) AND status <> 'running'`,
    [keepDays],
  );
}
