const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
let pendingLogout: Promise<void> | null = null;

/** Serialize sign-out and the next sign-in so an old response cannot clear
 * the freshly issued cookie. Local sign-out remains immediate, even offline. */
export function endServerSession(): Promise<void> {
  if (pendingLogout) return pendingLogout;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const request = fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    signal: controller.signal,
  }).then((response) => {
    if (!response.ok) throw new Error("Server sign-out could not be confirmed");
  });
  pendingLogout = request;
  const clear = () => {
    clearTimeout(timer);
    if (pendingLogout === request) pendingLogout = null;
  };
  void request.then(clear, clear);
  return request;
}

export function waitForServerLogout(): Promise<void> {
  return pendingLogout ?? Promise.resolve();
}
