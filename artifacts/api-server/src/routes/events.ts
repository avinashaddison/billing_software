import { Router, type IRouter } from "express";
import { addClient, clientCount } from "../lib/sse";

const router: IRouter = Router();

/** GET /api/events  — SSE stream */
router.get("/events", (req, res) => {
  const cleanup = addClient(res);
  req.on("close", cleanup);
});

/** GET /api/events/status  — how many clients connected */
router.get("/events/status", (_req, res) => {
  res.json({ clients: clientCount() });
});

export default router;
