import OpenAI from "openai";
import { config } from "../config";

export function getOpenAIClient() {
    if (!config.openaiApiKey) {
        throw new Error("OPENAI_API_KEY not configured on server");
    }

    const looksLikeOpenRouter = /^sk-or-/.test(config.openaiApiKey);
    if (looksLikeOpenRouter && !config.openaiBaseUrl) {
        throw new Error("OPENAI_BASE_URL is required for OpenRouter keys");
    }

    return new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl || undefined,
        defaultHeaders: {
            ...(config.openaiAppName ? { "X-Title": config.openaiAppName } : {}),
            ...(process.env.OPENAI_HTTP_REFERER ? { "HTTP-Referer": process.env.OPENAI_HTTP_REFERER } : {}),
        },
    });
}
