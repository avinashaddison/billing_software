export class LoginResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginResponseError";
  }
}

/** Keep proxy/HTTP failures distinct from a rejected password or PIN. */
export async function readLoginResponse<T>(
  response: Response,
  requiredStrings: readonly string[],
): Promise<T> {
  if (response.status >= 500) {
    throw new LoginResponseError(
      `Login server is temporarily unavailable (HTTP ${response.status}). Please retry shortly.`,
    );
  }
  const unexpected = () => new LoginResponseError(
    `Unexpected login response (HTTP ${response.status}). Reload the page and retry.`,
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw unexpected();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw unexpected();
  const payload = body as Record<string, unknown>;
  if (response.ok && requiredStrings.some(
    (key) => typeof payload[key] !== "string" || payload[key] === "",
  )) throw unexpected();
  // Error responses cannot render arbitrary objects as React text.
  for (const key of ["error", "message", "lockedUntil"]) {
    if (payload[key] !== undefined && typeof payload[key] !== "string") delete payload[key];
  }
  if (payload.attemptsLeft !== undefined &&
    (typeof payload.attemptsLeft !== "number" || !Number.isFinite(payload.attemptsLeft))) {
    delete payload.attemptsLeft;
  }
  return payload as T;
}

export function loginFailureMessage(error: unknown): string {
  return error instanceof LoginResponseError
    ? error.message
    : "Login request could not reach the server. Check your connection and retry.";
}
