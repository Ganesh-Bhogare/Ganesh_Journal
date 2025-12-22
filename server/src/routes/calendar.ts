import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { analyzeCalendarImpact, getCalendarToday } from "../controllers/calendarController";

const router = Router();

router.get("/today", requireAuth, getCalendarToday);
router.post("/analyze", requireAuth, analyzeCalendarImpact);

export default router;
