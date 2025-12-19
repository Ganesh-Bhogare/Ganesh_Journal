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

export const tradeSchema = z.object({
    // Basic info
    date: z.string(), // ISO date
    instrument: z.string().min(1),
    direction: z.enum(["long", "short"]),

    // ICT pre-trade
    session: z.enum(["Asia", "London", "New York"]).optional(),
    killzone: z.enum(["London Open", "NY AM", "NY PM"]).optional(),
    weeklyBias: z.enum(["Bullish", "Bearish", "Range"]).optional(),
    dailyBias: z.enum(["Bullish", "Bearish", "Range"]).optional(),
    drawOnLiquidity: z.enum(["Buy-side", "Sell-side"]).optional(),
    isPremiumDiscount: z.boolean().optional(),

    // ICT setup
    setupType: z.enum([
        "FVG",
        "Order Block",
        "Liquidity Sweep + MSS",
        "Judas Swing",
        "Power of 3 (AMD)",
        "Breaker Block",
    ]).optional(),
    pdArrays: z.array(z.string()).optional(),

    // Entry execution
    entryTime: z.string().optional(),
    entryTimeframe: z.string().min(1).optional(),
    entryConfirmation: z.enum(["MSS", "Displacement", "FVG Tap"]).optional(),
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
    emotionalState: z.enum(["Calm", "FOMO", "Revenge", "Hesitant"]).optional(),

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
    ltfConfirmationQuality: z.enum(["Strong", "Weak"]).optional(),

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
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TradeInput = z.infer<typeof tradeSchema>;
