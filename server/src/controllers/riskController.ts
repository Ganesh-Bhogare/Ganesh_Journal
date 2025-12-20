import { Request, Response } from "express";
import { Trade } from "../models/Trade";
import { User } from "../models/User";

function startOfDayUtc(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUtc(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

function pipMultiplierForInstrument(instrument: string) {
    const sym = (instrument || "").toUpperCase();
    if (sym.includes("XAU") || sym.includes("XAG")) return 10;
    if (sym.endsWith("JPY")) return 100;
    return 10000;
}

function toNum(v: any): number | undefined {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
}

export async function checkTrade(req: Request & { userId?: string }, res: Response) {
    try {
        const { date, entryPrice, stopLoss, instrument, riskPerTrade } = req.body || {};

        const user = await User.findById(req.userId).select("preferences");
        if (!user) return res.status(404).json({ error: "User not found" });

        const prefs: any = user.preferences || {};
        const enforcement: "warn" | "block" = prefs.enforcement === "warn" ? "warn" : "block";

        const d = date ? new Date(date) : new Date();
        const dayStart = startOfDayUtc(d);
        const dayEnd = endOfDayUtc(d);

        const todaysTrades = await Trade.find({
            userId: req.userId,
            date: { $gte: dayStart, $lt: dayEnd },
        }).select("pnl outcome date");

        const todayCount = todaysTrades.length;
        const todayNetPnl = todaysTrades.reduce((sum, t: any) => sum + (typeof t.pnl === "number" ? t.pnl : 0), 0);
        const todayLossCount = todaysTrades.reduce((sum, t: any) => sum + (t.outcome === "loss" ? 1 : 0), 0);

        const violations: string[] = [];
        const warnings: string[] = [];

        const maxTradesPerDay = toNum(prefs.maxTradesPerDay);
        if (maxTradesPerDay && todayCount >= maxTradesPerDay) {
            violations.push(`Max trades/day reached (${todayCount}/${maxTradesPerDay}).`);
        }

        const stopAfterLosses = toNum(prefs.stopAfterLosses);
        if (stopAfterLosses && todayLossCount >= stopAfterLosses) {
            violations.push(`Stop-after-losses triggered (${todayLossCount}/${stopAfterLosses}).`);
        }

        const accountBalance = toNum(prefs.accountBalance);
        const maxDailyLossAmount = toNum(prefs.maxDailyLossAmount);
        const maxDailyLossPercent = toNum(prefs.maxDailyLossPercent);

        if (maxDailyLossAmount && todayNetPnl <= -Math.abs(maxDailyLossAmount)) {
            violations.push(`Max daily loss hit (PnL ${todayNetPnl.toFixed(2)} <= -${Math.abs(maxDailyLossAmount).toFixed(2)}).`);
        }

        if (accountBalance && maxDailyLossPercent) {
            const threshold = accountBalance * (Math.abs(maxDailyLossPercent) / 100);
            if (todayNetPnl <= -threshold) {
                violations.push(`Max daily loss hit (PnL ${todayNetPnl.toFixed(2)} <= -${threshold.toFixed(2)} from ${maxDailyLossPercent}%).`);
            }
        }

        // Compute sizing suggestion
        const entry = toNum(entryPrice);
        const sl = toNum(stopLoss);

        let riskUsd = toNum(riskPerTrade);
        if (!riskUsd) {
            const riskMode = prefs.riskMode === "fixed" ? "fixed" : "percent";
            if (riskMode === "fixed") {
                const amt = toNum(prefs.riskAmount);
                if (amt) riskUsd = amt;
            } else {
                const rp = toNum(prefs.riskPercent);
                if (accountBalance && rp) riskUsd = accountBalance * (rp / 100);
            }
        }

        const pipValuePerLot = toNum(prefs.pipValuePerLot) || 10;
        let pipsAtRisk: number | undefined;
        let suggestedLotSize: number | undefined;

        if (entry && sl && instrument && riskUsd) {
            const mult = pipMultiplierForInstrument(String(instrument));
            pipsAtRisk = Math.abs(entry - sl) * mult;
            if (pipsAtRisk > 0) {
                suggestedLotSize = riskUsd / (pipsAtRisk * pipValuePerLot);
            }
        } else {
            if (!sl) warnings.push("Stop loss is required to calculate lot size.");
            if (!riskUsd) warnings.push("Set risk sizing in Settings or enter Risk per trade.");
        }

        const allowed = enforcement === "block" ? violations.length === 0 : true;

        return res.json({
            allowed,
            enforcement,
            violations,
            warnings,
            today: {
                trades: todayCount,
                losses: todayLossCount,
                netPnl: todayNetPnl,
            },
            sizing: {
                riskInDollars: riskUsd,
                pipsAtRisk,
                suggestedLotSize,
                pipValuePerLot,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to check risk rules" });
    }
}
