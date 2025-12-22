import { Request, Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { getOpenAIClient } from "../utils/openaiClient";
import { normalizeCalendarLabels } from "../utils/calendarNormalization";

type CalendarEvent = {
    id: number;
    date: string;
    country?: string;
    currency?: string;
    category?: string;
    event?: string;
    importance?: 1 | 2 | 3;
    actual?: string;
    previous?: string;
    forecast?: string;
    unit?: string;
    source?: string;
    link?: string;
};

const GetCalendarTodayQuery = z.object({
    currency: z.string().trim().toUpperCase().min(3).max(3).optional(),
    importance: z.coerce.number().int().min(1).max(3).optional(),
});

const AnalyzeCalendarBody = z.object({
    currency: z.string().trim().toUpperCase().min(3).max(3).optional(),
    pair: z.string().trim().toUpperCase().min(6).max(7).optional(),
    events: z
        .array(
            z.object({
                id: z.number().int().optional(),
                date: z.string().min(1),
                country: z.string().optional(),
                currency: z.string().optional(),
                category: z.string().optional(),
                event: z.string().optional(),
                importance: z.number().int().min(1).max(3).optional(),
                actual: z.string().optional(),
                previous: z.string().optional(),
                forecast: z.string().optional(),
                unit: z.string().optional(),
                source: z.string().optional(),
                link: z.string().optional(),
            })
        )
        .min(1)
        .max(500),
});

const CalendarImpactResult = z.object({
    focus: z.object({
        currency: z.string().optional(),
        pair: z.string().optional(),
    }),
    summary: z.string().min(20).max(2400),
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
    keyEvents: z.array(z.string()).min(2).max(8),
    keyRisks: z.array(z.string()).min(1).max(8),
});

function normalizePair(raw?: string) {
    if (!raw) return undefined;
    const s = raw.replace("/", "").toUpperCase();
    return s.length === 6 ? s : undefined;
}

function ymdUtc(d: Date) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function ymdInTimeZone(d: Date, timeZone: string) {
    // Use Intl parts to avoid locale-dependent parsing.
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(d);

    const yyyy = parts.find((p) => p.type === "year")?.value;
    const mm = parts.find((p) => p.type === "month")?.value;
    const dd = parts.find((p) => p.type === "day")?.value;
    if (yyyy && mm && dd) return `${yyyy}-${mm}-${dd}`;
    // Fallback
    return ymdUtc(d);
}

function safeIso(input: any): string | undefined {
    if (!input) return undefined;
    let s = String(input).trim();
    // If the timestamp has no timezone designator, treat it as UTC to avoid
    // Node/OS-local parsing shifting the time unexpectedly.
    // Examples considered "timezone-less": 2025-12-22T14:00:00
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
        s = `${s}Z`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return undefined;
}

function inferCurrencyFromCountry(country?: string): string | undefined {
    const c = (country || "").trim().toLowerCase();
    if (!c) return undefined;

    // Keep this conservative: only map obvious, widely-used country -> currency.
    if (c === "united states" || c === "united states of america" || c === "usa") return "USD";
    if (c === "united kingdom" || c === "uk" || c === "britain" || c === "england") return "GBP";
    if (c === "euro area" || c === "european union") return "EUR";
    if (c === "japan") return "JPY";
    if (c === "switzerland") return "CHF";
    if (c === "australia") return "AUD";
    if (c === "new zealand") return "NZD";
    if (c === "canada") return "CAD";
    if (c === "china" || c === "people's republic of china" || c === "prc") return "CNY";
    if (c === "hong kong") return "HKD";
    if (c === "singapore") return "SGD";
    if (c === "india") return "INR";
    if (c === "south korea" || c === "korea" || c === "republic of korea") return "KRW";
    if (c === "indonesia") return "IDR";
    if (c === "mexico") return "MXN";
    if (c === "brazil") return "BRL";
    if (c === "south africa") return "ZAR";

    return undefined;
}

const cache = new Map<string, { fetchedAt: number; events: CalendarEvent[] }>();

function withActualHiddenForFuture(events: CalendarEvent[]) {
    const now = Date.now();
    const bufferMs = 2 * 60 * 1000;
    return events.map((e) => {
        const t = Date.parse(e.date);
        const isFuture = Number.isFinite(t) ? t - now > bufferMs : false;
        if (!isFuture) return e;
        // Prevent showing early "Actual" values before the release time.
        return { ...e, actual: undefined };
    });
}

function isExcludedByKeywords(e: CalendarEvent) {
    const hay = `${e.event || ""} ${e.category || ""}`.toLowerCase();
    if (!hay.trim()) return false;
    return (config.calendarExcludeKeywords || []).some((k) => k && hay.includes(k));
}

function isAllowedCurrency(e: CalendarEvent) {
    const c = String(e.currency || "").toUpperCase();
    if (!c) return false;
    const allow = config.calendarAllowedCurrencies || [];
    if (allow.length === 0) return true;
    return allow.includes(c);
}

async function fetchTradingEconomicsToday(importance?: 1 | 2 | 3) {
    const start = ymdInTimeZone(new Date(), config.calendarTimeZone || "Asia/Kolkata");
    const end = start;

    const key = config.tradingEconomicsApiKey || "guest:guest";
    const base = config.tradingEconomicsBaseUrl || "https://api.tradingeconomics.com";

    const url = new URL(`${base.replace(/\/$/, "")}/calendar/country/All/${start}/${end}`);
    url.searchParams.set("c", key);
    url.searchParams.set("f", "json");
    if (importance) url.searchParams.set("importance", String(importance));

    const cacheKey = url.toString();
    const now = Date.now();
    const ttlMs = Math.max(10, config.calendarCacheTtlSeconds) * 1000;
    const cached = cache.get(cacheKey);
    if (cached && now - cached.fetchedAt < ttlMs) return cached.events;

    const resp = await fetch(cacheKey);
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`TradingEconomics request failed (${resp.status}): ${text.slice(0, 200)}`);
    }

    const raw = (await resp.json()) as any[];

    const events: CalendarEvent[] = Array.isArray(raw)
        ? raw
            .map((r) => {
                const id = Number(r.CalendarId ?? r.Id ?? r.id ?? 0);
                const date = safeIso(r.Date ?? r.date) || new Date().toISOString();

                const linkPath = typeof r.URL === "string" ? r.URL : undefined;
                const link = linkPath
                    ? /^https?:\/\//i.test(linkPath)
                        ? linkPath
                        : `https://tradingeconomics.com${linkPath.startsWith("/") ? "" : "/"}${linkPath}`
                    : undefined;

                const imp = Number(r.Importance ?? r.importance);
                const importance = imp === 1 || imp === 2 || imp === 3 ? (imp as 1 | 2 | 3) : undefined;

                const currency = r.Currency
                    ? String(r.Currency).toUpperCase()
                    : inferCurrencyFromCountry(r.Country ? String(r.Country) : undefined);

                return {
                    id,
                    date,
                    country: r.Country ? String(r.Country) : undefined,
                    currency,
                    ...normalizeCalendarLabels({
                        category: r.Category ? String(r.Category) : undefined,
                        event: r.Event ? String(r.Event) : undefined,
                    }),
                    importance,
                    actual: r.Actual !== undefined && r.Actual !== null ? String(r.Actual) : undefined,
                    previous: r.Previous !== undefined && r.Previous !== null ? String(r.Previous) : undefined,
                    forecast: r.Forecast !== undefined && r.Forecast !== null ? String(r.Forecast) : undefined,
                    unit: r.Unit ? String(r.Unit) : undefined,
                    source: r.Source ? String(r.Source) : undefined,
                    link,
                };
            })
            .filter((e) => !!e.date)
        : [];

    let filteredEvents = events;
    if (config.calendarFfStrict) {
        filteredEvents = filteredEvents
            .filter((e) => isAllowedCurrency(e))
            .filter((e) => !isExcludedByKeywords(e));
    }

    // ForexFactory-style: chronological order.
    filteredEvents.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

    cache.set(cacheKey, { fetchedAt: now, events: filteredEvents });
    return filteredEvents;
}

