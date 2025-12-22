type Normalized = {
    category?: string;
    event?: string;
};

// A small, high-impact mapping to make TradingEconomics labels feel closer to ForexFactory.
// This is intentionally conservative to avoid incorrect renames.
const EXACT_EVENT_MAP: Record<string, string> = {
    "NON FARM PAYROLLS": "Non-Farm Employment Change",
    "INFLATION RATE MOM": "CPI m/m",
    "INFLATION RATE YOY": "CPI y/y",
    "CORE INFLATION RATE MOM": "Core CPI m/m",
    "CORE INFLATION RATE YOY": "Core CPI y/y",
    "RETAIL SALES EX FOOD": "Core Retail Sales m/m",
    "RETAIL SALES MOM": "Retail Sales m/m",
    "FED INTEREST RATE DECISION": "FOMC Statement",
    "FOMC STATEMENT": "FOMC Statement",
    "MANUFACTURING PMI": "Flash Manufacturing PMI",
    "SERVICES PMI": "Flash Services PMI",
    "S&P GLOBAL MANUFACTURING PMI": "Flash Manufacturing PMI",
    "S&P GLOBAL SERVICES PMI": "Flash Services PMI",
};

function upper(s?: string) {
    return (s || "").trim().toUpperCase();
}

export function normalizeCalendarLabels(input: { category?: string; event?: string }): Normalized {
    const eventU = upper(input.event);
    const catU = upper(input.category);

    // Prefer mapping by event name.
    const mappedEvent = EXACT_EVENT_MAP[eventU];
    if (mappedEvent) return { ...input, event: mappedEvent };

    // Some feeds populate Category with the headline-ish name.
    const mappedFromCategory = EXACT_EVENT_MAP[catU];
    if (mappedFromCategory && !input.event) return { ...input, event: mappedFromCategory };

    return input;
}
