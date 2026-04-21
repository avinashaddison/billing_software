import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
