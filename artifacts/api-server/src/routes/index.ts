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
import apiKeysRouter     from "./api-keys";
import platformRouter    from "./platform";
import platformInsightsRouter from "./platform-insights";
import platformPeopleRouter from "./platform-people";
import platformMoneyRouter from "./platform-money";
import platformNoticesRouter from "./platform-notices";
import platformHealthRouter from "./platform-health";
import appNoticesRouter from "./app-notices";
import { readOnlySessionGate } from "../middlewares/read-only-session";
import updatesRouter     from "./updates";
import authRouter        from "./auth";
import { PUBLIC_PATHS, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * Tenant-active gate for the cloud SaaS model. Replaces the old per-install
 * licenseGate: instead of checking a signed license key, we honour the
 * `tenants.is_active` flag the platform admin toggles from /admin.
 *
 * Anonymous requests (tenantId null) pass through — auth/login/health
 * endpoints must remain reachable before a session exists.
 *
 * The public allowlist is shared with `requireAuth` (see middlewares/auth)
 * so the two gates can never disagree about which paths are public.
 */
async function tenantActiveGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  /* Read-only vendor support may inspect a suspended or expired shop — that
     is usually why it is being opened. It cannot change anything. */
  if (req.viewAsReadOnly) { next(); return; }
  if (PUBLIC_PATHS.has(req.path)) { next(); return; }
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
router.use(platformInsightsRouter);
router.use(platformPeopleRouter);
router.use(platformMoneyRouter);
router.use(platformNoticesRouter);
router.use(platformHealthRouter);

// Per-tenant suspend gate (the cloud equivalent of the old license gate).
router.use(tenantActiveGate);

// Vendor "view as shop" support sessions are read-only. This must sit ahead
// of every tenant router so a write is refused no matter which route it hits.
// It is deliberately BEHIND the platform routers above: those carry their own
// admin gate, and the vendor's console is normally open in another tab of the
// same browser — freezing it for the hour a support session lasts would be a
// regression, not a safeguard.
router.use(readOnlySessionGate);

// Global authentication gate — everything past this point (except the public
// allowlist in PUBLIC_PATHS) requires a valid PIN or email session. Mounted
// AFTER the platform routes (which have their own admin gate) and the tenant
// suspend gate, but BEFORE every tenant data/mutation router below.
router.use(requireAuth);

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
router.use(apiKeysRouter);
router.use(appNoticesRouter);

export default router;
