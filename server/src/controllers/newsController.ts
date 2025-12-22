import { Request, Response } from "express";
import { z } from "zod";
import Parser from "rss-parser";
import { config } from "../config";
import { getOpenAIClient } from "../utils/openaiClient";

type NewsItem = {
    id: string;
    title: string;
    link?: string;
    source: string;
    publishedAt?: string;
    summary?: string;
    currencies: string[];
    pairs: string[];
};

const GetNewsQuery = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    days: z.coerce.number().int().min(1).max(60).optional(),
    currency: z.string().trim().toUpperCase().min(3).max(3).optional(),
    pair: z.string().trim().toUpperCase().min(6).max(7).optional(),
});

const AnalyzeNewsBody = z.object({
    currency: z.string().trim().toUpperCase().min(3).max(3).optional(),
    pair: z.string().trim().toUpperCase().min(6).max(7).optional(),
    // Client can pass items from /news to avoid refetch.
    items: z
        .array(
            z.object({
                title: z.string().min(1),
                link: z.string().optional(),
                source: z.string().min(1),
                publishedAt: z.string().optional(),
                summary: z.string().optional(),
                currencies: z.array(z.string()).optional().default([]),
                pairs: z.array(z.string()).optional().default([]),
            })
        )
        .min(1)
        .max(300),
});

const NewsBiasResult = z.object({
    focus: z.object({
        currency: z.string().optional(),
        pair: z.string().optional(),
    }),
    summary: z.string().min(20).max(2000),
    impactedCurrencies: z.array(z.string().min(3).max(3)).min(1).max(12),
    currencyImpacts: z
        .array(
            z.object({
                currency: z.string().min(3).max(3),
                impact: z.enum(["supportive", "negative", "neutral", "mixed"]),
                reasons: z.array(z.string()).min(1).max(4),
            })
        )
        .min(1)
        .max(12),
    shortTerm: z.object({
        bias: z.enum(["bullish", "bearish", "neutral", "mixed"]),
        confidence: z.number().min(0).max(1),
        reasons: z.array(z.string()).min(2).max(6),
    }),
    longTerm: z.object({
        bias: z.enum(["bullish", "bearish", "neutral", "mixed"]),
        confidence: z.number().min(0).max(1),
        reasons: z.array(z.string()).min(2).max(6),
    }),
    watchlistPairs: z.array(z.string()).min(0).max(12),
    keyRisks: z.array(z.string()).min(1).max(8),
});

const currencyRegex = /\b(USD|EUR|GBP|JPY|AUD|NZD|CAD|CHF|CNY)\b/g;
const pairRegex = /\b([A-Z]{3}\/?[A-Z]{3})\b/g;

function normalizePair(raw: string) {
    const s = raw.replace("/", "").toUpperCase();
    return s.length === 6 ? s : undefined;
}

function extractCurrenciesAndPairs(text: string) {
    const currencies = new Set<string>();
    const pairs = new Set<string>();

    for (const m of text.matchAll(currencyRegex)) currencies.add(m[1]);
    for (const m of text.matchAll(pairRegex)) {
        const p = normalizePair(m[1]);
        if (p) pairs.add(p);
    }

    // If we found a 6-letter pair like EURUSD, infer the two currencies.
    for (const p of pairs) {
        currencies.add(p.slice(0, 3));
        currencies.add(p.slice(3, 6));
    }

    return {
        currencies: Array.from(currencies),
        pairs: Array.from(pairs),
    };
}

function hashId(parts: string[]) {
    // Stable enough for UI keys; avoids adding crypto dependency.
    return parts
        .join("|")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 120);
}

const parser = new Parser({
    timeout: 15_000,
});

const feedCache = new Map<
    string,
    {
        fetchedAt: number;
        items: NewsItem[];
    }
>();

async function fetchFeed(url: string): Promise<NewsItem[]> {
    const now = Date.now();
    const cached = feedCache.get(url);
    const ttlMs = Math.max(10, config.newsCacheTtlSeconds) * 1000;
    if (cached && now - cached.fetchedAt < ttlMs) return cached.items;

    const feed = await parser.parseURL(url);
    const source = feed.title || new URL(url).hostname;

    const items: NewsItem[] = (feed.items || []).map((it) => {
        const title = String(it.title || "").trim();
        const link = it.link ? String(it.link) : undefined;
        const pub = (it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : undefined)) as
            | string
            | undefined;
        const summary = String((it as any).contentSnippet || (it as any).content || (it as any).summary || "").trim();

        const combined = `${title}\n${summary}`.toUpperCase();
        const extracted = extractCurrenciesAndPairs(combined);

        return {
            id: hashId([url, title, pub || "", link || ""]),
            title: title || "(untitled)",
            link,
            source,
            publishedAt: pub,
            summary: summary || undefined,
            currencies: extracted.currencies,
            pairs: extracted.pairs,
        };
    });

    feedCache.set(url, { fetchedAt: now, items });
    return items;
}

