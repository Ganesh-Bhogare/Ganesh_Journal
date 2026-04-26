import { Request, Response } from "express";
import { z } from "zod";
import { config } from "../config";

type MomentumSignal = "bullish" | "bearish" | "neutral";

type YahooQuote = {
    symbol?: string;
    shortName?: string;
    longName?: string;
    fullExchangeName?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    regularMarketVolume?: number;
    averageDailyVolume3Month?: number;
    marketState?: string;
};

type IntradayStats = {
    symbol: string;
    currentPrice: number;
    previousPrice: number;
    priceChangePercent: number;
    volumeRatio: number;
    previousHigh: number;
    previousLow: number;
    rsi14: number | null;
    vwap: number | null;
    gapPercent: number | null;
    sessionChangePercent: number | null;
    sessionVolumeRatio: number | null;
    signalAt: string;
    momentumFromAt: string;
};

type MomentumStock = {
    symbol: string;
    tradingViewSymbol: string;
    name: string;
    exchange: string;
    price: number;
    changePercent: number;
    volumeRatio: number;
    momentumScore: number;
    previousHigh: number;
    previousLow: number;
    rsi14: number | null;
    vwap: number | null;
    gapPercent: number | null;
    sessionChangePercent: number | null;
    sessionVolumeRatio: number | null;
    signalAt: string;
    momentumFromAt: string;
    signal: MomentumSignal;
    reasons: string[];
};

type MomentumRules = {
    lookbackMinutes: number;
    momentumPercent: number;
    volumeRatio: number;
    breakoutFilter: "previous-high-low";
    strictMode: boolean;
    relaxedMode: boolean;
    rvolThreshold: number;
    rsiBullishThreshold: number;
    rsiBearishThreshold: number;
    gapPercentThreshold: number;
};

type MomentumPayload = {
    ok: true;
    asOf: string;
    universeCount: number;
    bullish: MomentumStock[];
    bearish: MomentumStock[];
    neutralCount: number;
    marketState: string;
    signalSource: "live" | "previous-session";
    rules: MomentumRules;
};

const DEFAULT_INDIAN_SYMBOLS = [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "ICICIBANK.NS",
    "INFY.NS",
    "SBIN.NS",
    "LT.NS",
    "AXISBANK.NS",
    "KOTAKBANK.NS",
    "BHARTIARTL.NS",
    "ITC.NS",
    "HCLTECH.NS",
    "SUNPHARMA.NS",
    "MARUTI.NS",
    "M&M.NS",
    "TATAMOTORS.NS",
    "ADANIENT.NS",
    "ADANIPORTS.NS",
    "WIPRO.NS",
    "POWERGRID.NS",
    "BAJFINANCE.NS",
    "ULTRACEMCO.NS",
    "NTPC.NS",
    "ONGC.NS",
    "COALINDIA.NS",
    "TITAN.NS",
    "ASIANPAINT.NS",
    "BAJAJFINSV.NS",
    "NESTLEIND.NS",
    "HINDUNILVR.NS",
];

const GetIndianMomentumQuery = z.object({
    limit: z.coerce.number().int().min(3).max(20).optional(),
    strict: z
        .preprocess((value) => {
            if (value === undefined || value === null || value === "") return undefined;
            if (typeof value === "boolean") return value;
            if (typeof value === "number") return value === 1;
            if (typeof value === "string") {
                const normalized = value.trim().toLowerCase();
                if (["1", "true", "yes", "on"].includes(normalized)) return true;
                if (["0", "false", "no", "off"].includes(normalized)) return false;
            }
            return false;
        }, z.boolean())
        .optional(),
    relaxed: z
        .preprocess((value) => {
            if (value === undefined || value === null || value === "") return undefined;
            if (typeof value === "boolean") return value;
            if (typeof value === "number") return value === 1;
            if (typeof value === "string") {
                const normalized = value.trim().toLowerCase();
                if (["1", "true", "yes", "on"].includes(normalized)) return true;
                if (["0", "false", "no", "off"].includes(normalized)) return false;
            }
            return false;
        }, z.boolean())
        .optional(),
});

