import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getPreferences, updatePreferences } from "../controllers/userController";

const router = Router();

router.get("/preferences", requireAuth, getPreferences);
router.put("/preferences", requireAuth, updatePreferences);

export default router;
