import mongoose, { Schema, Document } from "mongoose";

export type Direction = "long" | "short";
export type Session = "Asia" | "London" | "New York";
export type Killzone = "London Open" | "NY AM" | "NY PM";
export type HTFBias = "Bullish" | "Bearish" | "Range";
export type DrawOnLiquidity = "Buy-side" | "Sell-side";
export type SetupType = "FVG" | "Order Block" | "Liquidity Sweep + MSS" | "Judas Swing" | "Power of 3 (AMD)" | "Breaker Block";
export type EntryConfirmation = "MSS" | "Displacement" | "FVG Tap";
export type ConfirmationQuality = "Strong" | "Weak";
export type EmotionalState = "Calm" | "FOMO" | "Revenge" | "Hesitant";
export type Outcome = "win" | "loss" | "breakeven";

export interface ITrade extends Document {
    userId: mongoose.Types.ObjectId;

    // Basic Info
    date: Date;
    instrument: string;
    direction: Direction;

    // ICT Pre-Trade Analysis
    session?: Session;
    killzone?: Killzone;
    weeklyBias?: HTFBias;
    dailyBias?: HTFBias;
    drawOnLiquidity?: DrawOnLiquidity;
    isPremiumDiscount?: boolean;

    // ICT Setup (ONLY ONE ALLOWED)
    setupType?: SetupType;

    // PD Arrays Used (Multiple allowed)
    pdArrays?: string[]; // ["Daily High/Low", "Weekly High/Low", etc.]

    // Entry Execution
    entryTime?: Date;
    entryTimeframe?: string; // "1m", "3m", "5m"
    entryConfirmation?: EntryConfirmation;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    riskPerTrade?: number; // in $ or %

    // Auto-calculated
    lotSize?: number;
    riskInDollars?: number;

    // Exit Info
    exitPrice?: number;
    exitTime?: Date;

    // Trade Management
    partialTaken?: boolean;
    slMovedToBE?: boolean;
    emotionalState?: EmotionalState;

    // Post-Trade Review
    outcome?: Outcome;
    rMultiple?: number;

    // Extra execution metrics (manual)
    mae?: number;
    mfe?: number;

    // Plan context (manual)
    htfLevelUsed?: string;
    ltfConfirmationQuality?: ConfirmationQuality;

    // Rule Evaluation
    followedHTFBias: boolean;
    correctSession: boolean;
    validPDArray: boolean;
    riskRespected: boolean;
    noEarlyExit: boolean;

    // Risk engine output (server-calculated)
    riskViolations?: string[];
    riskWarnings?: string[];

    // Auto-Classification
    tradeQuality?: "A+ Trade" | "Rule Break Trade" | "Standard Trade";
    ruleBreakCount?: number;

    // Screenshots
    htfScreenshot?: string;
    entryScreenshot?: string;
    postTradeScreenshot?: string;
    chartScreenshot?: string;

    // Notes
    notes?: string;

    // Legacy fields for backwards compatibility
    tags?: string[];
    timeframe?: string;
    pnl?: number;
    rr?: number;
}

