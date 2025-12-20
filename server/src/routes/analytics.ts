import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { kpis, distributions, aiInsights, gptInsights, autoTradeAnalysis } from "../controllers/analyticsController";

const router = Router();

router.get("/kpis", requireAuth, kpis);
router.get("/distributions", requireAuth, distributions);
router.get("/ai-insights", requireAuth, aiInsights);
router.get("/gpt-insights", requireAuth, gptInsights);
router.get("/auto-trade-analysis", requireAuth, autoTradeAnalysis);

export default router;