const momentumCache = new Map<string, { fetchedAt: number; payload: MomentumPayload }>();
const INTRADAY_INTERVAL_MINUTES = 5;

function getIndianMarketState(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        weekday: "short",
    }).formatToParts(now);

    const weekday = String(parts.find((p) => p.type === "weekday")?.value || "").toLowerCase();
    if (weekday === "sat" || weekday === "sun") return "CLOSED";

    const hh = Number(parts.find((p) => p.type === "hour")?.value || "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value || "0");
    const totalMinutes = hh * 60 + mm;

    const preOpenStart = 9 * 60;
    const regularStart = 9 * 60 + 15;
    const regularEnd = 15 * 60 + 30;

    if (totalMinutes >= regularStart && totalMinutes <= regularEnd) return "REGULAR";
    if (totalMinutes >= preOpenStart && totalMinutes < regularStart) return "PRE";
    return "POST";
}

function toFiniteNumber(value: unknown): number | null {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
}

function toDisplayName(symbol: string, quote: YahooQuote) {
    const name = String(quote.longName || quote.shortName || "").trim();
    if (name) return name;
    return symbol.replace(/\.NS$/i, "").replace(/\.BO$/i, "");
}

function toTradingViewSymbol(rawSymbol: string) {
    const symbol = String(rawSymbol || "").trim().toUpperCase();
    if (!symbol) return "NSE:NIFTY";
    if (symbol.includes(":")) return symbol;

    if (symbol.endsWith(".NS")) return `NSE:${symbol.replace(/\.NS$/i, "")}`;
    if (symbol.endsWith(".BO")) return `BSE:${symbol.replace(/\.BO$/i, "")}`;

    return `NSE:${symbol.replace(/\.[A-Z]+$/i, "")}`;
}

function round2(value: number) {
    return Math.round(value * 100) / 100;
}

function round2Nullable(value: number | null) {
    return value == null ? null : round2(value);
}

function getPositiveNumber(value: number, fallback: number) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getDayKey(tsMs: number, timeZone: string) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date(tsMs));
}

