import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const userPreferencesSchema = z.object({
    theme: z.enum(["dark", "light"]).optional(),

    // Legacy
    riskPerTrade: z.coerce.number().positive().optional(),

    // Sizing
    accountBalance: z.coerce.number().positive().optional(),
    riskMode: z.enum(["percent", "fixed"]).optional(),
    riskPercent: z.coerce.number().positive().optional(),
    riskAmount: z.coerce.number().positive().optional(),
    pipValuePerLot: z.coerce.number().positive().optional(),

    // Guardrails
    maxDailyLossAmount: z.coerce.number().positive().optional(),
    maxDailyLossPercent: z.coerce.number().positive().optional(),
    maxTradesPerDay: z.coerce.number().int().positive().optional(),
    stopAfterLosses: z.coerce.number().int().positive().optional(),
    enforcement: z.enum(["warn", "block"]).optional(),

    // Funded account bridge (read-only)
    fundedReadOnlyEnabled: z.boolean().optional(),
    fundedProvider: z.string().min(1).max(80).optional(),
    fundedTerminalType: z.enum(["mt4", "mt5", "other"]).optional(),
    fundedAccountId: z.string().min(1).max(80).optional(),
    fundedServer: z.string().min(1).max(120).optional(),
    fundedExecutionEnabled: z.boolean().optional(),
});

export const tradeSchema = z.object({
    // Basic info
    date: z.string(), // ISO date
    market: z.string().min(1).optional(),
    instrument: z.string().min(1),
    direction: z.enum(["long", "short"]),

    // ICT pre-trade
    session: z.string().optional(),
    killzone: z.string().optional(),
    weeklyBias: z.string().optional(),
    dailyBias: z.string().optional(),
    drawOnLiquidity: z.string().optional(),
    isPremiumDiscount: z.boolean().optional(),

    // ICT setup
    setupType: z.string().optional(),
    strategyName: z.string().optional(),
    pdArrays: z.array(z.string()).optional(),

    // Entry execution
    entryTime: z.string().optional(),
    entryTimeframe: z.string().min(1).optional(),
    entryConfirmation: z.string().optional(),
    entryPrice: z.coerce.number().positive(),
    stopLoss: z.coerce.number().positive().optional(),
    takeProfit: z.coerce.number().positive().optional(),
    riskPerTrade: z.coerce.number().positive().optional(),

    // Optional auto-calculated/manual sizing
    lotSize: z.coerce.number().positive().optional(),
    riskInDollars: z.coerce.number().positive().optional(),

    // Exit
    exitPrice: z.coerce.number().positive().optional(),
    exitTime: z.string().optional(),

    // Management
    partialTaken: z.boolean().optional(),
    slMovedToBE: z.boolean().optional(),
    emotionalState: z.string().optional(),

    // Post trade
    outcome: z.enum(["win", "loss", "breakeven"]).optional(),
    rMultiple: z.coerce.number().optional(),
    rr: z.coerce.number().optional(),
    pnl: z.coerce.number().optional(),

    // Extra execution metrics (manual)
    mae: z.coerce.number().optional(),
    mfe: z.coerce.number().optional(),

    // Plan context (manual)
    htfLevelUsed: z.string().optional(),
    ltfConfirmationQuality: z.string().optional(),

    // Rule evaluation
    followedHTFBias: z.boolean().optional(),
    correctSession: z.boolean().optional(),
    validPDArray: z.boolean().optional(),
    riskRespected: z.boolean().optional(),
    noEarlyExit: z.boolean().optional(),

    // Notes + legacy
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    timeframe: z.string().optional(),

    // Live chart config
    chartConfig: z.object({
        symbol: z.string().min(1).optional(),
        timeframe: z.string().min(1).optional(),
        timeframes: z.array(z.string().min(1)).optional(),
    }).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TradeInput = z.infer<typeof tradeSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
