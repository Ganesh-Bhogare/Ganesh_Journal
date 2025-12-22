import dotenv from "dotenv";
import path from "path";

// Load env from the process working directory first (monorepo root),
// then fall back to the server workspace .env (server/.env).
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const config = {
    port: parseInt(process.env.PORT || "4000", 10),
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/ganesh_journal",
    jwtSecret: process.env.JWT_SECRET || "change-me",
    uploadDir: process.env.UPLOAD_DIR || "uploads",
    uploadDirAbs: "",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "",
    openaiAppName: process.env.OPENAI_APP_NAME || "",

    // Economic calendar (TradingEconomics)
    // Free option: leave blank to use the public guest key shown in their docs.
    tradingEconomicsApiKey: process.env.TRADING_ECONOMICS_API_KEY || "",
    tradingEconomicsBaseUrl: process.env.TRADING_ECONOMICS_BASE_URL || "https://api.tradingeconomics.com",
    calendarCacheTtlSeconds: parseInt(process.env.CALENDAR_CACHE_TTL_SECONDS || "180", 10),
    // Calendar timezone used to determine what "today" means.
    // Display formatting is handled on the frontend, but the backend needs this
    // to fetch the correct date window around midnight.
    calendarTimeZone: process.env.CALENDAR_TIMEZONE || "Asia/Kolkata",

    // ForexFactory-style strict filtering (best-effort, not an official FF match)
    // When enabled, the server will drop non-core events (e.g., auctions/speeches)
    // and non-target currencies to reduce "extra" items.
    calendarFfStrict: /^(1|true|yes)$/i.test(process.env.CALENDAR_FF_STRICT || ""),
    calendarAllowedCurrencies: (process.env.CALENDAR_ALLOWED_CURRENCIES || "USD,EUR,GBP,JPY,AUD,NZD,CAD,CHF,CNY")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    calendarExcludeKeywords: (process.env.CALENDAR_EXCLUDE_KEYWORDS || "speech,auction")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),

    // News (RSS) configuration
    // Comma-separated list of RSS/Atom feed URLs.
    // Example:
    // NEWS_FEEDS=https://www.forexlive.com/feed/,https://www.marketwatch.com/rss/topstories
    newsFeeds: (process.env.NEWS_FEEDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    newsCacheTtlSeconds: parseInt(process.env.NEWS_CACHE_TTL_SECONDS || "180", 10),
    newsDefaultLimit: parseInt(process.env.NEWS_DEFAULT_LIMIT || "200", 10),
    newsMaxLimit: parseInt(process.env.NEWS_MAX_LIMIT || "500", 10),
};

// Resolve upload directory relative to the server workspace (stable across environments)
const serverWorkspaceRoot = path.resolve(__dirname, "..");
config.uploadDirAbs = path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.resolve(serverWorkspaceRoot, config.uploadDir);
