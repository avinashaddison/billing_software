/**
 * Shape validation for a "json-snapshot-v1" backup file.
 *
 * Kept in its own module with NO database import so it can be unit-tested — the
 * restore path it guards is the most destructive code in the app and must not
 * be reasoned about only in production.
 *
 * A restore TRUNCATEs every table it is about to refill. So "this key exists"
 * is not enough to act on: a table whose value is `{}` or `null` passes a naive
 * `typeof data === "object"` check, contributes no rows to re-insert, and the
 * restore happily empties the real table and commits. Every table's rows must
 * be proven to be an array of row objects BEFORE anything is truncated.
 */

export const SNAPSHOT_FORMAT = "json-snapshot-v1";

export type SnapshotRow    = Record<string, unknown>;
export type SnapshotTables = Record<string, SnapshotRow[]>;

export interface SnapshotMeta {
  format?:  string;
  takenAt?: string;
  [key: string]: unknown;
}

export interface ValidSnapshot {
  meta: SnapshotMeta;
  data: SnapshotTables;
}

/** A non-null, non-array object. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a parsed snapshot, or throw with a message safe to show an admin.
 * Returns the same data narrowed to a type the restore can trust.
 */
export function validateSnapshot(payload: unknown): ValidSnapshot {
  if (!isPlainObject(payload)) {
    throw new Error("Unrecognised backup format — expected an Addison Bill json-snapshot-v1 file");
  }

  const meta = isPlainObject(payload["meta"]) ? (payload["meta"] as SnapshotMeta) : undefined;
  if (meta?.format !== SNAPSHOT_FORMAT) {
    throw new Error("Unrecognised backup format — expected an Addison Bill json-snapshot-v1 file");
  }

  const data = payload["data"];
  if (!isPlainObject(data)) {
    throw new Error("This backup has no table data in it — nothing to restore");
  }

  const tables = Object.keys(data);
  if (tables.length === 0) {
    throw new Error("This backup has no table data in it — nothing to restore");
  }

  /* Every table must be a real array of rows. Anything else means a corrupt or
     hand-edited file, and acting on it would empty a live table with nothing to
     put back. Refuse the whole file rather than restore it in part. */
  for (const table of tables) {
    const rows = data[table];
    if (!Array.isArray(rows)) {
      throw new Error(
        `This backup is damaged: the "${table}" table is not a list of rows, so restoring it ` +
        `would erase that table and put nothing back. Nothing was changed.`,
      );
    }
    for (let i = 0; i < rows.length; i++) {
      if (!isPlainObject(rows[i])) {
        throw new Error(
          `This backup is damaged: row ${i + 1} of the "${table}" table is not a record. Nothing was changed.`,
        );
      }
    }
  }

  return { meta, data: data as SnapshotTables };
}
