import { Request, Response } from "express";
import { Trade } from "../models/Trade";
import { tradeSchema } from "../utils/validation";

// Calculate P&L, outcome, and R:R for a trade
function calculateTradeMetrics(data: any) {
    const { direction, entryPrice, exitPrice, stopLoss, lotSize } = data;

    // Calculate P&L if exitPrice exists
    if ((data.pnl === undefined || data.pnl === null) && exitPrice && entryPrice && lotSize) {
        const pips = direction === 'long'
            ? (exitPrice - entryPrice) * 10000
            : (entryPrice - exitPrice) * 10000;

        // Assuming standard lot: $10 per pip, adjust based on lotSize
        data.pnl = (pips * lotSize * 10);

        // Determine outcome
        if (data.outcome === undefined || data.outcome === null) {
            if (data.pnl > 0) data.outcome = 'win';
            else if (data.pnl < 0) data.outcome = 'loss';
            else data.outcome = 'breakeven';
        }
    }

    // Calculate Risk:Reward ratio
    if (exitPrice && entryPrice && stopLoss) {
        const risk = Math.abs(entryPrice - stopLoss);
        const reward = Math.abs(exitPrice - entryPrice);
        data.rr = risk > 0 ? reward / risk : 0;
    }

    return data;
}

// Bulk import trades (expects an array of trade-like objects)
export async function importTrades(req: Request & { userId?: string }, res: Response) {
    try {
        const payload = req.body as any;
        const tradesInput: any[] = Array.isArray(payload?.trades) ? payload.trades : [];
        if (tradesInput.length === 0) {
            return res.status(400).json({ error: "No trades provided" });
        }

        const created: any[] = [];
        const failed: Array<{ index: number; reason: string }> = [];

        for (let index = 0; index < tradesInput.length; index++) {
            try {
                const parsed = tradeSchema.parse(tradesInput[index]);
                const calculatedData = calculateTradeMetrics(parsed);
                const trade = await Trade.create({
                    userId: req.userId,
                    ...calculatedData,
                    date: new Date((parsed as any).date),
                });
                created.push(trade);
            } catch (err: any) {
                if (err?.name === "ZodError") {
                    failed.push({ index, reason: JSON.stringify(err.errors) });
                } else {
                    failed.push({ index, reason: err?.message || "Failed to import trade" });
                }
            }
        }

        return res.json({ success: true, created: created.length, failed });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to import trades" });
    }
}

// Creates a trade
export async function createTrade(req: Request & { userId?: string }, res: Response) {
    try {
        const parsed = tradeSchema.parse(req.body);
        const calculatedData = calculateTradeMetrics(parsed);
        const trade = await Trade.create({
            userId: req.userId,
            ...calculatedData,
            date: new Date(parsed.date),
        });
        return res.status(201).json(trade);
    } catch (err: any) {
        if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to create trade" });
    }
}

// Updates a trade by id
export async function updateTrade(req: Request & { userId?: string }, res: Response) {
    try {
        const { id } = req.params;
        const parsed = tradeSchema.partial().parse(req.body);

        // Get existing trade to merge data for calculations
        const existing = await Trade.findOne({ _id: id, userId: req.userId });
        if (!existing) return res.status(404).json({ error: "Trade not found" });

        const mergedData = { ...existing.toObject(), ...parsed };
        const calculatedData = calculateTradeMetrics(mergedData);

        const updated = await Trade.findOneAndUpdate(
            { _id: id, userId: req.userId },
            { ...calculatedData },
            { new: true }
        );
        return res.json(updated);
    } catch (err: any) {
        if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to update trade" });
    }
}

// Deletes a trade by id
export async function deleteTrade(req: Request & { userId?: string }, res: Response) {
    try {
        const { id } = req.params;
        const deleted = await Trade.findOneAndDelete({ _id: id, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: "Trade not found" });
        return res.json({ success: true });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to delete trade" });
    }
}

// Lists trades with pagination and optional filters
export async function listTrades(req: Request & { userId?: string }, res: Response) {
    try {
        const page = parseInt((req.query.page as string) || "1", 10);
        const limit = parseInt((req.query.limit as string) || "20", 10);
        const skip = (page - 1) * limit;

        const filters: any = { userId: req.userId };
        if (req.query.instrument) filters.instrument = req.query.instrument;
        if (req.query.direction) filters.direction = req.query.direction;
        if (req.query.tag) filters.tags = req.query.tag;

        const [items, total] = await Promise.all([
            Trade.find(filters).sort({ date: -1 }).skip(skip).limit(limit),
            Trade.countDocuments(filters),
        ]);

        return res.json({ items, page, total, pages: Math.ceil(total / limit) });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to list trades" });
    }
}
// Recalculate all trades for the user
export async function recalculateAllTrades(req: Request & { userId?: string }, res: Response) {
    try {
        const trades = await Trade.find({ userId: req.userId });
        let updated = 0;

        for (const trade of trades) {
            const data = calculateTradeMetrics(trade.toObject());
            await Trade.findByIdAndUpdate(trade._id, data);
            updated++;
        }

        return res.json({ success: true, updated });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to recalculate trades" });
    }
}

// Upload screenshots for a trade
export async function uploadScreenshots(req: Request & { userId?: string }, res: Response) {
    try {
        const { id } = req.params;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        const trade = await Trade.findOne({ _id: id, userId: req.userId });
        if (!trade) return res.status(404).json({ error: "Trade not found" });

        const updates: any = {};

        if (files.htf && files.htf[0]) {
            updates.htfScreenshot = `/uploads/${files.htf[0].filename}`;
        }
        if (files.entry && files.entry[0]) {
            updates.entryScreenshot = `/uploads/${files.entry[0].filename}`;
        }
        if (files.postTrade && files.postTrade[0]) {
            updates.postTradeScreenshot = `/uploads/${files.postTrade[0].filename}`;
        }

        const updated = await Trade.findOneAndUpdate(
            { _id: id, userId: req.userId },
            updates,
            { new: true }
        );

        return res.json(updated);
    } catch (_err) {
        return res.status(500).json({ error: "Failed to upload screenshots" });
    }
}