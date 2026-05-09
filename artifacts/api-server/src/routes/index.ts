import { Router, type IRouter } from "express";
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
import licenseRouter     from "./license";
import { licenseGate }   from "../lib/license";

const router: IRouter = Router();

// License gate runs first so unlicensed installs see 402 on every endpoint
// EXCEPT /api/license/status and /api/health (whitelisted inside licenseGate).
router.use(licenseGate);

router.use(licenseRouter);
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
