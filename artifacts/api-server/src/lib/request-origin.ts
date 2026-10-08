/** CORS is a read policy, not CSRF protection. Validate browser writes separately. */
export function allowsWriteOrigin(origin: string | undefined, requestOrigin: string, allowed: string[]): boolean {
  // Non-browser clients may omit Origin; cookies are SameSite=Lax and browsers
  // send Origin on cross-origin writes. Bearer API callers use a separate path.
  if (origin === undefined) return true;
  try {
    const normalized = new URL(origin).origin;
    if (origin !== normalized || normalized === "null") return false;
    return normalized === requestOrigin || allowed.includes(normalized);
  } catch {
    return false;
  }
}
