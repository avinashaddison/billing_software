import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import stockLogsRouter from "./stock-logs";
import salesRouter from "./sales";
import dashboardRouter from "./dashboard";
import billsRouter from "./bills";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(stockLogsRouter);
router.use(salesRouter);
router.use(dashboardRouter);
router.use(billsRouter);

export default router;
