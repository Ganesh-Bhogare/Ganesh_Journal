import { Request, Response } from "express";
import { Trade } from "../models/Trade";
import { User } from "../models/User";
import { config } from "../config";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

type BridgeRuntime = {
    process?: ChildProcess;
    running: boolean;
    pid?: number;
    startedAt?: Date;
    mode?: "once" | "loop";
    lastExitCode?: number | null;
    lastOutput?: string;
};

const bridgeByUser = new Map<string, BridgeRuntime>();

function resolveBridgeScriptPath() {
    return path.resolve(__dirname, "..", "scripts", "mt5_readonly_bridge.py");
}

function resolvePythonExecutable() {
    const fromEnv = (process.env.PYTHON_BRIDGE_EXECUTABLE || process.env.PYTHON_EXECUTABLE || "").trim();
    if (fromEnv) return fromEnv;

    const candidates = [
        path.resolve(process.cwd(), ".venv", "Scripts", "python.exe"),
        path.resolve(process.cwd(), "..", ".venv", "Scripts", "python.exe"),
        "python",
    ];

    for (const c of candidates) {
        if (c === "python") return c;
        if (fs.existsSync(c)) return c;
    }
    return "python";
}

function normalizeRuntimeOutput(data: Buffer | string) {
    return String(data || "").replace(/\s+/g, " ").trim();
}

