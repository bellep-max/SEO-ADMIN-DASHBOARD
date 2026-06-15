import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import plansRouter from "./plans";
import businessesRouter from "./businesses";
import campaignsRouter from "./campaigns";
import keywordsRouter from "./keywords";
import backlinksRouter from "./backlinks";
import competitorsRouter from "./competitors";
import reportsRouter from "./reports";
import geoGridsRouter from "./geo-grids";
import falconRouter from "./falcon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(plansRouter);
router.use(businessesRouter);
router.use(campaignsRouter);
router.use(keywordsRouter);
router.use(backlinksRouter);
router.use(competitorsRouter);
router.use(reportsRouter);
router.use(geoGridsRouter);
router.use(falconRouter);

export default router;
