import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { tenantContext } from "./middlewares/tenant";
import { apiNotFound, errorHandler } from "./middlewares/error";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app: Express = express();

/* Trust the platform's reverse proxy so req.ip and rate-limit keys reflect
   the real client IP (Render injects X-Forwarded-For). Without this every
   limiter would see the proxy's single IP and shared-limit every user. */
app.set("trust proxy", 1);

/**
 * Security headers — defaults are sensible for a JSON API + same-origin SPA.
 * CSP is loosened on `'unsafe-inline'` styles because Tailwind utility
 * classes inject inline styles for runtime variants; tightening it later
 * requires a hashed/nonce-based pass.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc:    ["'self'", "data:"],
        objectSrc:  ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    /* Disable HSTS in dev (http://localhost would otherwise be blocked
       after first visit). Helmet auto-enables it in production. */
    hsts: process.env.NODE_ENV === "production"
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    /* The SPA's PWA service worker + cross-origin image hosts need the
       same-origin embedder policy relaxed — flip to "require-corp" only
       after every <img> source is COEP-compatible. */
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

/**
 * CORS — must allow credentials so the HttpOnly `tenant_session` cookie
 * is sent on cross-origin requests from the Vite dev server. In production
 * the API and SPA share the same origin, so this only affects dev.
 *
 * Set CORS_ORIGIN to a comma-separated allowlist (e.g.
 *   "http://localhost:5173,http://localhost:3000")
 * to lock cross-origin requests down. Defaults to reflecting the request
 * origin — which is fine for a private LAN POS install but should be
 * tightened on public SaaS deployments.
 */
const corsOrigins = (process.env["CORS_ORIGIN"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin: corsOrigins.length > 0
      ? corsOrigins
      : (origin, cb) => cb(null, origin ?? true),
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Resolve req.tenantId from the signed cookie on every request. Runs
   BEFORE the API router so every downstream handler can rely on it. */
app.use(tenantContext);

/**
 * Rate limiting — burns credential-stuffing attacks before they reach the
 * bcrypt compare. The PIN flow already has DB-backed per-account lockout;
 * these limiters add a per-IP ceiling on the email/platform endpoints.
 *
 * Disabled entirely when NODE_ENV !== "production" so dev tests aren't
 * accidentally rate-limited by hot-reload retries.
 */
const isProd = process.env.NODE_ENV === "production";

const loginLimiter = rateLimit({
  windowMs:  15 * 60 * 1000,  // 15 minutes
  limit:     20,              // 20 attempts per IP per window
  standardHeaders: "draft-8",
  legacyHeaders:   false,
  skip: () => !isProd,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

/* Wider net for everything else under /api — generous so legitimate POS
   usage isn't throttled but catches scrape/scan attacks. */
const apiLimiter = rateLimit({
  windowMs:  60 * 1000,       // 1 minute
  limit:     300,             // 5 req/sec sustained per IP
  standardHeaders: "draft-8",
  legacyHeaders:   false,
  skip: () => !isProd,
});

app.use("/api/auth/login",        loginLimiter);
app.use("/api/auth/login-email",  loginLimiter);
app.use("/api/platform/login",    loginLimiter);
app.use("/api",                   apiLimiter);

app.use("/api", router);

/* Unmatched /api/* → JSON 404. Must come after the router but before the SPA
   fallback so a missing endpoint never resolves to index.html. */
app.use("/api", apiNotFound);

// In production, serve the compiled frontend and handle SPA routing.
if (process.env.NODE_ENV === "production") {
  // STATIC_DIR can be overridden; default is the Vite build output relative
  // to this bundle (artifacts/api-server/dist → ../../toy-mall/dist/public).
  const staticDir =
    process.env.STATIC_DIR ??
    path.join(__dirname, "../../toy-mall/dist/public");

  app.use(express.static(staticDir));

  // SPA fallback — any path that doesn't match a static file or /api route
  // gets the React shell so client-side routing works.
  app.use((_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

/* Centralized error handler — MUST be registered last. Express 5 forwards
   rejected async route handlers here, so a DB failure returns a clean JSON
   error instead of hanging the request. */
app.use(errorHandler);

export default app;
