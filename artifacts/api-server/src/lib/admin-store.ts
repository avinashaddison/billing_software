import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

/** Walk up to repo root (where .license-secret lives) so the history file
 *  ends up next to it — same layout for both files keeps backups simple. */
function findRepoRoot(): string {
  let dir = path.dirname(__filename);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const HISTORY_FILE = path.join(findRepoRoot(), ".license-history.json");

export interface LicenseRecord {
  id:        string;       // short uuid for revocation marking
  shop:      string;
  edition:   string;
  expiry:    string;       // YYYY-MM-DD or "perpetual"
  issued:    string;       // YYYY-MM-DD
  key:       string;       // the full signed token
  notes?:    string;       // free-form vendor note ("paid via UPI on …")
  createdAt: string;       // ISO timestamp
  revokedAt?: string | null;
}

interface HistoryFile {
  version:   1;
  records:   LicenseRecord[];
}

function load(): HistoryFile {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return { version: 1, records: [] };
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw) as HistoryFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      return { version: 1, records: [] };
    }
    return parsed;
  } catch {
    return { version: 1, records: [] };
  }
}

function save(data: HistoryFile): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function listLicenses(): LicenseRecord[] {
  return load().records.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendLicense(record: Omit<LicenseRecord, "id" | "createdAt">): LicenseRecord {
  const data = load();
  const id   = Math.random().toString(36).slice(2, 10);
  const full: LicenseRecord = { ...record, id, createdAt: new Date().toISOString() };
  data.records.push(full);
  save(data);
  return full;
}

export function markRevoked(id: string): LicenseRecord | null {
  const data = load();
  const rec = data.records.find((r) => r.id === id);
  if (!rec) return null;
  rec.revokedAt = new Date().toISOString();
  save(data);
  return rec;
}

export function deleteRecord(id: string): boolean {
  const data = load();
  const before = data.records.length;
  data.records = data.records.filter((r) => r.id !== id);
  if (data.records.length === before) return false;
  save(data);
  return true;
}