function safeStateToken(v: string) {
    return String(v || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

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

        const accountFilter = String(req.query.accountId || "").trim();
        const escapedAccountFilter = accountFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const prefs: any = user.preferences || {};
        const enabled = Boolean(prefs.fundedReadOnlyEnabled);

        const fundedBaseFilter: any = { userId: req.userId, source: "funded-readonly" };
        if (accountFilter) {
            fundedBaseFilter.$or = [
                { fundedAccountId: accountFilter },
                { externalTradeId: new RegExp(`^${escapedAccountFilter}:`) },
            ];
        }

        const accountStats = await Trade.aggregate([
            { $match: { userId: user._id, source: "funded-readonly" } },
            {
                $addFields: {
                    derivedFundedAccountId: {
                        $ifNull: [
                            "$fundedAccountId",
                            {
                                $arrayElemAt: [{ $split: ["$externalTradeId", ":"] }, 0],
                            },
                        ],
                    },
                },
            },
            {
                $match: {
                    derivedFundedAccountId: { $nin: [null, ""] },
                },
            },
            {
                $group: {
                    _id: "$derivedFundedAccountId",
                    trades: { $sum: 1 },
                    netPnl: { $sum: { $ifNull: ["$pnl", 0] } },
                    lastSyncedAt: { $max: "$updatedAt" },
                },
            },
            { $sort: { lastSyncedAt: -1 } },
        ]);

        const [totalSynced, recentSynced] = await Promise.all([
            Trade.countDocuments(fundedBaseFilter),
            Trade.find(fundedBaseFilter)
                .sort({ updatedAt: -1 })
                .limit(50)
                .select("instrument direction entryPrice exitPrice pnl updatedAt externalTradeId fundedAccountId"),
        ]);

        const lastSyncedAt = recentSynced.length ? (recentSynced[0] as any).updatedAt || null : null;

        const runtime = req.userId ? bridgeByUser.get(String(req.userId)) : undefined;

        return res.json({
            funded: {
                enabled,
                provider: prefs.fundedProvider || "",
                terminalType: prefs.fundedTerminalType || "mt5",
                accountId: prefs.fundedAccountId || "",
                server: prefs.fundedServer || "",
                executionEnabled: Boolean(prefs.fundedExecutionEnabled),
            },
            bridge: {
                running: Boolean(runtime?.running),
                pid: runtime?.pid || null,
                mode: runtime?.mode || null,
                startedAt: runtime?.startedAt || null,
                lastExitCode: runtime?.lastExitCode ?? null,
                lastOutput: runtime?.lastOutput || "",
            },
            sync: {
                totalSynced,
                lastSyncedAt,
                recent: recentSynced,
            },
            accounts: accountStats.map((a: any) => ({
                accountId: String(a._id || ""),
                trades: Number(a.trades || 0),
                netPnl: Number(a.netPnl || 0),
                lastSyncedAt: a.lastSyncedAt || null,
            })),
            selectedAccountId: accountFilter || null,
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

export async function startFundedBridge(req: Request & { userId?: string }, res: Response) {
    try {
        if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
        if (!config.fundedBridgeToken) return res.status(400).json({ error: "FUNDED_BRIDGE_TOKEN is not configured on server" });

        const user = await User.findById(req.userId).select("preferences");
        if (!user) return res.status(404).json({ error: "User not found" });

        const prefs: any = user.preferences || {};
        const mt5Login = String(prefs.fundedMt5Login || prefs.fundedAccountId || "").trim();
        const mt5Password = String(prefs.fundedMt5Password || "").trim();
        const mt5Server = String(prefs.fundedServer || "").trim();
        const accountId = String(prefs.fundedAccountId || mt5Login || "").trim();

        if (!prefs.fundedReadOnlyEnabled) {
            return res.status(400).json({ error: "Enable Read-only Bridge in funded settings first" });
        }
        if (!mt5Login || !mt5Password || !mt5Server || !accountId) {
            return res.status(400).json({ error: "MT5 Login, Password, Server and Account ID are required in funded settings" });
        }

        const existing = bridgeByUser.get(String(req.userId));
        if (existing?.running && existing.process && !existing.process.killed) {
            return res.json({ success: true, message: "Bridge already running", pid: existing.pid || null });
        }

        const scriptPath = resolveBridgeScriptPath();
        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({ error: `Bridge script not found: ${scriptPath}` });
        }

        const pythonExe = resolvePythonExecutable();
        const once = Boolean(req.body?.once);
        const requestedIgnoreState = Boolean(req.body?.ignoreState);
        const requestedBackfillDaysRaw = Number(req.body?.backfillDays ?? prefs.fundedBridgeLookbackDays ?? 3650);
        const requestedBackfillDays = Number.isFinite(requestedBackfillDaysRaw) ? Math.max(1, Math.min(3650, Math.trunc(requestedBackfillDaysRaw))) : 3650;

        const existingSynced = await Trade.countDocuments({ userId: user._id, source: "funded-readonly" });
        const firstSync = existingSynced === 0;

        // First sync should not be constrained by prior state/short lookback.
        const ignoreState = requestedIgnoreState || firstSync;
        const backfillDays = firstSync ? 3650 : requestedBackfillDays;

        const cwd = path.resolve(__dirname, "..", "..");

        const scopedStateFile = path.resolve(
            cwd,
            "server",
            "src",
            "scripts",
            `.funded_bridge_state_${safeStateToken(String(user._id))}_${safeStateToken(accountId)}.json`
        );

        const args = [scriptPath, "--backfill-days", String(backfillDays)];
        if (ignoreState) args.push("--ignore-state");
        if (once) args.push("--once");
        const child = spawn(pythonExe, args, {
            cwd,
            env: {
                ...process.env,
                BRIDGE_API_URL: `http://127.0.0.1:${config.port}/api/funded/sync-readonly`,
                FUNDED_BRIDGE_TOKEN: config.fundedBridgeToken,
                FUNDED_PROVIDER: String(prefs.fundedProvider || "Goat Funded Trader"),
                FUNDED_ACCOUNT_ID: accountId,
                BRIDGE_POLL_SECONDS: String(prefs.fundedBridgePollSeconds || 20),
                BRIDGE_LOOKBACK_DAYS: String(backfillDays),
                BRIDGE_STATE_FILE: scopedStateFile,
                BRIDGE_USER_ID: String(req.userId),
                MT5_LOGIN: mt5Login,
                MT5_PASSWORD: mt5Password,
                MT5_SERVER: mt5Server,
                MT5_PATH: String(prefs.fundedMt5Path || "").trim(),
            },
            stdio: ["ignore", "pipe", "pipe"],
        });

        const runtime: BridgeRuntime = {
            process: child,
            running: true,
            pid: child.pid,
            startedAt: new Date(),
            mode: once ? "once" : "loop",
            lastExitCode: null,
            lastOutput: "",
        };
        bridgeByUser.set(String(req.userId), runtime);

        child.stdout.on("data", (chunk) => {
            const r = bridgeByUser.get(String(req.userId));
            if (!r) return;
            r.lastOutput = normalizeRuntimeOutput(chunk);
        });
        child.stderr.on("data", (chunk) => {
            const r = bridgeByUser.get(String(req.userId));
            if (!r) return;
            r.lastOutput = normalizeRuntimeOutput(chunk);
        });
        child.on("exit", (code) => {
            const r = bridgeByUser.get(String(req.userId));
            if (!r) return;
            r.running = false;
            r.lastExitCode = code;
            r.process = undefined;
        });

        return res.json({
            success: true,
            started: true,
            pid: child.pid || null,
            mode: once ? "once" : "loop",
            backfillDays,
            ignoreState,
            firstSync,
        });
    } catch (err) {
        console.error("startFundedBridge failed", err);
        return res.status(500).json({ error: "Failed to start funded bridge" });
    }
}

export async function stopFundedBridge(req: Request & { userId?: string }, res: Response) {
    try {
        if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

        const runtime = bridgeByUser.get(String(req.userId));
        if (!runtime?.running || !runtime.process) {
            return res.json({ success: true, stopped: false, message: "Bridge is not running" });
        }

        runtime.process.kill();
        runtime.running = false;
        runtime.process = undefined;

        return res.json({ success: true, stopped: true });
    } catch (err) {
        console.error("stopFundedBridge failed", err);
        return res.status(500).json({ error: "Failed to stop funded bridge" });
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
        const bridgeUserId = String(req.body?.bridgeUserId || "").trim();
        const provider = String(req.body?.provider || "Goat Funded Trader").trim();
        const trades = Array.isArray(req.body?.trades) ? req.body.trades : [];
        const openPositions = Array.isArray(req.body?.openPositions) ? req.body.openPositions : [];

        if (!accountId) return res.status(400).json({ error: "accountId is required" });
        if (!trades.length && !openPositions.length) {
            return res.status(400).json({ error: "Provide trades or openPositions" });
        }

        let user = null as any;
        let candidatesCount = 0;

        if (bridgeUserId) {
            user = await User.findById(bridgeUserId).select("_id preferences");
            if (!user || !user?.preferences?.fundedReadOnlyEnabled) {
                return res.status(404).json({ error: "Bridge user is not linked for read-only sync" });
            }

            const expectedAccountId = String(user?.preferences?.fundedAccountId || "").trim();
            const expectedServer = normalizeText(user?.preferences?.fundedServer);
            const incomingServer = normalizeText(serverName);

            if (expectedAccountId && expectedAccountId !== accountId) {
                return res.status(400).json({ error: "Bridge account mismatch for linked user" });
            }
            if (expectedServer && incomingServer && expectedServer !== incomingServer) {
                return res.status(400).json({ error: "Bridge server mismatch for linked user" });
            }
        } else {
            const candidates = await User.find({
                "preferences.fundedReadOnlyEnabled": true,
                "preferences.fundedAccountId": accountId,
            }).select("_id preferences");
            candidatesCount = candidates.length;

            if (candidates.length === 1) {
                user = candidates[0];
            } else if (candidates.length > 1) {
                const normalizedIncomingServer = normalizeText(serverName);
                user = candidates.find((u: any) => normalizeText(u?.preferences?.fundedServer) === normalizedIncomingServer) || null;
            }
        }

        if (!user) {
            return res.status(404).json({
                error: "No read-only linked user found for this account",
                details: {
                    accountId,
                    server: serverName || null,
                    candidates: candidatesCount,
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
                fundedAccountId: accountId,
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
