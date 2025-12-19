import { Request, Response } from "express";
import { Trade } from "../models/Trade";
import { config } from "../config";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

type InsightItem = {
    key: string;
    label: string;
    count: number;
    rate: number;
};

function safeNumber(v: any) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function rate(count: number, total: number) {
    if (!total) return 0;
    return count / total;
}

// Computes key performance metrics for the current user
export async function kpis(req: Request & { userId?: string }, res: Response) {
    try {
        const trades = await Trade.find({ userId: req.userId }).sort({ date: 1 });
        if (trades.length === 0) return res.json({
            winRate: 0,
            profitFactor: 0,
            avgRR: 0,
            maxDrawdown: 0,
            expectancy: 0,
            equityCurve: [],
        });

        let wins = 0, losses = 0;
        let grossProfit = 0, grossLoss = 0;
        let rrSum = 0, rrCount = 0;

        const curve: { date: string; equity: number }[] = [];
        let equity = 0;
        let peak = 0;
        let maxDrawdown = 0;

        for (const t of trades) {
            const pnl = (t.pnl ?? 0);
            equity += pnl;
            peak = Math.max(peak, equity);
            const drawdown = peak > 0 ? (peak - equity) : 0;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
            curve.push({ date: new Date(t.date).toISOString(), equity });

            if (pnl > 0) { wins++; grossProfit += pnl; }
            else if (pnl < 0) { losses++; grossLoss += Math.abs(pnl); }

            const derivedRR =
                (typeof (t as any).rr === "number" && Number.isFinite((t as any).rr))
                    ? (t as any).rr
                    : (typeof (t as any).rMultiple === "number" && Number.isFinite((t as any).rMultiple))
                        ? Math.abs((t as any).rMultiple)
                        : ((t as any).exitPrice && (t as any).entryPrice && (t as any).stopLoss)
                            ? (Math.abs((t as any).exitPrice - (t as any).entryPrice) / Math.abs((t as any).entryPrice - (t as any).stopLoss))
                            : undefined;

            if (typeof derivedRR === "number" && Number.isFinite(derivedRR)) {
                rrSum += derivedRR;
                rrCount++;
            }
        }

        const winRate = (wins + losses) > 0 ? wins / (wins + losses) : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
        const avgRR = rrCount > 0 ? rrSum / rrCount : 0;
        // Expectancy per trade: E = P(win)*AvgWin - P(loss)*AvgLoss
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

        return res.json({ winRate, profitFactor, avgRR, maxDrawdown, expectancy, equityCurve: curve });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to compute analytics" });
    }
}

// Aggregation for distribution charts
export async function distributions(req: Request & { userId?: string }, res: Response) {
    try {
        const trades = await Trade.find({ userId: req.userId }).select(
            "instrument direction outcome pnl session"
        );

        const countArray = (arr: Array<string | undefined | null>) => {
            const map: Record<string, number> = {};
            for (const v of arr) {
                if (!v) continue;
                map[v] = (map[v] || 0) + 1;
            }
            return Object.entries(map)
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => b.value - a.value);
        };

        const derivedOutcome = trades.map((t: any) => {
            if (t.outcome) return t.outcome as string;
            const pnl = t.pnl ?? 0;
            if (pnl > 0) return "win";
            if (pnl < 0) return "loss";
            return "breakeven";
        });

        const pairMap: Record<string, { profit: number; lossAbs: number; net: number }> = {};
        for (const t of trades as any[]) {
            const instrument = t.instrument as string | undefined;
            if (!instrument) continue;
            const pnl = typeof t.pnl === "number" && Number.isFinite(t.pnl) ? t.pnl : 0;
            if (!pairMap[instrument]) pairMap[instrument] = { profit: 0, lossAbs: 0, net: 0 };
            pairMap[instrument].net += pnl;
            if (pnl >= 0) pairMap[instrument].profit += pnl;
            else pairMap[instrument].lossAbs += Math.abs(pnl);
        }

        const byPairPnL = Object.entries(pairMap)
            .map(([pair, v]) => ({ pair, profit: v.profit, loss: v.lossAbs, net: v.net }))
            .sort((a, b) => (b.profit + b.loss) - (a.profit + a.loss));

        return res.json({
            byInstrument: countArray(trades.map((t: any) => t.instrument)),
            byDirection: countArray(trades.map((t: any) => t.direction)),
            byOutcome: countArray(derivedOutcome),
            bySession: countArray(trades.map((t: any) => t.session)),
            byPairPnL,
        });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to compute distributions" });
    }
}

