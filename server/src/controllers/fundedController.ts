import { Request, Response } from "express";
import { Trade } from "../models/Trade";
import { User } from "../models/User";
import { config } from "../config";

function parseIso(s: any): Date | undefined {
    const d = new Date(String(s || ""));
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function toNum(v: any): number | undefined {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function roundNum(v: number | undefined, digits: number): number | undefined {
    if (v === undefined) return undefined;
    const factor = Math.pow(10, digits);
    return Math.round(v * factor) / factor;
}

function normalizeText(v: any): string {
    return String(v || "").trim().toLowerCase();
}

function inferMarket(symbol: string): string {
    const s = String(symbol || "").toUpperCase();
    if (s.includes("BTC") || s.includes("ETH") || s.includes("USDT")) return "Crypto";
    if (s.includes("XAU") || s.includes("XAG")) return "Commodities";
    if (/^[A-Z]{6}$/.test(s)) return "Forex";
    return "Other";
}

function mapDirection(side: string): "long" | "short" | undefined {
    const s = String(side || "").toLowerCase();
    if (s === "buy" || s === "long") return "long";
    if (s === "sell" || s === "short") return "short";
    return undefined;
}

function inferSessionFromUtc(time: Date): "Asia" | "London" | "New York" {
    const h = time.getUTCHours();
    if (h >= 13 && h < 21) return "New York";
    if (h >= 7 && h < 16) return "London";
    return "Asia";
}

export async function getFundedStatus(req: Request & { userId?: string }, res: Response) {
    try {
        const user = await User.findById(req.userId).select("preferences");
        if (!user) return res.status(404).json({ error: "User not found" });

        const prefs: any = user.preferences || {};
        const enabled = Boolean(prefs.fundedReadOnlyEnabled);

        const [totalSynced, recentSynced] = await Promise.all([
            Trade.countDocuments({ userId: req.userId, source: "funded-readonly" }),
            Trade.find({ userId: req.userId, source: "funded-readonly" })
                .sort({ updatedAt: -1 })
                .limit(5)
                .select("instrument direction entryPrice exitPrice pnl updatedAt externalTradeId"),
        ]);

        const lastSyncedAt = recentSynced.length ? (recentSynced[0] as any).updatedAt || null : null;

        return res.json({
            funded: {
                enabled,
                provider: prefs.fundedProvider || "",
                terminalType: prefs.fundedTerminalType || "mt5",
                accountId: prefs.fundedAccountId || "",
                server: prefs.fundedServer || "",
                executionEnabled: Boolean(prefs.fundedExecutionEnabled),
            },
            sync: {
                totalSynced,
                lastSyncedAt,
                recent: recentSynced,
            },
            live: {
                updatedAt: prefs.fundedLiveUpdatedAt || null,
                openPositions: Array.isArray(prefs.fundedLiveOpenPositions) ? prefs.fundedLiveOpenPositions : [],
            },
        });
    } catch (err) {
        console.error("getFundedStatus failed", err);
        return res.status(500).json({ error: "Failed to load funded status" });
    }
}

// Read-only bridge endpoint: accepts closed trades from local terminal bridge and upserts to journal.
export async function fundedReadOnlySync(req: Request, res: Response) {
    try {
        const token = req.headers["x-bridge-token"];
        if (!config.fundedBridgeToken || token !== config.fundedBridgeToken) {
            return res.status(401).json({ error: "Invalid bridge token" });
        }

        const accountId = String(req.body?.accountId || "").trim();
        const serverName = String(req.body?.server || "").trim();
        const provider = String(req.body?.provider || "Goat Funded Trader").trim();
        const trades = Array.isArray(req.body?.trades) ? req.body.trades : [];
        const openPositions = Array.isArray(req.body?.openPositions) ? req.body.openPositions : [];

        if (!accountId) return res.status(400).json({ error: "accountId is required" });
        if (!trades.length && !openPositions.length) {
            return res.status(400).json({ error: "Provide trades or openPositions" });
        }

        const candidates = await User.find({
            "preferences.fundedReadOnlyEnabled": true,
            "preferences.fundedAccountId": accountId,
        }).select("_id preferences");

        let user = null as any;
        if (candidates.length === 1) {
            user = candidates[0];
        } else if (candidates.length > 1) {
            const normalizedIncomingServer = normalizeText(serverName);
            user = candidates.find((u: any) => normalizeText(u?.preferences?.fundedServer) === normalizedIncomingServer) || null;
        }

        if (!user) {
            return res.status(404).json({
                error: "No read-only linked user found for this account",
                details: {
                    accountId,
                    server: serverName || null,
                    candidates: candidates.length,
                },
            });
        }

        const created: string[] = [];
        const updated: string[] = [];
        const skipped: string[] = [];

        for (const t of trades) {
            const ticket = String(t?.ticket ?? t?.id ?? "").trim();
            const symbol = String(t?.symbol || t?.instrument || "").trim().toUpperCase();
            const direction = mapDirection(String(t?.side || t?.direction || ""));
            const openTime = parseIso(t?.openTime || t?.entryTime || t?.date);
            const closeTime = parseIso(t?.closeTime || t?.exitTime);
            const openPrice = toNum(t?.openPrice || t?.entryPrice);
            const closePrice = toNum(t?.closePrice || t?.exitPrice);
            const lotSize = roundNum(toNum(t?.volume ?? t?.lotSize), 4);

            if (!ticket || !symbol || !direction || !openTime || openPrice === undefined) {
                skipped.push(ticket || "unknown");
                continue;
            }

            const externalTradeId = `${accountId}:${ticket}`;

            const pnl = toNum(t?.profit);
            const normalizedPnl = roundNum(pnl, 2);

            const payload: any = {
                userId: user._id,
                source: "funded-readonly",
                externalTradeId,
                date: openTime,
                entryTime: openTime,
                session: inferSessionFromUtc(openTime),
                market: inferMarket(symbol),
                instrument: symbol,
                direction,
                entryPrice: roundNum(openPrice, 5),
                stopLoss: roundNum(toNum(t?.sl ?? t?.stopLoss), 5),
                takeProfit: roundNum(toNum(t?.tp ?? t?.takeProfit), 5),
                lotSize,
                exitTime: closeTime,
                exitPrice: roundNum(closePrice, 5),
                pnl: normalizedPnl,
                notes: `Auto-synced from ${provider}${serverName ? ` (${serverName})` : ""}. Ticket: ${ticket}`,
                tags: [symbol, "synced:funded", `account:${accountId}`],
            };

            const existing = await Trade.findOne({ userId: user._id, externalTradeId }).select("_id");
            if (!existing) {
                const doc = await Trade.create(payload);
                created.push(String(doc._id));
            } else {
                await Trade.findByIdAndUpdate(existing._id, payload, { new: true });
                updated.push(String(existing._id));
            }
        }

        // Save current open positions snapshot for live monitoring panel.
        const normalizedOpenPositions = openPositions
            .map((p: any) => {
                const direction = mapDirection(String(p?.side || p?.direction || ""));
                const symbol = String(p?.symbol || p?.instrument || "").trim().toUpperCase();
                const ticket = String(p?.ticket ?? p?.id ?? "").trim();
                if (!ticket || !symbol || !direction) return null;

                return {
                    ticket,
                    symbol,
                    direction,
                    volume: roundNum(toNum(p?.volume ?? p?.lotSize), 4),
                    openPrice: roundNum(toNum(p?.openPrice ?? p?.entryPrice), 5),
                    currentPrice: roundNum(toNum(p?.currentPrice ?? p?.markPrice), 5),
                    unrealizedPnl: roundNum(toNum(p?.unrealizedPnl ?? p?.profit), 2),
                    sl: roundNum(toNum(p?.sl ?? p?.stopLoss), 5),
                    tp: roundNum(toNum(p?.tp ?? p?.takeProfit), 5),
                    openTime: parseIso(p?.openTime || p?.entryTime || p?.date),
                };
            })
            .filter(Boolean);

        await User.findByIdAndUpdate(user._id, {
            $set: {
                "preferences.fundedLiveOpenPositions": normalizedOpenPositions,
                "preferences.fundedLiveUpdatedAt": new Date(),
            },
        });

        return res.json({
            success: true,
            accountId,
            created: created.length,
            updated: updated.length,
            skipped: skipped.length,
            skippedTickets: skipped,
            openPositions: normalizedOpenPositions.length,
        });
    } catch (err) {
        console.error("fundedReadOnlySync failed", err);
        return res.status(500).json({ error: "Failed to sync funded trades" });
    }
}
