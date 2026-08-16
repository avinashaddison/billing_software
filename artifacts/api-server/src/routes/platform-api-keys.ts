/**
 * Platform-admin management of public API keys.
 *
 * Key issuing is deliberately OFF the shop-owner surface (for now): only the
 * vendor can create or revoke keys, per shop, from the /admin console. The
 * shop hands the key to whoever integrates with them.
 *
 * The raw key is returned exactly once, at creation; afterwards only the
 * prefix is visible. Revocation is final — mint a new key instead.
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, apiKeysTable, tenantsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/platform-admin";
import { generateApiKey } from "../lib/api-keys";
import { recordAudit } from "../lib/audit";

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

async function tenantExists(id: string): Promise<boolean> {
  const [t] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  return !!t;
}

/* ───── GET /api/platform/tenants/:id/api-keys — list (incl. revoked) ── */
router.get("/platform/tenants/:id/api-keys", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  if (!(await tenantExists(tenantId))) {
    res.status(404).json({ error: "Shop not found" });
    return;
  }
  const rows = await db.select(PUBLIC_COLUMNS).from(apiKeysTable)
    .where(eq(apiKeysTable.tenantId, tenantId))
    .orderBy(desc(apiKeysTable.createdAt));
  res.json(rows);
});

const CreateKeyBody = z.object({
  name:  z.string().trim().min(1).max(60),
  scope: z.enum(["read", "write"]),
});

/* ───── POST /api/platform/tenants/:id/api-keys — create, reveal once ── */
router.post("/platform/tenants/:id/api-keys", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const parsed = CreateKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Give the key a name and pick a permission (read or write)" });
    return;
  }
  if (!(await tenantExists(tenantId))) {
    res.status(404).json({ error: "Shop not found" });
    return;
  }

  const { key, hash, prefix } = generateApiKey();

  /* Count + insert must be atomic: two racing creates could both observe 9
     active keys and both insert, blowing past the cap. A per-tenant advisory
     lock serialises creation for this shop only. */
  const row = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`api-keys:${tenantId}`})::bigint)`,
    );
    const [{ n: activeCount }] = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(apiKeysTable)
      .where(and(
        eq(apiKeysTable.tenantId, tenantId),
        isNull(apiKeysTable.revokedAt),
      ));
    if (activeCount >= MAX_ACTIVE_KEYS) return null;
    const [created] = await tx.insert(apiKeysTable).values({
      tenantId,
      name:      parsed.data.name,
      keyHash:   hash,
      keyPrefix: prefix,
      scope:     parsed.data.scope,
      createdBy: req.platformActor!.email,
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
    action:       "tenant.apikey.create",
    actorId:      req.platformActor!.id,
    actorEmail:   req.platformActor!.email,
    targetTenant: tenantId,
    metadata:     { apiKeyId: row.id, name: row.name, scope: row.scope },
    ip:           req.ip,
  });

  /* `key` appears here and NOWHERE else, ever again. */
  res.status(201).json({ key, apiKey: row });
});

/* ───── POST /api/platform/tenants/:id/api-keys/:keyId/revoke ────────── */
router.post("/platform/tenants/:id/api-keys/:keyId/revoke", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const keyId    = String(req.params.keyId);
  if (!z.uuid().safeParse(keyId).success) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  const [row] = await db.update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(apiKeysTable.id, keyId),
      eq(apiKeysTable.tenantId, tenantId),
      isNull(apiKeysTable.revokedAt),
    ))
    .returning(PUBLIC_COLUMNS);
  if (!row) {
    res.status(404).json({ error: "API key not found (or already revoked)" });
    return;
  }

  void recordAudit({
    action:       "tenant.apikey.revoke",
    actorId:      req.platformActor!.id,
    actorEmail:   req.platformActor!.email,
    targetTenant: tenantId,
    metadata:     { apiKeyId: row.id, name: row.name },
    ip:           req.ip,
  });

  res.json(row);
});

export default router;
