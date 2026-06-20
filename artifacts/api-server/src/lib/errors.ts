/**
 * Typed HTTP errors for the API.
 *
 * Throw an `AppError` (or one of the helpers) from anywhere in a route or
 * service and the centralized error middleware (`middlewares/error.ts`) turns
 * it into a consistent `{ error }` JSON response with the right status code.
 *
 * `expose` controls whether the message is sent to the client. Client-facing
 * 4xx messages are always exposed; set `expose = false` on a 5xx if the
 * message could leak internal detail (the client then gets a generic message).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly expose: boolean;

  constructor(statusCode: number, message: string, expose = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export const badRequest   = (message: string)                 => new AppError(400, message);
export const unauthorized = (message = "Unauthorized")        => new AppError(401, message);
export const forbidden    = (message = "Forbidden")           => new AppError(403, message);
export const notFound     = (message = "Not found")           => new AppError(404, message);
export const conflict     = (message: string)                 => new AppError(409, message);