const TradeSchema = new Schema<ITrade>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Basic Info
    date: { type: Date, required: true },
    instrument: { type: String, required: true },
    direction: { type: String, enum: ["long", "short"], required: true },

    // ICT Pre-Trade Analysis
    session: { type: String, enum: ["Asia", "London", "New York"], default: "London" },
    killzone: { type: String, enum: ["London Open", "NY AM", "NY PM"] },
    weeklyBias: { type: String, enum: ["Bullish", "Bearish", "Range"], default: "Range" },
    dailyBias: { type: String, enum: ["Bullish", "Bearish", "Range"], default: "Range" },
    drawOnLiquidity: { type: String, enum: ["Buy-side", "Sell-side"], default: "Buy-side" },
    isPremiumDiscount: { type: Boolean, default: false },

    // ICT Setup
    setupType: {
        type: String,
        enum: ["FVG", "Order Block", "Liquidity Sweep + MSS", "Judas Swing", "Power of 3 (AMD)", "Breaker Block"],
        default: "FVG"
    },

    // PD Arrays
    pdArrays: [{ type: String }],

    // Entry Execution
    entryTime: { type: Date, default: function (this: any) { return this.date || new Date(); } },
    entryTimeframe: { type: String, default: "5m" },
    entryConfirmation: { type: String, enum: ["MSS", "Displacement", "FVG Tap"], default: "MSS" },
    entryPrice: { type: Number, required: true },
    stopLoss: { type: Number },
    takeProfit: { type: Number },
    riskPerTrade: { type: Number, default: 0 },

    // Auto-calculated
    lotSize: { type: Number },
    riskInDollars: { type: Number },

    // Exit Info
    exitPrice: { type: Number },
    exitTime: { type: Date },

    // Trade Management
    partialTaken: { type: Boolean, default: false },
    slMovedToBE: { type: Boolean, default: false },
    emotionalState: { type: String, enum: ["Calm", "FOMO", "Revenge", "Hesitant"], default: "Calm" },

    // Post-Trade Review
    outcome: { type: String, enum: ["win", "loss", "breakeven"] },
    rMultiple: { type: Number },

    // Extra execution metrics (manual)
    mae: { type: Number },
    mfe: { type: Number },

    // Plan context (manual)
    htfLevelUsed: { type: String },
    ltfConfirmationQuality: { type: String, enum: ["Strong", "Weak"] },

    // Rule Evaluation
    followedHTFBias: { type: Boolean, default: true },
    correctSession: { type: Boolean, default: true },
    validPDArray: { type: Boolean, default: true },
    riskRespected: { type: Boolean, default: true },
    noEarlyExit: { type: Boolean, default: true },

    // Risk engine output
    riskViolations: [{ type: String }],
    riskWarnings: [{ type: String }],

    // Auto-Classification
    tradeQuality: { type: String, enum: ["A+ Trade", "Rule Break Trade", "Standard Trade"] },
    ruleBreakCount: { type: Number, default: 0 },

    // Screenshots
    htfScreenshot: { type: String },
    entryScreenshot: { type: String },
    postTradeScreenshot: { type: String },
    chartScreenshot: { type: String },

    // Notes
    notes: { type: String },

    // Legacy fields
    tags: [{ type: String }],
    timeframe: { type: String },
    pnl: { type: Number },
    rr: { type: Number },
}, { timestamps: true });

// Pre-save middleware to calculate trade metrics
TradeSchema.pre('save', function (next) {
    const trade = this;

    // Calculate R-Multiple if trade is closed
    if (trade.exitPrice && trade.entryPrice && trade.stopLoss) {
        const risk = Math.abs(trade.entryPrice - trade.stopLoss);
        const reward = Math.abs(trade.exitPrice - trade.entryPrice);

        if (trade.direction === 'long') {
            trade.rMultiple = trade.exitPrice > trade.entryPrice ? reward / risk : -(reward / risk);
        } else {
            trade.rMultiple = trade.exitPrice < trade.entryPrice ? reward / risk : -(reward / risk);
        }

        // Determine outcome
        if (Math.abs(trade.rMultiple) < 0.1) {
            trade.outcome = 'breakeven';
        } else if (trade.rMultiple > 0) {
            trade.outcome = 'win';
        } else {
            trade.outcome = 'loss';
        }
    }

    // Count rule breaks
    let ruleBreaks = 0;
    if (!trade.followedHTFBias) ruleBreaks++;
    if (!trade.correctSession) ruleBreaks++;
    if (!trade.validPDArray) ruleBreaks++;
    if (!trade.riskRespected) ruleBreaks++;
    if (!trade.noEarlyExit) ruleBreaks++;

    trade.ruleBreakCount = ruleBreaks;

    // Classify trade quality
    if (ruleBreaks === 0 && trade.outcome === 'win') {
        trade.tradeQuality = 'A+ Trade';
    } else if (ruleBreaks >= 2) {
        trade.tradeQuality = 'Rule Break Trade';
    } else {
        trade.tradeQuality = 'Standard Trade';
    }

    // Calculate P&L if we have lot size and it's closed (only if pnl not already set)
    if ((trade.pnl === undefined || trade.pnl === null) && trade.exitPrice && trade.lotSize) {
        const pips = Math.abs(trade.exitPrice - trade.entryPrice) * 10000; // for forex pairs
        const multiplier = trade.direction === 'long' ?
            (trade.exitPrice > trade.entryPrice ? 1 : -1) :
            (trade.exitPrice < trade.entryPrice ? 1 : -1);

        trade.pnl = (pips * trade.lotSize * 10) * multiplier;
    }

    next();
});

export const Trade = mongoose.model<ITrade>("Trade", TradeSchema);
