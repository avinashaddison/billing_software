/**
 * Session-authenticated management surface for public API keys.
 *
 * Owner-only (requireAdmin): a key grants programmatic access to ALL of the
 * shop's data, which is beyond any per-resource staff permission. The raw
 * key is returned exactly once, at creation; afterwards only the prefix is
 * visible. Revocation is final — mint a new key instead of un-revoking.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, apiKeysTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { tenantWhereWrite } from "../lib/tenant";
import { generateApiKey } from "../lib/api-keys";
import { recordAudit, tenantActor } from "../lib/audit";

const router: IRouter = Router();

/** Everything except key_hash — the hash must never leave the server. */
const PUBLIC_COLUMNS = {
  id:         apiKeysTable.id,
  name:       apiKeysTable.name,
  keyPrefix:  apiKeysTable.keyPrefix,
  scope:      apiKeysTable.scope,
  createdBy:  apiKeysTable.createdBy,
  createdAt:  apiKeysTable.createdAt,
  lastUsedAt: apiKeysTable.lastUsedAt,
  revokedAt:  apiKeysTable.revokedAt,
};

const MAX_ACTIVE_KEYS = 10;

router.get("/api-keys", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select(PUBLIC_COLUMNS).from(apiKeysTable)
    .where(tenantWhereWrite(apiKeysTable.tenantId, req.tenantId))
    .orderBy(desc(apiKeysTable.createdAt));
  res.json(rows);
});

const CreateKeyBody = z.object({
  name:  z.string().trim().min(1).max(60),
  scope: z.enum(["read", "write"]),
});

router.post("/api-keys", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Give the key a name and pick a permission (read or write)" });
    return;
  }

  const { key, hash, prefix } = generateApiKey();
  const actor = await tenantActor(req);

  /* Count + insert must be atomic: two "create" clicks racing each other
     could both observe 9 active keys and both insert, blowing past the cap.
     A per-tenant advisory lock serialises creation for this shop only —
     other shops' creations are unaffected. */
  const row = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`api-keys:${req.tenantId ?? "__legacy__"}`})::bigint)`,
    );
    const [{ n: activeCount }] = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(apiKeysTable)
      .where(and(
        tenantWhereWrite(apiKeysTable.tenantId, req.tenantId),
        isNull(apiKeysTable.revokedAt),
      ));
    if (activeCount >= MAX_ACTIVE_KEYS) return null;
    const [created] = await tx.insert(apiKeysTable).values({
      tenantId:  req.tenantId,
      name:      parsed.data.name,
      keyHash:   hash,
      keyPrefix: prefix,
      scope:     parsed.data.scope,
      createdBy: actor.actorEmail,
    }).returning(PUBLIC_COLUMNS);
    return created ?? null;
  });

  if (!row) {
    res.status(400).json({
      error: `Limit reached: a shop can have at most ${MAX_ACTIVE_KEYS} active API keys. Revoke one first.`,
    });
    return;
  }

  void recordAudit({
    action: "tenant.apikey.create",
    ...actor,
    targetTenant: req.tenantId ?? null,
    metadata: { apiKeyId: row.id, name: row.name, scope: row.scope },
    ip: req.ip,
  });

  /* `key` appears here and NOWHERE else, ever again. */
  res.status(201).json({ key, apiKey: row });
});

router.post("/api-keys/:id/revoke", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!z.uuid().safeParse(id).success) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  const [row] = await db.update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(apiKeysTable.id, id),
      tenantWhereWrite(apiKeysTable.tenantId, req.tenantId),
      isNull(apiKeysTable.revokedAt),
    ))
    .returning(PUBLIC_COLUMNS);
  if (!row) { res.status(404).json({ error: "API key not found (or already revoked)" }); return; }

  void (async () => {
    await recordAudit({
      action: "tenant.apikey.revoke",
      ...(await tenantActor(req)),
      targetTenant: req.tenantId ?? null,
      metadata: { apiKeyId: row.id, name: row.name },
      ip: req.ip,
    });
  })();

  res.json(row);
});

export default router;
