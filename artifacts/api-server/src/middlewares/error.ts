import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

const isProd = process.env.NODE_ENV === "production";

/**
 * JSON 404 for unmatched `/api/*` routes. Mounted on "/api" AFTER the router so
 * a missing endpoint returns `{ error }` instead of falling through to the
 * production SPA fallback (which would serve index.html for an API call).
 */
export function apiNotFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
}

/* ── Error shape detectors (structural, so we don't need to import zod/multer
   just to instanceof-check) ─────────────────────────────────────────────── */

interface ZodIssue { path: (string | number)[]; message: string }
interface ZodLikeError { name: string; issues: ZodIssue[] }

function isZodError(e: unknown): e is ZodLikeError {
  return !!e && typeof e === "object"
    && (e as { name?: unknown }).name === "ZodError"
    && Array.isArray((e as { issues?: unknown }).issues);
}

function isJsonParseError(e: unknown): boolean {
  return e instanceof SyntaxError
    && ("body" in (e as object) || (e as { type?: unknown }).type === "entity.parse.failed");
}

function isMulterError(e: unknown): e is { name: string; code?: string } {
  return !!e && typeof e === "object" && (e as { name?: unknown }).name === "MulterError";
}

/**
 * Centralized Express 5 error handler. Must be registered LAST (after all
 * routes and the SPA fallback). Express 5 forwards rejected async handlers
 * here automatically, so individual routes no longer need to swallow every
 * throw to avoid a hung request.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Response already started streaming — we can't rewrite the status, so let
  // Express's built-in handler abort the connection.
  if (res.headersSent) { next(err); return; }

  let status = 500;
  // `null` means "use the 5xx message policy below".
  let message: string | null = null;

  if (err instanceof AppError) {
    status = err.statusCode;
    if (err.expose && status < 500) message = err.message;
  } else if (isZodError(err)) {
    status = 400;
    const summary = err.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join("; ");
    message = `Invalid request: ${summary}`;
  } else if (isJsonParseError(err)) {
    status  = 400;
    message = "Invalid JSON body";
  } else if (isMulterError(err)) {
    status  = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "File too large" : "File upload rejected";
  } else if (
    err && typeof err === "object"
    && typeof (err as { status?: unknown }).status === "number"
    && (err as { status: number }).status >= 400
    && (err as { status: number }).status < 500
  ) {
    // Other library-thrown client errors (e.g. body-parser type errors).
    status  = (err as { status: number }).status;
    const m = (err as { message?: unknown }).message;
    message = typeof m === "string" ? m : "Bad request";
  }

  // Always log the full error server-side, with request context when pino-http
  // has attached a per-request logger.
  const log = (req as Request & { log?: typeof logger }).log ?? logger;
  log.error(
    { err, statusCode: status, method: req.method, url: req.originalUrl },
    "request error",
  );

  if (message === null) {
    // 5xx (or a non-exposed AppError): never leak internals in production.
    message = isProd
      ? "Internal server error"
      : (err instanceof Error && err.message ? err.message : "Internal server error");
  }

  res.status(status).json({ error: message });
}
