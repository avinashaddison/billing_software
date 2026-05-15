import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import healthRouter      from "./health";
import productsRouter    from "./products";
import stockLogsRouter   from "./stock-logs";
import salesRouter       from "./sales";
import dashboardRouter   from "./dashboard";
import billsRouter       from "./bills";
import eventsRouter      from "./events";
import suppliersRouter   from "./suppliers";
import returnsRouter     from "./returns";
import reportsRouter     from "./reports";
import customersRouter   from "./customers";
import categoriesRouter  from "./categories";
import staffRouter       from "./staff";
import uploadRouter      from "./upload";
import sharedCartRouter  from "./shared-cart";
import telegramRouter    from "./telegram";
import settingsRouter    from "./settings";
import platformRouter    from "./platform";
import updatesRouter     from "./updates";
import authRouter        from "./auth";

const router: IRouter = Router();

/**
 * Tenant-active gate for the cloud SaaS model. Replaces the old per-install
 * licenseGate: instead of checking a signed license key, we honour the
 * `tenants.is_active` flag the platform admin toggles from /admin.
 *
 * Anonymous requests (tenantId null) pass through — auth/login/health
 * endpoints must remain reachable before a session exists.
 */
const TENANT_PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/login-email",
  "/auth/logout",
  "/auth/me",
  "/health",
  "/healthz",
]);

async function tenantActiveGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (TENANT_PUBLIC_PATHS.has(req.path)) { next(); return; }
  if (!req.tenantId) { next(); return; }
  try {
    const [t] = await db
      .select({
        isActive:  tenantsTable.isActive,
        expiresAt: tenantsTable.expiresAt,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, req.tenantId));
    if (t && !t.isActive) {
      res.status(403).json({ error: "Tenant suspended", message: "Your account has been suspended. Contact your vendor." });
      return;
    }
    if (t?.expiresAt && t.expiresAt.getTime() < Date.now()) {
      res.status(403).json({
        error:   "Tenant expired",
        expired: true,
        message: "Your access has expired. Contact your vendor to renew.",
        expiredAt: t.expiresAt.toISOString(),
      });
      return;
    }
    next();
  } catch {
    /* Fail open on DB blips so a transient Neon hiccup can't lock everyone
       out. The same DB will reject downstream queries if it's really down. */
    next();
  }
}

// Platform admin routes mount FIRST — the vendor's control plane must stay
// reachable regardless of any per-tenant state.
router.use(platformRouter);

// Per-tenant suspend gate (the cloud equivalent of the old license gate).
router.use(tenantActiveGate);

router.use(updatesRouter);
router.use(authRouter);
router.use(healthRouter);
router.use(productsRouter);
router.use(stockLogsRouter);
router.use(salesRouter);
router.use(dashboardRouter);
router.use(billsRouter);
router.use(eventsRouter);
router.use(suppliersRouter);
router.use(returnsRouter);
router.use(reportsRouter);
router.use(customersRouter);
router.use(categoriesRouter);
router.use(staffRouter);
router.use(uploadRouter);
router.use(sharedCartRouter);
router.use(telegramRouter);
router.use(settingsRouter);

export default router;