// AI-style insights (rule-based) for the current user
export async function aiInsights(req: Request & { userId?: string }, res: Response) {
    try {
        const limit = Math.max(50, Math.min(500, parseInt((req.query.limit as string) || "200", 10) || 200));

        const trades = await Trade.find({ userId: req.userId })
            .sort({ date: -1 })
            .limit(limit)
            .select(
                "date instrument direction session outcome pnl rr rMultiple ruleBreakCount riskRespected noEarlyExit validPDArray correctSession followedHTFBias emotionalState"
            );

        const total = trades.length;
        if (total === 0) {
            return res.json({
                tradesAnalyzed: 0,
                dateRange: null,
                summary: {
                    netPnl: 0,
                    grossProfit: 0,
                    grossLoss: 0,
                    winRate: 0,
                    profitFactor: 0,
                    avgRR: 0,
                },
                repeatedMistakes: [],
                strengths: [],
                recommendations: [],
                charts: { mistakes: [], emotions: [] },
            });
        }

        let wins = 0;
        let losses = 0;
        let breakeven = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let netPnl = 0;

        let rrSum = 0;
        let rrCount = 0;

        const ruleFalseCounts: Record<string, number> = {
            riskRespected: 0,
            noEarlyExit: 0,
            validPDArray: 0,
            correctSession: 0,
            followedHTFBias: 0,
        };

        const ruleTrueCounts: Record<string, number> = {
            riskRespected: 0,
            noEarlyExit: 0,
            validPDArray: 0,
            correctSession: 0,
            followedHTFBias: 0,
        };

        const emotionMap: Record<string, { count: number; net: number; wins: number; losses: number }> = {};

        const latestDate = trades[0]?.date ? new Date(trades[0].date) : null;
        const earliestDate = trades[total - 1]?.date ? new Date(trades[total - 1].date) : null;

        for (const t of trades as any[]) {
            const pnl = safeNumber(t.pnl);
            netPnl += pnl;
            if (pnl > 0) {
                wins++;
                grossProfit += pnl;
            } else if (pnl < 0) {
                losses++;
                grossLoss += Math.abs(pnl);
            } else {
                breakeven++;
            }

            const derivedRR =
                (typeof t.rr === "number" && Number.isFinite(t.rr))
                    ? t.rr
                    : (typeof t.rMultiple === "number" && Number.isFinite(t.rMultiple))
                        ? Math.abs(t.rMultiple)
                        : undefined;
            if (typeof derivedRR === "number" && Number.isFinite(derivedRR)) {
                rrSum += derivedRR;
                rrCount++;
            }

            for (const key of Object.keys(ruleFalseCounts)) {
                const v = t[key];
                if (v === true) ruleTrueCounts[key]++;
                else if (v === false) ruleFalseCounts[key]++;
            }

            const emotion = (t.emotionalState || "Unknown") as string;
            if (!emotionMap[emotion]) emotionMap[emotion] = { count: 0, net: 0, wins: 0, losses: 0 };
            emotionMap[emotion].count++;
            emotionMap[emotion].net += pnl;
            if (pnl > 0) emotionMap[emotion].wins++;
            if (pnl < 0) emotionMap[emotion].losses++;
        }

        const winRate = (wins + losses) ? wins / (wins + losses) : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
        const avgRR = rrCount ? rrSum / rrCount : 0;

        const ruleLabels: Record<string, string> = {
            riskRespected: "Risk not respected",
            noEarlyExit: "Early exit (didn't hold plan)",
            validPDArray: "Invalid PD Array",
            correctSession: "Wrong session",
            followedHTFBias: "HTF bias not followed",
        };

        const repeatedMistakes: InsightItem[] = Object.entries(ruleFalseCounts)
            .map(([key, count]) => ({
                key,
                label: ruleLabels[key] || key,
                count,
                rate: rate(count, total),
            }))
            .filter((x) => x.count > 0)
            .sort((a, b) => b.count - a.count);

        const strengths: InsightItem[] = Object.entries(ruleTrueCounts)
            .map(([key, count]) => ({
                key,
                label: (ruleLabels[key] || key).replace("not ", ""),
                count,
                rate: rate(count, total),
            }))
            .filter((x) => x.count > 0)
            .sort((a, b) => b.count - a.count);

        const recommendations: string[] = [];
        const topMistake = repeatedMistakes[0];
        if (topMistake?.key === "riskRespected" && topMistake.rate >= 0.2) {
            recommendations.push("Risk discipline is the biggest leak. Use fixed risk per trade and stop moving SL wider.");
        }
        const earlyExit = repeatedMistakes.find((m) => m.key === "noEarlyExit");
        if (earlyExit && earlyExit.rate >= 0.2) {
            recommendations.push("You are exiting early often. Predefine partial/TP rules and log reasons when you exit early.");
        }
        const wrongSession = repeatedMistakes.find((m) => m.key === "correctSession");
        if (wrongSession && wrongSession.rate >= 0.15) {
            recommendations.push("Session selection is inconsistent. Limit trades to your best session and avoid low-liquidity hours.");
        }
        if (recommendations.length === 0) {
            recommendations.push("Keep consistency: focus on your top setup and repeat only A-quality trades.");
        }

        const charts = {
            mistakes: repeatedMistakes.slice(0, 6).map((m) => ({ name: m.label, value: m.count })),
            emotions: Object.entries(emotionMap)
                .map(([name, v]) => ({ name, net: v.net, count: v.count }))
                .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
                .slice(0, 6),
        };

        return res.json({
            tradesAnalyzed: total,
            dateRange: earliestDate && latestDate ? { from: earliestDate.toISOString(), to: latestDate.toISOString() } : null,
            summary: {
                netPnl,
                grossProfit,
                grossLoss,
                wins,
                losses,
                breakeven,
                winRate,
                profitFactor,
                avgRR,
            },
            repeatedMistakes,
            strengths,
            recommendations,
            charts,
        });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to compute AI insights" });
    }
}

