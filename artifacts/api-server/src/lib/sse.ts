/* ── Server-Sent Events registry ─────────────────────────────────
   All connected browser clients are stored here.
   Call broadcast() from any route to push live updates.
──────────────────────────────────────────────────────────────── */

type SseClient = {
  id:   string;
  send: (event: string, data: unknown) => void;
};

const clients = new Set<SseClient>();

/** Register a new SSE client connection. Returns a cleanup fn. */
export function addClient(
  res: import("express").Response,
): () => void {
  const id = Math.random().toString(36).slice(2);

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");   // nginx compat
  res.flushHeaders();

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const client: SseClient = { id, send };
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

/** Push an event to ALL connected clients */
export function broadcast(event: string, data: unknown): void {
  for (const client of clients) {
    try { client.send(event, data); } catch { /* ignore dead conn */ }
  }
}

export function clientCount(): number {
  return clients.size;
}
