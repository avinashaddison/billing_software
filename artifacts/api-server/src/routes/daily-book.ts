import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import { requireAdmin } from "../middlewares/auth";
import { balances, bodyObject, DailyBookError, entryInput, fail, noteInput, text, uuid, writeOnce } from "../lib/daily-book";

const router = Router();
// Same verified owner/tenant-admin gate used by owner-only coupons; never a
// client role check alone. Global auth and read-only session gates run first.
router.use("/daily-book", requireAdmin);
const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof DailyBookError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  };
const noteColumns = `id,content,entry_date::text AS "entryDate",is_task AS "isTask",due_date::text AS "dueDate",
  completed,archived,version,created_at AS "createdAt",updated_at AS "updatedAt"`;
const entryColumns = `id,account_id AS "accountId",direction,amount_paise::text AS "amountPaise",entry_date::text AS "entryDate",
  method,note,voided_at AS "voidedAt",void_reason AS "voidReason",corrected_from AS "correctedFrom",created_at AS "createdAt"`;
const accountBalance = `(SELECT COALESCE(SUM(CASE WHEN e.direction='given' THEN e.amount_paise ELSE -e.amount_paise END),0)::text
  FROM daily_khata_entries e WHERE e.account_id=a.id AND e.tenant_id IS NOT DISTINCT FROM a.tenant_id AND e.voided_at IS NULL)`;

