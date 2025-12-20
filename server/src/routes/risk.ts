import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { checkTrade } from "../controllers/riskController";

const router = Router();

router.post("/check", requireAuth, checkTrade);

export default router;
