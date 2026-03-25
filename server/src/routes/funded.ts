import { Router } from "express";
import { fundedReadOnlySync, getFundedStatus } from "../controllers/fundedController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/status", requireAuth, getFundedStatus);

// Intentionally no JWT auth: this endpoint is for local terminal bridge.
// It is protected by x-bridge-token header validation.
router.post("/sync-readonly", fundedReadOnlySync);

export default router;
