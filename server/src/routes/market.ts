import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getIndianMomentum } from "../controllers/marketController";

const router = Router();

router.get("/indian-momentum", requireAuth, getIndianMomentum);

export default router;
