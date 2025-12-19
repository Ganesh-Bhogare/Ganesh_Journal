import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { allTradesReport, analyzeTrade, chatTrade, weeklyReview } from "../controllers/aiController";

const router = Router();

router.post("/analyze-trade", requireAuth, analyzeTrade);
router.post("/weekly-review", requireAuth, weeklyReview);
router.post("/chat-trade", requireAuth, chatTrade);
router.post("/all-trades-report", requireAuth, allTradesReport);

export default router;
