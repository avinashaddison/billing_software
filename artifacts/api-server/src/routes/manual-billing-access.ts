import { Router, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { randomBytes } from "node:crypto";
import { requireAdmin, requireWrite } from "../middlewares/auth";
import { broadcast } from "../lib/sse";
import { billingActor, decryptAccessKey, digest, encryptAccessKey, generateAccessKey, keyMatches, normalizeKey, ManualAccessError } from "../lib/manual-billing-access";
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request,res: Response,next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store");
  try { await fn(req,res); } catch (e) {
    if (e instanceof ManualAccessError) { res.status(e.status).json({error:e.message,code:e.code}); return; }
    next(e);
  }
};
export function createManualBillingAccessRouter(secret: () => string = () => process.env.SESSION_SECRET ?? "") {
const router = Router();
router.get("/manual-billing/access-key",requireAdmin,wrap(async (req,res) => {
  if (req.viewAsReadOnly) throw new ManualAccessError(403,"Only the shop owner can view the access key. It is hidden in read-only support sessions.","OWNER_ACCESS_REQUIRED");
  const tenant=req.tenantId ?? null;
  const result=await db.execute(sql`SELECT encrypted_key,generated_at FROM manual_billing_keys WHERE tenant_id IS NOT DISTINCT FROM ${tenant}`);
  const row=result.rows[0] as {encrypted_key:string;generated_at:Date} | undefined;
  if (!row) { res.json({currentKey:null,generatedAt:null}); return; }
  try { res.json({currentKey:decryptAccessKey(row.encrypted_key,tenant,secret()),generatedAt:row.generated_at}); }
  catch { throw new ManualAccessError(503,"The current key cannot be displayed. Regenerate a new key to restore access.","MANUAL_ACCESS_UNAVAILABLE"); }
}));
router.post("/manual-billing/access-key",requireAdmin,wrap(async (req,res) => {
  const tenant=req.tenantId ?? null;
  const key=generateAccessKey();
  const encrypted=encryptAccessKey(key,tenant,secret());
  const result=await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`manual-key:${tenant ?? "__legacy_null__"}`},0))`);
    const result=await tx.execute(sql`INSERT INTO manual_billing_keys(tenant_id,key_hash,encrypted_key) VALUES
      (${tenant},${digest(normalizeKey(key))},${encrypted})
      ON CONFLICT ((COALESCE(tenant_id,'__legacy_null__'))) DO UPDATE SET
      key_hash=EXCLUDED.key_hash,encrypted_key=EXCLUDED.encrypted_key,revision=gen_random_uuid(),generated_at=now()
      RETURNING generated_at`);
    await tx.execute(sql`DELETE FROM manual_billing_key_attempts WHERE tenant_id IS NOT DISTINCT FROM ${tenant}`);
    return result;
  });
  broadcast("manual_billing_key_changed",{},tenant);
  res.json({currentKey:key,generatedAt:result.rows[0].generated_at});
}));
router.post("/manual-billing/authorize",requireWrite("scan"),wrap(async(req,res) => {
  const actor=await billingActor(req);
  if (actor.owner) { res.json({approvalToken:null,expiresAt:null}); return; }
  const tenant=req.tenantId ?? null;
  const result=await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`manual-key-attempt:${tenant ?? "__legacy_null__"}:${actor.id}`},0))`);
    const keys=await tx.execute(sql`SELECT key_hash,revision FROM manual_billing_keys WHERE tenant_id IS NOT DISTINCT FROM ${tenant} FOR SHARE`);
    await tx.execute(sql`INSERT INTO manual_billing_key_attempts(tenant_id,actor_id) VALUES(${tenant},${actor.id}) ON CONFLICT DO NOTHING`);
    const attempts=await tx.execute(sql`SELECT failures,window_start FROM manual_billing_key_attempts
      WHERE tenant_id IS NOT DISTINCT FROM ${tenant} AND actor_id=${actor.id} FOR UPDATE`);
    const a=attempts.rows[0] as { failures:number;window_start:Date };
    const fresh=Date.now()-new Date(a.window_start).getTime()<15*60_000;
    if (fresh && a.failures>=5) return {error:"Too many incorrect keys. Wait 15 minutes or ask the owner to regenerate.",status:429};
    const key=keys.rows[0] as {key_hash:string;revision:string} | undefined;
    if (!key || !keyMatches(req.body?.key,key.key_hash)) {
      // Return, don't throw: failed-attempt counters must commit.
      await tx.execute(sql`UPDATE manual_billing_key_attempts SET failures=${fresh?a.failures+1:1},
        window_start=CASE WHEN ${fresh} THEN window_start ELSE now() END
        WHERE tenant_id IS NOT DISTINCT FROM ${tenant} AND actor_id=${actor.id}`);
      return {error:key?"Incorrect access key. Ask the owner for the current key.":"The owner must generate a manual billing access key first.",status:403};
    }
    await tx.execute(sql`UPDATE manual_billing_key_attempts SET failures=0,window_start=now()
      WHERE tenant_id IS NOT DISTINCT FROM ${tenant} AND actor_id=${actor.id}`);
    const token=randomBytes(32).toString("base64url");
    const grants=await tx.execute(sql`INSERT INTO manual_billing_approvals(tenant_id,actor_id,token_hash,key_revision,expires_at)
      VALUES(${tenant},${actor.id},${digest(token)},${key.revision},now()+interval '10 minutes') RETURNING expires_at`);
    return {approvalToken:token,expiresAt:grants.rows[0].expires_at};
  });
  if ("error" in result) { res.status(result.status!).json({error:result.error,code:"MANUAL_ACCESS_REQUIRED"}); return; }
  res.json(result);
}));
router.post("/manual-billing/validate",requireWrite("scan"),wrap(async(req,res) => {
  const actor=await billingActor(req);
  if (actor.owner) { res.json({valid:true}); return; }
  const token=req.body?.approvalToken;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ManualAccessError(403,"Enter the owner's access key.");
  const tenant=req.tenantId ?? null;
  const result=await db.execute(sql`SELECT a.id FROM manual_billing_approvals a JOIN manual_billing_keys k
    ON k.tenant_id IS NOT DISTINCT FROM a.tenant_id
    WHERE a.tenant_id IS NOT DISTINCT FROM ${tenant} AND a.actor_id=${actor.id}
    AND a.token_hash=${digest(token)}
    AND (a.response IS NOT NULL OR (a.expires_at>now() AND a.key_revision=k.revision))`);
  if (!result.rows.length) throw new ManualAccessError(403,"Approval expired or the owner regenerated the key. Ask for the current key.");
  res.json({valid:true});
}));
return router;
}
export default createManualBillingAccessRouter();