function guessMime(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    return "image/jpeg";
}

function tryReadUploadToDataUrl(uploadPath: string | undefined) {
    if (!uploadPath) return undefined;
    // stored like "/uploads/<filename>"
    const fileName = uploadPath.replace(/^\/?uploads\//, "");
    const abs = path.resolve(config.uploadDirAbs, fileName);
    if (!fs.existsSync(abs)) return undefined;
    const buf = fs.readFileSync(abs);
    const mime = guessMime(abs);
    const b64 = buf.toString("base64");
    return `data:${mime};base64,${b64}`;
}

// GPT-powered insights (optionally with screenshots)
export async function gptInsights(req: Request & { userId?: string }, res: Response) {
    try {
        if (!config.openaiApiKey) {
            return res.status(400).json({ error: "OPENAI_API_KEY not configured on server" });
        }

        const looksLikeOpenRouter = /^sk-or-/.test(config.openaiApiKey);
        if (looksLikeOpenRouter && !config.openaiBaseUrl) {
            return res.status(400).json({
                error: "OPENAI_BASE_URL is required for OpenRouter keys",
                hint: "Set OPENAI_BASE_URL=https://openrouter.ai/api/v1",
            });
        }

        const limit = Math.max(10, Math.min(200, parseInt((req.query.limit as string) || "60", 10) || 60));
        const includeImages = String(req.query.images ?? "true").toLowerCase() !== "false";

        const trades = await Trade.find({ userId: req.userId })
            .sort({ date: -1 })
            .limit(limit)
            .select(
                "date instrument direction session outcome pnl rr rMultiple entryPrice stopLoss takeProfit exitPrice notes emotionalState htfScreenshot entryScreenshot postTradeScreenshot riskRespected noEarlyExit validPDArray correctSession followedHTFBias"
            )
            .lean();

        if (trades.length === 0) {
            return res.json({ model: config.openaiModel, tradesAnalyzed: 0, result: null });
        }

        // pick a small set of trades for image context (avoid huge token/image payload)
        const byPnlAsc = [...trades].sort((a: any, b: any) => (safeNumber(a.pnl) - safeNumber(b.pnl)));
        const byPnlDesc = [...trades].sort((a: any, b: any) => (safeNumber(b.pnl) - safeNumber(a.pnl)));
        const focusTrades = [
            ...byPnlAsc.slice(0, 2),
            ...byPnlDesc.slice(0, 2),
            ...trades.slice(0, 2),
        ];

        const imageItems: Array<{ type: "image_url"; image_url: { url: string } }> = [];
        if (includeImages) {
            for (const t of focusTrades as any[]) {
                const urls = [t.entryScreenshot, t.postTradeScreenshot, t.htfScreenshot].filter(Boolean);
                for (const u of urls) {
                    const dataUrl = tryReadUploadToDataUrl(u);
                    if (dataUrl) imageItems.push({ type: "image_url", image_url: { url: dataUrl } });
                    if (imageItems.length >= 6) break;
                }
                if (imageItems.length >= 6) break;
            }
        }

        const openai = new OpenAI({
            apiKey: config.openaiApiKey,
            baseURL: config.openaiBaseUrl || undefined,
            defaultHeaders: {
                ...(config.openaiAppName ? { "X-Title": config.openaiAppName } : {}),
                // OpenRouter recommends setting a referer; keep optional and server-controlled
                ...(process.env.OPENAI_HTTP_REFERER ? { "HTTP-Referer": process.env.OPENAI_HTTP_REFERER } : {}),
            },
        });

        const payload = {
            meta: {
                tradesAnalyzed: trades.length,
                includeImages: includeImages && imageItems.length > 0,
            },
            trades: trades.map((t: any) => ({
                date: t.date,
                instrument: t.instrument,
                direction: t.direction,
                session: t.session,
                outcome: t.outcome,
                pnl: t.pnl,
                rr: t.rr,
                rMultiple: t.rMultiple,
                entryPrice: t.entryPrice,
                stopLoss: t.stopLoss,
                takeProfit: t.takeProfit,
                exitPrice: t.exitPrice,
                emotionalState: t.emotionalState,
                rules: {
                    riskRespected: t.riskRespected,
                    noEarlyExit: t.noEarlyExit,
                    validPDArray: t.validPDArray,
                    correctSession: t.correctSession,
                    followedHTFBias: t.followedHTFBias,
                },
                notes: t.notes,
                screenshots: {
                    htf: t.htfScreenshot,
                    entry: t.entryScreenshot,
                    postTrade: t.postTradeScreenshot,
                }
            }))
        };

        const messages: any[] = [
            {
                role: "system",
                content:
                    "You are a trading journal performance analyst. Analyze patterns across trades, focus on repeated mistakes, strengths, risk management, and execution. Use a direct coaching tone. Do NOT give market predictions or trade signals. Output STRICT JSON only.",
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text:
                            "Analyze this trader's journal. Return JSON with keys: summary, repeatedMistakes, strengths, pairInsights, sessionInsights, psychologyInsights, riskInsights, actionPlan, charts.\n\nJSON format rules:\n- summary: { netPnlEstimate, winRateEstimate, biggestLeak, biggestStrength, shortSummary }\n- repeatedMistakes/strengths: array of { title, evidence, impact, fix }\n- pairInsights/sessionInsights: array of { name, note }\n- psychologyInsights/riskInsights: array of strings\n- actionPlan: array of 5 concrete steps\n- charts: { byPair: [{pair, net}], bySession: [{session, net}], byRuleBreak: [{rule, count}] }\n\nHere is the trade data (latest first):\n" + JSON.stringify(payload),
                    },
                    ...imageItems,
                ],
            },
        ];

        const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            messages,
            temperature: 0.2,
            response_format: { type: "json_object" } as any,
        });

        const text = completion.choices?.[0]?.message?.content || "{}";
        let parsed: any = null;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = { raw: text };
        }

        return res.json({ model: config.openaiModel, tradesAnalyzed: trades.length, imagesUsed: imageItems.length, result: parsed });
    } catch (err: any) {
        return res.status(500).json({ error: "Failed to compute GPT insights", detail: err?.message || String(err) });
    }
}
