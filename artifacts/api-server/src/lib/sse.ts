/* ── Server-Sent Events registry ─────────────────────────────────
   All connected browser clients are stored here, keyed by tenant.
   Call broadcast(event, data, tenantId) from any route to push
   live updates to the matching tenant's clients.

   Tenant scoping rules (matches the migration's "tenant_id = :t OR
   tenant_id IS NULL" rule):

   - A client connected with tenantId=X receives:
       • events broadcast for tenantId=X
       • events broadcast for tenantId=null (legacy fan-out)
   - A client connected with tenantId=null receives:
       • events broadcast for tenantId=null
       • (during migration) events broadcast for ANY tenantId — this
         preserves the legacy Hira & Sons "see everything" behaviour
         while STRICT_TENANT is disabled.
──────────────────────────────────────────────────────────────── */

import { strictTenantEnabled } from "./tenant";

type SseClient = {
  id:       string;
  tenantId: string | null;
  send:     (event: string, data: unknown) => void;
};

const clients = new Set<SseClient>();

/** Register a new SSE client connection. Returns a cleanup fn. */
export function addClient(
  res: import("express").Response,
  tenantId: string | null = null,
): () => void {
  const id = Math.random().toString(36).slice(2);

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");   // nginx compat
  res.flushHeaders();

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, tenantId })}\n\n`);

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const client: SseClient = { id, tenantId, send };
  clients.add(client);

  // Keep-alive ping every 25 s (prevents proxy timeouts)
  const ping = setInterval(() => {
    res.write(":ping\n\n");
  }, 25_000);

  return () => {
    clearInterval(ping);
    clients.delete(client);
  };
}

/**
 * Push an event to the clients of one tenant.
 *
 * - tenantId === undefined → backwards-compatible global broadcast
 *   (every client receives the event). Used by background jobs.
 * - tenantId === null → broadcast to legacy/Hira & Sons clients only,
 *   plus all other clients while STRICT_TENANT is disabled (NULL is
 *   shared during the migration window).
 * - tenantId === string → broadcast to clients with that tenant +
 *   to legacy NULL clients (so the Hira owner still sees everything
 *   during migration).
 *
 * forceStrict === true → ignore the migration "see everything" fan-out and
 *   deliver ONLY to clients whose tenant matches exactly (null matches null).
 *   Use this for ephemeral, per-shop UI state (e.g. the live shared cart) that
 *   must never cross shops, even while STRICT_TENANT is disabled.
 */
export function broadcast(
  event: string,
  data: unknown,
  tenantId?: string | null,
  forceStrict = false,
): void {
  const strict = forceStrict || strictTenantEnabled();
  for (const client of clients) {
    let shouldSend: boolean;

    if (tenantId === undefined) {
      // background/legacy callers: global fan-out
      shouldSend = true;
    } else if (tenantId === null) {
      // null = legacy event. Always send to null clients. While migration
      // is in progress (STRICT_TENANT=false), also send to tenant clients
      // so they see legacy-tagged data alongside their own.
      shouldSend = client.tenantId === null || !strict;
    } else {
      // tenant-tagged event. Always send to matching tenant clients.
      // Also send to null clients (the legacy/Hira owner) while migration
      // is in progress, so they can monitor activity across tenants.
      if (client.tenantId === tenantId) shouldSend = true;
      else if (client.tenantId === null && !strict) shouldSend = true;
      else shouldSend = false;
    }

    if (!shouldSend) continue;
    try { client.send(event, data); } catch { /* ignore dead conn */ }
  }
}

export function clientCount(): number {
  return clients.size;
}