function computeRsi(closes: number[], period = 14): number | null {
    if (closes.length <= period) return null;

    let gains = 0;
    let losses = 0;
    const start = closes.length - period;

    for (let i = start; i < closes.length; i++) {
        const delta = closes[i] - closes[i - 1];
        if (delta > 0) gains += delta;
        else losses += Math.abs(delta);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function computeVwap(bars: Array<{ high: number; low: number; close: number; volume: number }>) {
    let cumulativePV = 0;
    let cumulativeVol = 0;

    for (const bar of bars) {
        if (!Number.isFinite(bar.volume) || bar.volume <= 0) continue;
        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        cumulativePV += typicalPrice * bar.volume;
        cumulativeVol += bar.volume;
    }

    if (cumulativeVol <= 0) return null;
    return cumulativePV / cumulativeVol;
}

async function fetchYahooIntradayStats(symbol: string, lookbackBars: number, baselineBars: number) {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    url.searchParams.set("interval", "5m");
    url.searchParams.set("range", "2d");
    url.searchParams.set("includePrePost", "false");

    const response = await fetch(url.toString(), {
        headers: {
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 (compatible; TradeJournalMomentumBot/1.0)",
        },
    });

    if (!response.ok) {
        throw new Error(`Intraday request failed (${response.status}) for ${symbol}`);
    }

    const payload = (await response.json()) as {
        chart?: {
            result?: Array<{
                timestamp?: Array<number | null>;
                meta?: {
                    exchangeTimezoneName?: string;
                };
                indicators?: {
                    quote?: Array<{
                        open?: Array<number | null>;
                        close?: Array<number | null>;
                        high?: Array<number | null>;
                        low?: Array<number | null>;
                        volume?: Array<number | null>;
                    }>;
                };
            }>;
        };
    };

    const result = payload?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp || [];
    const opens = quote?.open || [];
    const closes = quote?.close || [];
    const highs = quote?.high || [];
    const lows = quote?.low || [];
    const volumes = quote?.volume || [];

    const bars: Array<{ tsMs: number; open: number; close: number; high: number; low: number; volume: number }> = [];
    const maxLen = Math.max(timestamps.length, opens.length, closes.length, highs.length, lows.length, volumes.length);
    for (let i = 0; i < maxLen; i++) {
        const tsSec = toFiniteNumber(timestamps[i]);
        if (tsSec == null) continue;

        const tsMs = Math.round(tsSec * 1000);
        const close = toFiniteNumber(closes[i]);
        const high = toFiniteNumber(highs[i]);
        const low = toFiniteNumber(lows[i]);
        const volume = toFiniteNumber(volumes[i]) ?? 0;
        if (close == null || high == null || low == null) continue;

        const open = toFiniteNumber(opens[i]) ?? close;
        bars.push({ tsMs, open, close, high, low, volume: Math.max(0, volume) });
    }

    bars.sort((a, b) => a.tsMs - b.tsMs);

    const minBars = lookbackBars + 2;
    if (bars.length < minBars) return null;

    const lastIndex = bars.length - 1;
    const current = bars[lastIndex];
    const previous = bars[lastIndex - lookbackBars];
    if (!previous || previous.close <= 0) return null;

    const priorBars = bars.slice(0, lastIndex);
    if (priorBars.length === 0) return null;

    const previousHigh = Math.max(...priorBars.map((b) => b.high));
    const previousLow = Math.min(...priorBars.map((b) => b.low));

    const currentWindow = bars.slice(Math.max(0, bars.length - lookbackBars));
    const currentVolume = currentWindow.reduce((sum, b) => sum + b.volume, 0);

    const baselineEnd = Math.max(0, bars.length - lookbackBars);
    const baselineStart = Math.max(0, baselineEnd - baselineBars);
    const baselineWindow = bars.slice(baselineStart, baselineEnd);
    const baselineAvgPerBar = baselineWindow.length > 0
        ? baselineWindow.reduce((sum, b) => sum + b.volume, 0) / baselineWindow.length
        : 0;
    const baselineWindowVolume = baselineAvgPerBar * currentWindow.length;
    const volumeRatio = baselineWindowVolume > 0 ? currentVolume / baselineWindowVolume : 1;

    const priceChangePercent = ((current.close - previous.close) / previous.close) * 100;

    const exchangeTimeZone = String(result?.meta?.exchangeTimezoneName || "Asia/Kolkata");
    const currentDayKey = getDayKey(current.tsMs, exchangeTimeZone);
    const currentDayBars = bars.filter((b) => getDayKey(b.tsMs, exchangeTimeZone) === currentDayKey);
    if (!currentDayBars.length) return null;

    const dayKeys = Array.from(new Set(bars.map((b) => getDayKey(b.tsMs, exchangeTimeZone))));
    const previousDayKey = dayKeys.length >= 2 ? dayKeys[dayKeys.length - 2] : null;
    const previousDayBars = previousDayKey
        ? bars.filter((b) => getDayKey(b.tsMs, exchangeTimeZone) === previousDayKey)
        : [];

    const currentDayStartIndex = bars.findIndex((b) => getDayKey(b.tsMs, exchangeTimeZone) === currentDayKey);
    const previousSessionClose = currentDayStartIndex > 0 ? bars[currentDayStartIndex - 1].close : null;
    const dayOpen = currentDayBars[0].open;
    const gapPercent = previousSessionClose != null && previousSessionClose > 0
        ? ((dayOpen - previousSessionClose) / previousSessionClose) * 100
        : null;

    const dayClose = currentDayBars[currentDayBars.length - 1].close;
    const dayVolume = currentDayBars.reduce((sum, b) => sum + b.volume, 0);
    const previousDayVolume = previousDayBars.reduce((sum, b) => sum + b.volume, 0);
    const sessionChangePercent = dayOpen > 0 ? ((dayClose - dayOpen) / dayOpen) * 100 : null;
    const sessionVolumeRatio = previousDayVolume > 0 ? dayVolume / previousDayVolume : null;

    const rsi14 = computeRsi(bars.map((b) => b.close), 14);
    const vwap = computeVwap(currentDayBars);

    return {
        symbol,
        currentPrice: current.close,
        previousPrice: previous.close,
        priceChangePercent,
        volumeRatio,
        previousHigh,
        previousLow,
        rsi14,
        vwap,
        gapPercent,
        sessionChangePercent,
        sessionVolumeRatio,
        signalAt: new Date(current.tsMs).toISOString(),
        momentumFromAt: new Date(previous.tsMs).toISOString(),
    } as IntradayStats;
}

async function fetchYahooQuotes(symbols: string[]) {
    const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
    url.searchParams.set("symbols", symbols.join(","));

    const response = await fetch(url.toString(), {
        headers: {
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 (compatible; TradeJournalMomentumBot/1.0)",
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Market feed request failed (${response.status}): ${body.slice(0, 180)}`);
    }

    const payload = (await response.json()) as {
        quoteResponse?: {
            result?: YahooQuote[];
        };
    };

    const quotes = payload?.quoteResponse?.result;
    return Array.isArray(quotes) ? quotes : [];
}

function computeSignalStock(
    symbol: string,
    quote: YahooQuote | undefined,
    stats: IntradayStats,
    rules: MomentumRules
): MomentumStock {
    const marketPrice = toFiniteNumber(quote?.regularMarketPrice) ?? stats.currentPrice;
    const name = toDisplayName(symbol, quote || {});
    const liveMomentumThreshold = rules.relaxedMode ? Math.min(rules.momentumPercent, 1) : rules.momentumPercent;
    const liveVolumeThreshold = rules.relaxedMode ? Math.min(rules.volumeRatio, 1.2) : rules.volumeRatio;

    const bullish =
        stats.priceChangePercent >= liveMomentumThreshold &&
        stats.volumeRatio >= liveVolumeThreshold &&
        marketPrice > stats.previousHigh &&
        (
            !rules.strictMode || (
                stats.volumeRatio >= rules.rvolThreshold &&
                stats.rsi14 != null &&
                stats.rsi14 >= rules.rsiBullishThreshold &&
                stats.vwap != null &&
                marketPrice > stats.vwap &&
                stats.gapPercent != null &&
                stats.gapPercent >= rules.gapPercentThreshold
            )
        );

    const bearish =
        stats.priceChangePercent <= -liveMomentumThreshold &&
        stats.volumeRatio >= liveVolumeThreshold &&
        marketPrice < stats.previousLow &&
        (
            !rules.strictMode || (
                stats.volumeRatio >= rules.rvolThreshold &&
                stats.rsi14 != null &&
                stats.rsi14 <= rules.rsiBearishThreshold &&
                stats.vwap != null &&
                marketPrice < stats.vwap &&
                stats.gapPercent != null &&
                stats.gapPercent <= -rules.gapPercentThreshold
            )
        );

    const signal: MomentumSignal = bullish ? "bullish" : bearish ? "bearish" : "neutral";

    let momentumScore = 0;
    const reasons: string[] = [];

    if (bullish) {
        const breakoutEdge = ((marketPrice - stats.previousHigh) / Math.max(stats.previousHigh, 0.01)) * 100;
        momentumScore =
            (stats.priceChangePercent / liveMomentumThreshold) +
            (stats.volumeRatio / liveVolumeThreshold) +
            Math.max(0, breakoutEdge);

        if (rules.strictMode) {
            momentumScore +=
                (stats.volumeRatio / rules.rvolThreshold) +
                (((stats.rsi14 ?? rules.rsiBullishThreshold) - rules.rsiBullishThreshold) / 10) +
                (((stats.gapPercent ?? rules.gapPercentThreshold) - rules.gapPercentThreshold) / 2);
        }

        reasons.push(`Momentum +${stats.priceChangePercent.toFixed(2)}% in ${rules.lookbackMinutes}m`);
        reasons.push(`Volume ${stats.volumeRatio.toFixed(2)}x vs avg`);
        reasons.push(`Breakout above ${stats.previousHigh.toFixed(2)}`);
        if (rules.relaxedMode) {
            reasons.push("Relaxed thresholds enabled");
        }

        if (rules.strictMode) {
            reasons.push(`RSI ${Number(stats.rsi14).toFixed(1)} | Price > VWAP ${Number(stats.vwap).toFixed(2)}`);
            reasons.push(`Gap up ${Number(stats.gapPercent).toFixed(2)}%`);
        }
    } else if (bearish) {
        const breakdownEdge = ((stats.previousLow - marketPrice) / Math.max(stats.previousLow, 0.01)) * 100;
        momentumScore = -(
            (Math.abs(stats.priceChangePercent) / liveMomentumThreshold) +
            (stats.volumeRatio / liveVolumeThreshold) +
            Math.max(0, breakdownEdge)
        );

        if (rules.strictMode) {
            momentumScore -=
                (stats.volumeRatio / rules.rvolThreshold) +
                ((rules.rsiBearishThreshold - (stats.rsi14 ?? rules.rsiBearishThreshold)) / 10) +
                ((Math.abs(stats.gapPercent ?? -rules.gapPercentThreshold) - rules.gapPercentThreshold) / 2);
        }

        reasons.push(`Momentum ${stats.priceChangePercent.toFixed(2)}% in ${rules.lookbackMinutes}m`);
        reasons.push(`Volume ${stats.volumeRatio.toFixed(2)}x vs avg`);
        reasons.push(`Breakdown below ${stats.previousLow.toFixed(2)}`);
        if (rules.relaxedMode) {
            reasons.push("Relaxed thresholds enabled");
        }

        if (rules.strictMode) {
            reasons.push(`RSI ${Number(stats.rsi14).toFixed(1)} | Price < VWAP ${Number(stats.vwap).toFixed(2)}`);
            reasons.push(`Gap down ${Number(stats.gapPercent).toFixed(2)}%`);
        }
    }

    return {
        symbol,
        tradingViewSymbol: toTradingViewSymbol(symbol),
        name,
        exchange: String(quote?.fullExchangeName || "NSE").trim() || "NSE",
        price: round2(marketPrice),
        changePercent: round2(stats.priceChangePercent),
        volumeRatio: round2(stats.volumeRatio),
        momentumScore: round2(momentumScore),
        previousHigh: round2(stats.previousHigh),
        previousLow: round2(stats.previousLow),
        rsi14: round2Nullable(stats.rsi14),
        vwap: round2Nullable(stats.vwap),
        gapPercent: round2Nullable(stats.gapPercent),
        sessionChangePercent: round2Nullable(stats.sessionChangePercent),
        sessionVolumeRatio: round2Nullable(stats.sessionVolumeRatio),
        signalAt: stats.signalAt,
        momentumFromAt: stats.momentumFromAt,
        signal,
        reasons: reasons.slice(0, 5),
    };
}

function buildClosedSessionFallback(items: MomentumStock[], rules: MomentumRules, limit: number) {
    const sessionMomentumThreshold = rules.relaxedMode ? Math.min(rules.momentumPercent, 1) : rules.momentumPercent;
    const sessionVolumeThreshold = rules.relaxedMode ? Math.min(rules.volumeRatio, 1.2) : rules.volumeRatio;

    const bullishQualified = items
        .filter((item) =>
            (item.sessionChangePercent ?? 0) >= sessionMomentumThreshold &&
            (item.sessionVolumeRatio ?? 0) >= sessionVolumeThreshold
        )
        .sort((a, b) => (b.sessionChangePercent ?? -Infinity) - (a.sessionChangePercent ?? -Infinity));

    const bearishQualified = items
        .filter((item) =>
            (item.sessionChangePercent ?? 0) <= -sessionMomentumThreshold &&
            (item.sessionVolumeRatio ?? 0) >= sessionVolumeThreshold
        )
        .sort((a, b) => (a.sessionChangePercent ?? Infinity) - (b.sessionChangePercent ?? Infinity));

    const bullishPool = bullishQualified.length > 0
        ? bullishQualified
        : items
            .filter((item) => (item.sessionChangePercent ?? 0) > 0)
            .sort((a, b) => (b.sessionChangePercent ?? -Infinity) - (a.sessionChangePercent ?? -Infinity));

    const bearishPool = bearishQualified.length > 0
        ? bearishQualified
        : items
            .filter((item) => (item.sessionChangePercent ?? 0) < 0)
            .sort((a, b) => (a.sessionChangePercent ?? Infinity) - (b.sessionChangePercent ?? Infinity));

    const bullish = bullishPool.slice(0, limit).map((item) => ({
        ...item,
        signal: "bullish" as MomentumSignal,
        momentumScore: round2(Math.abs(item.sessionChangePercent ?? 0) + (item.sessionVolumeRatio ?? 0)),
        reasons: [
            `Previous session move +${Number(item.sessionChangePercent ?? 0).toFixed(2)}%`,
            `Session volume ${Number(item.sessionVolumeRatio ?? 0).toFixed(2)}x vs previous day`,
            rules.relaxedMode ? "Relaxed mode (closed-session ranking)" : "Closed-market ranking",
        ],
    }));

    const bearish = bearishPool.slice(0, limit).map((item) => ({
        ...item,
        signal: "bearish" as MomentumSignal,
        momentumScore: round2(-Math.abs(item.sessionChangePercent ?? 0) - (item.sessionVolumeRatio ?? 0)),
        reasons: [
            `Previous session move ${Number(item.sessionChangePercent ?? 0).toFixed(2)}%`,
            `Session volume ${Number(item.sessionVolumeRatio ?? 0).toFixed(2)}x vs previous day`,
            rules.relaxedMode ? "Relaxed mode (closed-session ranking)" : "Closed-market ranking",
        ],
    }));

    return { bullish, bearish };
}

export async function getIndianMomentum(req: Request & { userId?: string }, res: Response) {
    try {
        const q = GetIndianMomentumQuery.parse(req.query);
        const limit = q.limit ?? 8;
        const strictMode = q.strict ?? config.indianScreenerStrictDefault;
        const relaxedMode = q.relaxed ?? false;

        const rules: MomentumRules = {
            lookbackMinutes: getPositiveNumber(config.indianScreenerLookbackMinutes, 15),
            momentumPercent: getPositiveNumber(config.indianScreenerMomentumThreshold, 2),
            volumeRatio: getPositiveNumber(config.indianScreenerVolumeRatioThreshold, 1.5),
            breakoutFilter: "previous-high-low",
            strictMode,
            relaxedMode,
            rvolThreshold: getPositiveNumber(config.indianScreenerRvolThreshold, 2),
            rsiBullishThreshold: getPositiveNumber(config.indianScreenerRsiBullishThreshold, 60),
            rsiBearishThreshold: getPositiveNumber(config.indianScreenerRsiBearishThreshold, 40),
            gapPercentThreshold: getPositiveNumber(config.indianScreenerGapThresholdPercent, 2),
        };
        const lookbackBars = Math.max(1, Math.round(rules.lookbackMinutes / INTRADAY_INTERVAL_MINUTES));
        const baselineBars = Math.max(getPositiveNumber(config.indianScreenerBaselineBars, 24), lookbackBars * 4);

        const cacheKey = [
            rules.strictMode ? "strict" : "normal",
            rules.relaxedMode ? "relaxed" : "standard",
            rules.lookbackMinutes,
            rules.momentumPercent,
            rules.volumeRatio,
            rules.rvolThreshold,
            rules.rsiBullishThreshold,
            rules.rsiBearishThreshold,
            rules.gapPercentThreshold,
            baselineBars,
        ].join("|");

        const ttlMs = Math.max(20, config.indianScreenerCacheTtlSeconds) * 1000;
        const cached = momentumCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < ttlMs) {
            return res.json({
                ...cached.payload,
                bullish: cached.payload.bullish.slice(0, limit),
                bearish: cached.payload.bearish.slice(0, limit),
            });
        }

        const symbols = config.indianScreenerSymbols.length
            ? config.indianScreenerSymbols
            : DEFAULT_INDIAN_SYMBOLS;

        const [quotes, intradayStats] = await Promise.all([
            fetchYahooQuotes(symbols).catch((err) => {
                console.warn("Quote feed unavailable; continuing with intraday chart data only:", err?.message || err);
                return [] as YahooQuote[];
            }),
            Promise.allSettled(symbols.map((symbol) => fetchYahooIntradayStats(symbol, lookbackBars, baselineBars))),
        ]);

        const quoteMap = new Map<string, YahooQuote>();
        for (const quote of quotes) {
            const symbol = String(quote.symbol || "").trim().toUpperCase();
            if (symbol) quoteMap.set(symbol, quote);
        }

        const statsMap = new Map<string, IntradayStats>();
        intradayStats.forEach((result, idx) => {
            if (result.status !== "fulfilled" || !result.value) return;
            const symbol = symbols[idx]?.toUpperCase();
            if (symbol) statsMap.set(symbol, result.value);
        });

        const classified: MomentumStock[] = symbols
            .map((symbol) => symbol.toUpperCase())
            .map((symbol) => {
                const stats = statsMap.get(symbol);
                if (!stats) return null;
                return computeSignalStock(symbol, quoteMap.get(symbol), stats, rules);
            })
            .filter((item): item is MomentumStock => !!item);

        const bullish = classified
            .filter((item) => item.signal === "bullish")
            .sort((a, b) => {
                if (b.momentumScore !== a.momentumScore) return b.momentumScore - a.momentumScore;
                return b.changePercent - a.changePercent;
            });

        const bearish = classified
            .filter((item) => item.signal === "bearish")
            .sort((a, b) => {
                if (a.momentumScore !== b.momentumScore) return a.momentumScore - b.momentumScore;
                return a.changePercent - b.changePercent;
            });

        let finalBullish = bullish;
        let finalBearish = bearish;

        const neutralCount = classified.filter((item) => item.signal === "neutral").length;
        const marketState = String(quotes[0]?.marketState || getIndianMarketState()).toUpperCase();
        let signalSource: "live" | "previous-session" = "live";

        if (marketState === "CLOSED" && finalBullish.length + finalBearish.length === 0) {
            const fallback = buildClosedSessionFallback(classified, rules, limit);
            finalBullish = fallback.bullish;
            finalBearish = fallback.bearish;
            signalSource = "previous-session";
        }

        if (classified.length === 0) {
            return res.status(502).json({
                ok: false,
                error: "No intraday data available for screener symbols right now.",
            });
        }

        const payload: MomentumPayload = {
            ok: true,
            asOf: new Date().toISOString(),
            universeCount: classified.length,
            bullish: finalBullish,
            bearish: finalBearish,
            neutralCount,
            marketState,
            signalSource,
            rules,
        };

        momentumCache.set(cacheKey, { fetchedAt: Date.now(), payload });

        return res.json({
            ...payload,
            bullish: payload.bullish.slice(0, limit),
            bearish: payload.bearish.slice(0, limit),
        });
    } catch (err: any) {
        return res.status(502).json({
            ok: false,
            error: err?.message || "Unable to fetch Indian momentum screener right now.",
        });
    }
}
