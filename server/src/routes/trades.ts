import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createTrade, updateTrade, deleteTrade, listTrades, recalculateAllTrades, uploadScreenshots, importTrades, getTrade, setChartFromEntryScreenshot } from "../controllers/tradesController";
import { upload } from "../utils/uploader";
import { config } from "../config";
import path from "path";

const router = Router();

router.get("/", requireAuth, listTrades);
router.get("/:id", requireAuth, getTrade);
router.post("/:id/chart-from-entry", requireAuth, setChartFromEntryScreenshot);
router.post("/", requireAuth, createTrade);
router.post("/import", requireAuth, importTrades);
router.patch("/:id", requireAuth, updateTrade);
router.delete("/:id", requireAuth, deleteTrade);
router.post("/recalculate", requireAuth, recalculateAllTrades);

// Upload screenshots for a specific trade (ICT format)
router.post("/:id/screenshots", requireAuth, upload.fields([
    { name: 'htf', maxCount: 1 },
    { name: 'entry', maxCount: 1 },
    { name: 'postTrade', maxCount: 1 },
    { name: 'chart', maxCount: 1 }
]), uploadScreenshots);

// Upload screenshots and return URLs for association (legacy)
router.post("/upload", requireAuth, upload.array("screenshots", 5), (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const urls = files.map(f => {
        const filename = path.basename(f.path);
        return `/uploads/${filename}`;
    });
    return res.json({ urls });
});

export default router;
