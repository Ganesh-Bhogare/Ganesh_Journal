import { Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { Trade } from "../models/Trade";
import { config } from "../config";
import { getOpenAIClient } from "../utils/openaiClient";

const AnalyzeTradeBody = z.object({
    tradeId: z.string().min(1),
    includeImages: z.boolean().optional().default(true),
});

const WeeklyReviewBody = z.object({
    // Optional date range; defaults to last 7 days
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(10).max(200).optional().default(80),
    includeImages: z.boolean().optional().default(false),
});

const ChatTradeBody = z.object({
    tradeId: z.string().min(1),
    message: z.string().min(1).max(2000),
    // Keep history lightweight; UI should send last N turns.
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(4000),
            })
        )
        .optional()
        .default([]),
    includeImages: z.boolean().optional().default(false),
});

const ChatTradeResult = z.object({
    reply: z.string().min(1),
});

const AllTradesReportBody = z.object({
    // Optional date range; defaults to all time
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(50).max(1000).optional().default(400),
    includeImages: z.boolean().optional().default(false),
});

const AllTradesCoachResult = z.object({
    overview: z.string().min(1),
    ruleToEnforce: z.string().min(1),
    mostRepeatedMistake: z.string().min(1),
    strongestEdge: z.string().min(1),
    strictRulesForNext30Days: z.array(z.string()).min(3).max(6),
});

const AnalyzeTradeResult = z.object({
    verdict: z.enum(["avoidable_loss", "valid_loss", "valid_win", "avoidable_win"]),
    primaryFailure: z.string().min(1),
    avoidable: z.boolean(),
    evidence: z.array(z.string()).min(1),
    deviations: z.array(z.string()).min(1),
    metrics: z.object({
        plannedRR: z.string(),
        achievedR: z.string(),
        pnl: z.string(),
        mae: z.string(),
        mfe: z.string(),
    }),
    ruleToAdd: z.string().min(1),
    nextTimeAction: z.string().min(1),
});

const WeeklyReviewCoachResult = z.object({
    ruleToEnforce: z.string().min(1),
    mostRepeatedMistake: z.string().min(1),
    strongestEdge: z.string().min(1),
    strictRulesForNextWeek: z.array(z.string()).min(3).max(6),
});

function safeNumber(v: any) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function fmtNum(v: any, decimals = 2) {
    const n = safeNumber(v);
    if (n === undefined) return "N/A";
    return n.toFixed(decimals);
}