export async function getCalendarToday(req: Request & { userId?: string }, res: Response) {
    try {
        const q = GetCalendarTodayQuery.parse(req.query);
        const importance = q.importance as 1 | 2 | 3 | undefined;

        const events = await fetchTradingEconomicsToday(importance);
        const filtered = events.filter((e) => {
            if (!q.currency) return true;
            return String(e.currency || "").toUpperCase() === q.currency;
        });

        const safeForDisplay = withActualHiddenForFuture(filtered);

        return res.json({
            ok: true,
            source: "tradingeconomics",
            auth: config.tradingEconomicsApiKey ? "api-key" : "guest:guest",
            date: ymdInTimeZone(new Date(), config.calendarTimeZone || "Asia/Kolkata"),
            events: safeForDisplay,
        });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to fetch calendar", detail: err?.message || String(err) });
    }
}

export async function analyzeCalendarImpact(req: Request & { userId?: string }, res: Response) {
    try {
        const body = AnalyzeCalendarBody.parse(req.body);

        const focusCurrency = body.currency;
        const focusPair = normalizePair(body.pair);

        const focus = {
            currency: focusCurrency || undefined,
            pair: focusPair || undefined,
        };

        const events = body.events
            .slice()
            .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
            .slice(0, 120)
            .map((e) => ({
                date: e.date,
                country: e.country,
                currency: e.currency ? String(e.currency).toUpperCase() : undefined,
                event: e.event,
                category: e.category,
                importance: e.importance,
                actual: e.actual,
                forecast: e.forecast,
                previous: e.previous,
                unit: e.unit,
            }));

        const openai = getOpenAIClient();

        const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            temperature: 0.2,
            // Some models don't support JSON mode - remove it for compatibility
            // response_format: { type: "json_object" } as any,
            messages: [
                {
                    role: "system",
                    content:
                        "You are an FX economic-calendar analyst. You MUST NOT provide buy/sell signals, entries, exits, or price targets. Output JSON only.",
                },
                {
                    role: "user",
                    content:
                        "Analyze today's economic calendar events and infer impact on FX currencies. " +
                        "Use Actual vs Forecast/Previous when available. " +
                        "Short-term is 1-3 days, long-term is 2-8 weeks. " +
                        "If focus currency/pair is provided, emphasize that. " +
                        "IMPORTANT: Use ONLY these exact enum values:\n" +
                        "- impact: must be 'supportive', 'negative', 'neutral', or 'mixed' (NOT 'positive')\n" +
                        "- bias: must be 'bullish', 'bearish', 'neutral', or 'mixed' (NOT other values)\n" +
                        "Return STRICT JSON ONLY matching this schema: " +
                        JSON.stringify({
                            focus: { currency: "USD", pair: "EURUSD" },
                            summary: "Overall impact summary...",
                            impactedCurrencies: ["USD", "EUR"],
                            currencyImpacts: [
                                { currency: "USD", impact: "supportive", reasons: ["..."] },
                                { currency: "EUR", impact: "neutral", reasons: ["..."] },
                            ],
                            shortTerm: { bias: "bullish", confidence: 0.45, reasons: ["...", "..."] },
                            longTerm: { bias: "mixed", confidence: 0.35, reasons: ["...", "..."] },
                            keyEvents: ["..."],
                            keyRisks: ["..."],
                        }) +
                        "\n\nInput:\n" +
                        JSON.stringify({ focus, events }),
                },
            ],
        });

        const content = completion.choices?.[0]?.message?.content || "{}";
        console.log("Calendar AI raw response:", content.substring(0, 500));

        // Strip markdown code blocks if present (e.g., ```json ... ```)
        const cleanContent = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        const parsed = (() => {
            try {
                return JSON.parse(cleanContent);
            } catch {
                console.error("Failed to parse calendar AI response as JSON");
                return { raw: String(content || "").trim() };
            }
        })();

        const validated = CalendarImpactResult.safeParse(parsed);
        if (!validated.success) {
            console.error("Calendar AI validation failed:", validated.error.flatten());
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
        return res.status(500).json({ error: "Failed to analyze calendar", detail: err?.message || String(err) });
    }
}
