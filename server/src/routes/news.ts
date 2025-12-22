import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { analyzeNewsBias, getNews } from "../controllers/newsController";

const router = Router();

router.get("/", requireAuth, getNews);
router.post("/analyze", requireAuth, analyzeNewsBias);

export default router;
