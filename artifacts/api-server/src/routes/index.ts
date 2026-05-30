import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import plansRouter from "./plans";
import campaignsRouter from "./campaigns";
import keywordsRouter from "./keywords";
import backlinksRouter from "./backlinks";
import competitorsRouter from "./competitors";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(plansRouter);
router.use(campaignsRouter);
router.use(keywordsRouter);
router.use(backlinksRouter);
router.use(competitorsRouter);
router.use(reportsRouter);

export default router;
