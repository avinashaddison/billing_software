import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { tenantContext } from "./middlewares/tenant";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app: Express = express();

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

app.use("/api", router);

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

export default app;