function fmtMoney(v: any) {
    const n = safeNumber(v);
    if (n === undefined) return "N/A";
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function normalizeNullsDeep(value: any): any {
    if (value === null) return "N/A";
    if (Array.isArray(value)) return value.map(normalizeNullsDeep);
    if (value && typeof value === "object") {
        const out: any = {};
        for (const [k, v] of Object.entries(value)) out[k] = normalizeNullsDeep(v);
        return out;
    }
    return value;
}

function computePlannedRR(t: any) {
    const entry = safeNumber(t.entryPrice);
    const sl = safeNumber(t.stopLoss);
    const tp = safeNumber(t.takeProfit);
    if (entry === undefined || sl === undefined || tp === undefined) return undefined;
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (!risk) return undefined;
    return reward / risk;
}

function computeAchievedR(t: any) {
    if (typeof t.rMultiple === "number" && Number.isFinite(t.rMultiple)) return t.rMultiple;
    const entry = safeNumber(t.entryPrice);
    const sl = safeNumber(t.stopLoss);
    const exit = safeNumber(t.exitPrice);
    const direction = t.direction;
    if (entry === undefined || sl === undefined || exit === undefined) return undefined;
    const risk = Math.abs(entry - sl);
    if (!risk) return undefined;
    const rewardAbs = Math.abs(exit - entry);
    const win = direction === "long" ? exit > entry : exit < entry;
    const r = rewardAbs / risk;
    return win ? r : -r;
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
    const fileName = uploadPath.replace(/^\/?uploads\//, "");
    const abs = path.resolve(config.uploadDirAbs, fileName);
    if (!fs.existsSync(abs)) return undefined;
    const buf = fs.readFileSync(abs);
    const mime = guessMime(abs);
    return `data:${mime};base64,${buf.toString("base64")}`;
}

function tradeToPromptJson(t: any) {
    const plannedRR = computePlannedRR(t);
    const achievedR = computeAchievedR(t);
    return {
        instrument: t.instrument,
        plannedDirection: t.direction,
        actualDirection: t.direction,
        session: t.session,
        weeklyBias: t.weeklyBias,
        dailyBias: t.dailyBias,
        setupType: t.setupType,
        pdArrays: Array.isArray(t.pdArrays) ? t.pdArrays : [],
        entryTimeframe: t.entryTimeframe,
        entryConfirmation: t.entryConfirmation,
        mae: t.mae,
        mfe: t.mfe,
        htfLevelUsed: t.htfLevelUsed,
        ltfConfirmationQuality: t.ltfConfirmationQuality,
        riskPerTrade: t.riskPerTrade,
        result: t.outcome,
        rMultiple: t.rMultiple,
        rr: t.rr,
        plannedRR,
        achievedR,
        emotionalState: t.emotionalState,
        notes: t.notes,
        rules: {
            riskRespected: t.riskRespected,
            noEarlyExit: t.noEarlyExit,
            validPDArray: t.validPDArray,
            correctSession: t.correctSession,
            followedHTFBias: t.followedHTFBias,
            ruleBreakCount: t.ruleBreakCount,
        },
        prices: {
            entryPrice: t.entryPrice,
            stopLoss: t.stopLoss,
            takeProfit: t.takeProfit,
            exitPrice: t.exitPrice,
        },
        pnl: t.pnl,
        date: t.date,
    };
}

function computeSummaryStats(trades: any[]) {
    const totals = {
        trades: trades.length,
        wins: 0,
        losses: 0,
        breakeven: 0,
        netPnl: 0,
        sumR: 0,
        rCount: 0,
        avoidableLosses: 0,
        validLosses: 0,
        ruleBroken: 0,
        ruleFollowed: 0,
    };

    const lossesByRuleViolation: Record<string, number> = {
        riskRespected: 0,
        noEarlyExit: 0,
        validPDArray: 0,
        correctSession: 0,
        followedHTFBias: 0,
    };

    const bySetup: Record<string, { count: number; net: number }> = {};

    for (const t of trades) {
        const pnl = safeNumber((t as any).pnl) ?? 0;
        totals.netPnl += pnl;

        const outcome = (t as any).outcome;
        if (outcome === "win" || (!outcome && pnl > 0)) totals.wins += 1;
        else if (outcome === "loss" || (!outcome && pnl < 0)) totals.losses += 1;
        else totals.breakeven += 1;

        const achievedR = computeAchievedR(t);
        if (typeof achievedR === "number" && Number.isFinite(achievedR)) {
            totals.sumR += achievedR;
            totals.rCount += 1;
        }

        const rules = {
            riskRespected: !!(t as any).riskRespected,
            noEarlyExit: !!(t as any).noEarlyExit,
            validPDArray: !!(t as any).validPDArray,
            correctSession: !!(t as any).correctSession,
            followedHTFBias: !!(t as any).followedHTFBias,
        };
        const anyBroken = Object.values(rules).some((v) => v === false);
        if (anyBroken) totals.ruleBroken += 1;
        else totals.ruleFollowed += 1;

        if ((outcome === "loss") || (!outcome && pnl < 0)) {
            // Classify loss as avoidable if any rule broken; otherwise valid.
            if (anyBroken) totals.avoidableLosses += 1;
            else totals.validLosses += 1;

            if (!rules.riskRespected) lossesByRuleViolation.riskRespected += 1;
            if (!rules.noEarlyExit) lossesByRuleViolation.noEarlyExit += 1;
            if (!rules.validPDArray) lossesByRuleViolation.validPDArray += 1;
            if (!rules.correctSession) lossesByRuleViolation.correctSession += 1;
            if (!rules.followedHTFBias) lossesByRuleViolation.followedHTFBias += 1;
        }

        const setupType = String((t as any).setupType || "Unknown");
        if (!bySetup[setupType]) bySetup[setupType] = { count: 0, net: 0 };
        bySetup[setupType].count += 1;
        bySetup[setupType].net += pnl;
    }

    const winRatePct = totals.trades ? Math.round((totals.wins / totals.trades) * 100) : 0;
    const avgR = totals.rCount ? totals.sumR / totals.rCount : 0;
    const avoidableLossRatePct = totals.losses ? Math.round((totals.avoidableLosses / totals.losses) * 100) : 0;

    const bestSetups = Object.entries(bySetup)
        .map(([name, v]) => ({ name, count: v.count, net: v.net }))
        .sort((a, b) => (b.net - a.net) || (b.count - a.count))
        .slice(0, 5);

    return {
        totals: {
            trades: totals.trades,
            wins: totals.wins,
            losses: totals.losses,
            breakeven: totals.breakeven,
            winRatePct,
            netPnl: Number(totals.netPnl.toFixed(2)),
            avgR: Number(avgR.toFixed(2)),
            ruleFollowed: totals.ruleFollowed,
            ruleBroken: totals.ruleBroken,
        },
        avoidableVsValidLosses: {
            avoidableLosses: totals.avoidableLosses,
            validLosses: totals.validLosses,
            avoidableLossRatePct,
        },
        lossesByRuleViolation,
        bestSetups,
    };
}

export async function analyzeTrade(req: Request & { userId?: string }, res: Response) {
    try {
        const body = AnalyzeTradeBody.parse(req.body);

        const trade = await Trade.findOne({ _id: body.tradeId, userId: req.userId }).lean();
        if (!trade) return res.status(404).json({ error: "Trade not found" });

        const openai = getOpenAIClient();

        const textPayload = tradeToPromptJson(trade);

        const imageItems: Array<{ type: "image_url"; image_url: { url: string } }> = [];
        if (body.includeImages) {
            const urls = [
                (trade as any).entryScreenshot,
                (trade as any).postTradeScreenshot,
                (trade as any).htfScreenshot,
            ].filter(Boolean);

            for (const u of urls) {
                const dataUrl = tryReadUploadToDataUrl(u);
                if (dataUrl) imageItems.push({ type: "image_url", image_url: { url: dataUrl } });
            }
        }

        const messages: any[] = [
            {
                role: "system",
                content:
                    "You are a strict ICT trading execution coach. You MUST NOT give buy/sell signals or predictions. Your job is to JUDGE execution vs plan using only the provided JSON fields and numbers. No generic lecture. No motivational talk. Output STRICT JSON only.",
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text:
                            "COACH MODE (STRICT): Compare planned trade vs executed trade.\n" +
                            "Rules:\n" +
                            "- Use SPECIFIC evidence with numbers and field names (e.g. entryPrice, stopLoss, takeProfit, plannedRR, achievedR).\n" +
                            "- If data is missing, write 'DATA_MISSING: <field>' in evidence and continue.\n" +
                            "- Do NOT output null anywhere; use 'N/A' instead.\n" +
                            "- Verdict must be one of: avoidable_loss, valid_loss, valid_win, avoidable_win\n\n" +
                            "Return JSON ONLY with this exact shape:\n" +
                            JSON.stringify({
                                verdict: "avoidable_loss",
                                primaryFailure: "",
                                avoidable: true,
                                evidence: [""],
                                deviations: [""],
                                metrics: {
                                    plannedRR: "",
                                    achievedR: "",
                                    pnl: "",
                                    mae: "N/A",
                                    mfe: "N/A",
                                },
                                ruleToAdd: "",
                                nextTimeAction: "",
                            }) +
                            "\n\nTrade JSON:\n" +
                            JSON.stringify(textPayload),
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

        const content = completion.choices?.[0]?.message?.content || "{}";
        const parsed = (() => {
            try {
                return normalizeNullsDeep(JSON.parse(content));
            } catch {
                return { raw: content };
            }
        })();

        const validated = AnalyzeTradeResult.safeParse(parsed);
        if (!validated.success) {
            return res.status(200).json({
                model: config.openaiModel,
                tradeId: body.tradeId,
                imagesUsed: imageItems.length,
                ok: false,
                result: parsed,
                validationError: validated.error.flatten(),
            });
        }

        return res.json({
            model: config.openaiModel,
            tradeId: body.tradeId,
            imagesUsed: imageItems.length,
            ok: true,
            result: validated.data,
        });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to analyze trade", detail: err?.message || String(err) });
    }
}

export async function chatTrade(req: Request & { userId?: string }, res: Response) {
    try {
        const body = ChatTradeBody.parse(req.body);

        const trade = await Trade.findOne({ _id: body.tradeId, userId: req.userId }).lean();
        if (!trade) return res.status(404).json({ error: "Trade not found" });

        const openai = getOpenAIClient();
        const textPayload = tradeToPromptJson(trade);

        const imageItems: Array<{ type: "image_url"; image_url: { url: string } }> = [];
        if (body.includeImages) {
            const urls = [
                (trade as any).entryScreenshot,
                (trade as any).postTradeScreenshot,
                (trade as any).htfScreenshot,
            ].filter(Boolean);

            for (const u of urls) {
                const dataUrl = tryReadUploadToDataUrl(u);
                if (dataUrl) imageItems.push({ type: "image_url", image_url: { url: dataUrl } });
            }
        }

        const history = (body.history || []).slice(-12);

        const messages: any[] = [
            {
                role: "system",
                content:
                    "You are a strict ICT trading execution coach. You MUST NOT give buy/sell signals or predictions. You answer ONLY about execution quality based on the provided Trade JSON and user questions. Be direct, specific, and cite field names/numbers (e.g., entryPrice, stopLoss, plannedRR, achievedR, mae/mfe). If data is missing, say DATA_MISSING:<field>. Output STRICT JSON only: {reply: string}.",
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text:
                            "Trade JSON:\n" +
                            JSON.stringify(textPayload) +
                            "\n\nChat history (most recent last):\n" +
                            JSON.stringify(history) +
                            "\n\nUser question:\n" +
                            body.message +
                            "\n\nReturn JSON ONLY with shape: " +
                            JSON.stringify({ reply: "" }),
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

        const content = completion.choices?.[0]?.message?.content || "{}";
        const parsed = (() => {
            try {
                return normalizeNullsDeep(JSON.parse(content));
            } catch {
                return { reply: String(content || "").trim() };
            }
        })();

        const validated = ChatTradeResult.safeParse(parsed);
        if (!validated.success) {
            return res.status(200).json({
                model: config.openaiModel,
                tradeId: body.tradeId,
                imagesUsed: imageItems.length,
                ok: false,
                result: parsed,
                validationError: validated.error.flatten(),
            });
        }

        return res.json({
            model: config.openaiModel,
            tradeId: body.tradeId,
            imagesUsed: imageItems.length,
            ok: true,
            result: validated.data,
        });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to chat about trade", detail: err?.message || String(err) });
    }
}

export async function allTradesReport(req: Request & { userId?: string }, res: Response) {
    try {
        const body = AllTradesReportBody.parse(req.body);

        const query: any = { userId: req.userId };
        if (body.from || body.to) {
            const to = body.to ? new Date(body.to) : new Date();
            const from = body.from ? new Date(body.from) : new Date(0);
            query.date = { $gte: from, $lte: to };
        }

        const trades = await Trade.find(query)
            .sort({ date: -1 })
            .limit(body.limit)
            .lean();

        const openai = getOpenAIClient();
        const tradeJson = trades.map(tradeToPromptJson);
        const stats = computeSummaryStats(trades);

        const messages: any[] = [
            {
                role: "system",
                content:
                    "You are a strict ICT trading execution coach. You MUST NOT give buy/sell signals or predictions. Your job: summarize patterns across the provided trades, enforce one rule, and produce strict actionable rules. No generic lecture. Output STRICT JSON only.",
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text:
                            "COACH MODE (ALL TRADES): Summarize the journal using ONLY this data.\n" +
                            "Rules:\n" +
                            "- Use SPECIFIC evidence referencing fields (plannedRR, achievedR, mae/mfe, rules.*) and the computed stats.\n" +
                            "- If data is missing, include DATA_MISSING:<field> in overview.\n" +
                            "- Do NOT output null anywhere; use 'N/A' instead.\n\n" +
                            "Return JSON ONLY with this exact shape:\n" +
                            JSON.stringify({
                                overview: "",
                                ruleToEnforce: "",
                                mostRepeatedMistake: "",
                                strongestEdge: "",
                                strictRulesForNext30Days: ["", "", ""],
                            }) +
                            "\n\nComputed Stats:\n" +
                            JSON.stringify(stats) +
                            "\n\nTrades JSON (most recent first):\n" +
                            JSON.stringify(tradeJson),
                    },
                ],
            },
        ];

        const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            messages,
            temperature: 0.2,
            response_format: { type: "json_object" } as any,
        });

        const content = completion.choices?.[0]?.message?.content || "{}";
        const parsed = (() => {
            try {
                return normalizeNullsDeep(JSON.parse(content));
            } catch {
                return { raw: content };
            }
        })();

        const validated = AllTradesCoachResult.safeParse(parsed);
        if (!validated.success) {
            return res.status(200).json({
                model: config.openaiModel,
                tradesAnalyzed: trades.length,
                ok: false,
                stats,
                result: parsed,
                validationError: validated.error.flatten(),
            });
        }

        return res.json({
            model: config.openaiModel,
            tradesAnalyzed: trades.length,
            ok: true,
            stats,
            result: validated.data,
        });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to compute all-trades report", detail: err?.message || String(err) });
    }
}

export async function weeklyReview(req: Request & { userId?: string }, res: Response) {
    try {
        const body = WeeklyReviewBody.parse(req.body);

        const to = body.to ? new Date(body.to) : new Date();
        const from = body.from ? new Date(body.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const trades = await Trade.find({
            userId: req.userId,
            date: { $gte: from, $lte: to },
        })
            .sort({ date: -1 })
            .limit(body.limit)
            .lean();

        const openai = getOpenAIClient();

        const tradeJson = trades.map(tradeToPromptJson);

        // Compute real stats (no GPT "pretty" charts)
        const totals = {
            trades: trades.length,
            wins: 0,
            losses: 0,
            breakeven: 0,
            avoidableLosses: 0,
            validLosses: 0,
            ruleBroken: 0,
            ruleFollowed: 0,
            sumRRuleBroken: 0,
            sumRRuleFollowed: 0,
            countRRuleBroken: 0,
            countRRuleFollowed: 0,
        };

        const ruleViolationCounts: Record<string, number> = {
            "Risk Not Respected": 0,
            "Early Exit": 0,
            "Invalid PD Array": 0,
            "Wrong Session": 0,
            "HTF Bias Not Followed": 0,
        };

        for (const t of trades as any[]) {
            const pnl = safeNumber(t.pnl) ?? 0;
            if (pnl > 0) totals.wins++;
            else if (pnl < 0) totals.losses++;
            else totals.breakeven++;

            const broke = (t.ruleBreakCount ?? 0) > 0;
            if (broke) totals.ruleBroken++;
            else totals.ruleFollowed++;

            if (t.outcome === "loss" || pnl < 0) {
                if (broke) totals.avoidableLosses++;
                else totals.validLosses++;
            }

            const r = computeAchievedR(t);
            if (typeof r === "number" && Number.isFinite(r)) {
                if (broke) {
                    totals.sumRRuleBroken += r;
                    totals.countRRuleBroken++;
                } else {
                    totals.sumRRuleFollowed += r;
                    totals.countRRuleFollowed++;
                }
            }

            if (t.riskRespected === false) ruleViolationCounts["Risk Not Respected"]++;
            if (t.noEarlyExit === false) ruleViolationCounts["Early Exit"]++;
            if (t.validPDArray === false) ruleViolationCounts["Invalid PD Array"]++;
            if (t.correctSession === false) ruleViolationCounts["Wrong Session"]++;
            if (t.followedHTFBias === false) ruleViolationCounts["HTF Bias Not Followed"]++;
        }

        const avgRRuleFollowed = totals.countRRuleFollowed ? (totals.sumRRuleFollowed / totals.countRRuleFollowed) : 0;
        const avgRRuleBroken = totals.countRRuleBroken ? (totals.sumRRuleBroken / totals.countRRuleBroken) : 0;

        const lossesByRuleViolation = Object.entries(ruleViolationCounts)
            .map(([rule, count]) => ({ rule, count }))
            .filter((x) => x.count > 0)
            .sort((a, b) => b.count - a.count);

        const avoidableLossRatePct = totals.losses ? Math.round((totals.avoidableLosses / totals.losses) * 100) : 0;

        const stats = {
            totals: {
                trades: totals.trades,
                wins: totals.wins,
                losses: totals.losses,
                breakeven: totals.breakeven,
            },
            avoidableVsValidLosses: {
                avoidable: totals.avoidableLosses,
                valid: totals.validLosses,
                avoidableLossRatePct,
            },
            lossesByRuleViolation,
            avgR: {
                ruleFollowed: Number.isFinite(avgRRuleFollowed) ? Number(avgRRuleFollowed.toFixed(2)) : 0,
                ruleBroken: Number.isFinite(avgRRuleBroken) ? Number(avgRRuleBroken.toFixed(2)) : 0,
            },
        };

        const messages: any[] = [
            {
                role: "system",
                content:
                    "You are a strict ICT trading execution coach. You MUST NOT give buy/sell signals or predictions. Give short, enforceable coaching based on the provided stats and trades. Output STRICT JSON only. Do NOT output null; use 'N/A'.",
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text:
                            "WEEKLY COACHING MODE (STRICT):\n" +
                            "- Your job is to enforce rules, not to teach theory.\n" +
                            "- Use the provided STATS for your conclusions.\n" +
                            "- Output NO nulls; use 'N/A'.\n\n" +
                            "Return JSON ONLY with this exact shape:\n" +
                            JSON.stringify({
                                ruleToEnforce: "",
                                mostRepeatedMistake: "",
                                strongestEdge: "",
                                strictRulesForNextWeek: [""],
                            }) +
                            "\n\nSTATS JSON:\n" +
                            JSON.stringify(stats) +
                            "\n\nTRADES JSON (sample):\n" +
                            JSON.stringify(tradeJson.slice(0, 50)),
                    },
                ],
            },
        ];

        const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            messages,
            temperature: 0.2,
            response_format: { type: "json_object" } as any,
        });

        const content = completion.choices?.[0]?.message?.content || "{}";
        const parsed = (() => {
            try {
                return normalizeNullsDeep(JSON.parse(content));
            } catch {
                return { raw: content };
            }
        })();

        const validated = WeeklyReviewCoachResult.safeParse(parsed);
        if (!validated.success) {
            return res.status(200).json({
                model: config.openaiModel,
                ok: false,
                tradesAnalyzed: trades.length,
                dateRange: { from: from.toISOString(), to: to.toISOString() },
                stats,
                result: parsed,
                validationError: validated.error.flatten(),
            });
        }

        return res.json({
            model: config.openaiModel,
            ok: true,
            tradesAnalyzed: trades.length,
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            result: validated.data,
            stats,
        });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to generate weekly review", detail: err?.message || String(err) });
    }
}