async function accountLock(client: PoolClient, tenant: string | null, id: string, active = true) {
  const result = await client.query("SELECT * FROM daily_khata_accounts WHERE id=$1 AND tenant_id IS NOT DISTINCT FROM $2 FOR UPDATE", [id, tenant]);
  if (!result.rows[0]) fail(404, "Khata account not found");
  if (active && result.rows[0].archived) fail(409, "Restore this account before recording money");
  return result.rows[0];
}
async function insertEntry(client: PoolClient, tenant: string | null, account: string, input: ReturnType<typeof entryInput>, correctedFrom: string | null = null) {
  const result = await client.query(`INSERT INTO daily_khata_entries(tenant_id,account_id,direction,amount_paise,entry_date,method,note,corrected_from)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${entryColumns}`,
    [tenant, account, input.direction, input.amountPaise, input.entryDate, input.method, input.note, correctedFrom]);
  return result.rows[0];
}
async function mutate(req: Request, res: Response, operation: string, payload: unknown, action: Parameters<typeof writeOnce>[5]) {
  const result = await writeOnce(pool, req.tenantId ?? null, req.get("Idempotency-Key"), operation, payload, action);
  res.status(result.status).json(result.data);
}
router.get("/daily-book/notes", wrap(async (req, res) => {
  const result = await pool.query(`SELECT ${noteColumns} FROM daily_notes WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY entry_date DESC, created_at DESC`, [req.tenantId ?? null]);
  res.json(result.rows);
}));
router.post("/daily-book/notes", wrap(async (req, res) => {
  const input = noteInput(bodyObject(req.body));
  await mutate(req, res, "note:create", input, async client => {
    const result = await client.query(`INSERT INTO daily_notes(tenant_id,content,entry_date,is_task,due_date) VALUES($1,$2,$3,$4,$5) RETURNING ${noteColumns}`,
      [req.tenantId ?? null, input.content, input.entryDate, input.isTask, input.dueDate]);
    return { status: 201, data: result.rows[0] };
  });
}));
router.patch("/daily-book/notes/:id", wrap(async (req, res) => {
  const id = uuid(req.params.id), body = bodyObject(req.body), version = body.version;
  if (!Number.isInteger(version) || Number(version) < 1) fail(400, "Note version is required");
  const input = noteInput(body);
  if (typeof body.completed !== "boolean" || typeof body.archived !== "boolean" || (!input.isTask && body.completed)) fail(400, "Invalid task or archive state");
  const payload = { ...input, completed: body.completed, archived: body.archived, version };
  await mutate(req, res, `note:update:${id}`, payload, async client => {
    const result = await client.query(`UPDATE daily_notes SET content=$1,entry_date=$2,is_task=$3,due_date=$4,completed=$5,archived=$6,
      version=version+1,updated_at=now() WHERE id=$7 AND tenant_id IS NOT DISTINCT FROM $8 AND version=$9 RETURNING ${noteColumns}`,
      [input.content,input.entryDate,input.isTask,input.dueDate,body.completed,body.archived,id,req.tenantId ?? null,version]);
    if (!result.rows[0]) {
      const exists = await client.query("SELECT 1 FROM daily_notes WHERE id=$1 AND tenant_id IS NOT DISTINCT FROM $2", [id, req.tenantId ?? null]);
      fail(exists.rowCount ? 409 : 404, exists.rowCount ? "This note changed on another device. Reload and try again." : "Note not found");
    }
    return { status: 200, data: result.rows[0] };
  });
}));
router.get("/daily-book/accounts", wrap(async (req, res) => {
  const result = await pool.query(`SELECT a.id,a.name,a.archived,a.created_at AS "createdAt",${accountBalance} AS "balancePaise"
    FROM daily_khata_accounts a WHERE a.tenant_id IS NOT DISTINCT FROM $1 ORDER BY a.name,a.id`, [req.tenantId ?? null]);
  res.json({ accounts: result.rows, ...balances(result.rows.map(row => row.balancePaise)) });
}));
router.post("/daily-book/accounts", wrap(async (req, res) => {
  const name = text(bodyObject(req.body).name, 120, "Name");
  await mutate(req, res, "account:create", { name }, async client => {
    const result = await client.query(`INSERT INTO daily_khata_accounts(tenant_id,name) VALUES($1,$2) RETURNING id,name,archived,created_at AS "createdAt",'0' AS "balancePaise"`, [req.tenantId ?? null, name]);
    return { status: 201, data: result.rows[0] };
  });
}));
router.patch("/daily-book/accounts/:id", wrap(async (req, res) => {
  const id = uuid(req.params.id), archived = bodyObject(req.body).archived;
  if (typeof archived !== "boolean") fail(400, "Choose archive or restore");
  await mutate(req, res, `account:archive:${id}`, { archived }, async client => {
    await accountLock(client, req.tenantId ?? null, id, false);
    const balance = await client.query(`SELECT ${accountBalance} AS balance FROM daily_khata_accounts a WHERE a.id=$1 AND a.tenant_id IS NOT DISTINCT FROM $2`, [id,req.tenantId ?? null]);
    if (archived && balance.rows[0].balance !== "0") fail(409, "Settle this account before archiving it");
    await client.query("UPDATE daily_khata_accounts SET archived=$1 WHERE id=$2 AND tenant_id IS NOT DISTINCT FROM $3", [archived,id,req.tenantId ?? null]);
    return { status: 200, data: { id, archived } };
  });
}));
router.get("/daily-book/accounts/:id/entries", wrap(async (req, res) => {
  const id = uuid(req.params.id);
  const account = await pool.query("SELECT id FROM daily_khata_accounts WHERE id=$1 AND tenant_id IS NOT DISTINCT FROM $2", [id,req.tenantId ?? null]);
  if (!account.rowCount) fail(404, "Khata account not found");
  const entries = await pool.query(`SELECT ${entryColumns} FROM daily_khata_entries WHERE account_id=$1 AND tenant_id IS NOT DISTINCT FROM $2 ORDER BY entry_date DESC,created_at DESC`, [id,req.tenantId ?? null]);
  res.json(entries.rows);
}));
router.post("/daily-book/accounts/:id/entries", wrap(async (req, res) => {
  const id = uuid(req.params.id), input = entryInput(bodyObject(req.body));
  await mutate(req,res,`entry:create:${id}`,input,async client => {
    await accountLock(client,req.tenantId ?? null,id);
    return { status:201,data:await insertEntry(client,req.tenantId ?? null,id,input) };
  });
}));
router.post("/daily-book/accounts/:id/entries/:entryId/correct", wrap(async (req,res) => {
  const id = uuid(req.params.id), entryId = uuid(req.params.entryId), body = bodyObject(req.body);
  const reason = text(body.reason,500,"Correction reason");
  const replacement = body.replacement == null ? null : entryInput(bodyObject(body.replacement));
  await mutate(req,res,`entry:correct:${id}:${entryId}`,{reason,replacement},async client => {
    await accountLock(client,req.tenantId ?? null,id);
    const original = await client.query("SELECT id,voided_at FROM daily_khata_entries WHERE id=$1 AND account_id=$2 AND tenant_id IS NOT DISTINCT FROM $3 FOR UPDATE", [entryId,id,req.tenantId ?? null]);
    if (!original.rows[0]) fail(404,"Money entry not found");
    if (original.rows[0].voided_at) fail(409,"This entry has already been corrected");
    await client.query("UPDATE daily_khata_entries SET voided_at=now(),void_reason=$1 WHERE id=$2 AND account_id=$3 AND tenant_id IS NOT DISTINCT FROM $4", [reason,entryId,id,req.tenantId ?? null]);
    const newEntry = replacement ? await insertEntry(client,req.tenantId ?? null,id,replacement,entryId) : null;
    return { status:200,data:{voidedId:entryId,replacement:newEntry} };
  });
}));
export default router;