export async function getNews(_req: Request & { userId?: string }, res: Response) {
    try {
        const q = GetNewsQuery.parse(_req.query);

        if (!config.newsFeeds.length) {
            return res.status(200).json({
                ok: false,
                error:
                    "No news feeds configured. Set NEWS_FEEDS (comma-separated RSS/Atom feed URLs) in server env.",
                items: [],
            });
        }

        const limit = Math.min(q.limit ?? config.newsDefaultLimit, config.newsMaxLimit);
        const cutoff = q.days ? Date.now() - q.days * 24 * 60 * 60 * 1000 : undefined;
        const currency = q.currency;
        const pair = q.pair ? normalizePair(q.pair) : undefined;

        const lists = await Promise.all(config.newsFeeds.map((u) => fetchFeed(u)));
        let items = lists.flat();

        items = items
            .filter((it) => {
                if (!cutoff) return true;
                if (!it.publishedAt) return true;
                const t = Date.parse(it.publishedAt);
                return Number.isFinite(t) ? t >= cutoff : true;
            })
            .filter((it) => {
                if (pair) return it.pairs.includes(pair) || it.currencies.includes(pair.slice(0, 3)) || it.currencies.includes(pair.slice(3, 6));
                if (currency) return it.currencies.includes(currency);
                return true;
            })
            .sort((a, b) => {
                const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
                const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
                return tb - ta;
            })
            .slice(0, limit);

        return res.json({ ok: true, items });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to fetch news", detail: err?.message || String(err) });
    }
}

export async function analyzeNewsBias(req: Request & { userId?: string }, res: Response) {
    try {
        const body = AnalyzeNewsBody.parse(req.body);
        const currency = body.currency;
        const pair = body.pair ? normalizePair(body.pair) : undefined;

        const focus = {
            currency: currency || undefined,
            pair: pair || undefined,
        };

        const items = body.items
            .slice()
            .sort((a, b) => {
                const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
                const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
                return tb - ta;
            })
            .slice(0, 60)
            .map((it) => ({
                title: it.title,
                source: it.source,
                publishedAt: it.publishedAt,
                link: it.link,
                summary: it.summary,
                currencies: it.currencies || [],
                pairs: it.pairs || [],
            }));

        const openai = getOpenAIClient();

        const prompt = {
            focus,
            items,
            instructions: [
                "You are a macro + FX news analyst.",
                "Goal: infer directional bias for the focus currency/pair based ONLY on the provided news headlines/summaries.",
                "You MUST NOT provide trade entries, price targets, or buy/sell signals.",
                "If focus is missing, infer which currencies/pairs are most impacted and provide generalized USD/EUR/GBP/JPY bias.",
                "Output STRICT JSON only with the exact schema provided.",
                "Bias meanings: bullish means currency likely strengthens; bearish means likely weakens; mixed means conflicting signals.",
                "Short-term: 1-3 days. Long-term: 2-8 weeks.",
                "Confidence is 0..1; be conservative.",
                "impactedCurrencies must include the focus currency if provided.",
                "currencyImpacts should explain effect of news on each currency (supportive/negative/mixed/neutral).",
            ],
        };

        const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            temperature: 0.2,
            response_format: { type: "json_object" } as any,
            messages: [
                {
                    role: "system",
                    content:
                        "You analyze FX-relevant news and produce bias summaries. You do NOT give trading signals. You output JSON only.",
                },
                {
                    role: "user",
                    content:
                        "Return JSON ONLY matching this schema: " +
                        JSON.stringify({
                            focus: { currency: "USD", pair: "EURUSD" },
                            summary: "Overall, today's releases tilt USD supportive in the near term due to ...",
                            impactedCurrencies: ["USD", "EUR"],
                            currencyImpacts: [
                                { currency: "USD", impact: "supportive", reasons: ["..."] },
                                { currency: "EUR", impact: "negative", reasons: ["..."] }
                            ],
                            shortTerm: { bias: "neutral", confidence: 0.5, reasons: ["..."] },
                            longTerm: { bias: "neutral", confidence: 0.5, reasons: ["..."] },
                            watchlistPairs: ["EURUSD"],
                            keyRisks: ["..."]
                        }) +
                        "\n\nInput:\n" +
                        JSON.stringify(prompt),
                },
            ],
        });

        const content = completion.choices?.[0]?.message?.content || "{}";
        const parsed = (() => {
            try {
                return JSON.parse(content);
            } catch {
                return { raw: String(content || "").trim() };
            }
        })();

        const validated = NewsBiasResult.safeParse(parsed);
        if (!validated.success) {
            return res.status(200).json({
                ok: false,
                model: config.openaiModel,
                focus,
                result: parsed,
                validationError: validated.error.flatten(),
            });
        }

        return res.json({ ok: true, model: config.openaiModel, result: validated.data });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to analyze news", detail: err?.message || String(err) });
    }
}
