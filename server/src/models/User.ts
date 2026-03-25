import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    email: string;
    passwordHash: string;
    name?: string;
    preferences?: {
        theme?: "dark" | "light";
        // Legacy (kept for backwards compatibility)
        riskPerTrade?: number;

        // Risk sizing inputs
        accountBalance?: number;
        riskMode?: "percent" | "fixed";
        riskPercent?: number;
        riskAmount?: number;
        pipValuePerLot?: number;

        // Risk rules (guardrails)
        maxDailyLossAmount?: number;
        maxDailyLossPercent?: number;
        maxTradesPerDay?: number;
        stopAfterLosses?: number;

        // How strict to be
        enforcement?: "warn" | "block";

        // Funded account bridge (read-only)
        fundedReadOnlyEnabled?: boolean;
        fundedProvider?: string;
        fundedTerminalType?: "mt4" | "mt5" | "other";
        fundedAccountId?: string;
        fundedServer?: string;
        fundedExecutionEnabled?: boolean;
        fundedLiveOpenPositions?: Array<{
            ticket?: string;
            symbol?: string;
            direction?: "long" | "short";
            volume?: number;
            openPrice?: number;
            currentPrice?: number;
            unrealizedPnl?: number;
            sl?: number;
            tp?: number;
            openTime?: Date;
        }>;
        fundedLiveUpdatedAt?: Date;
    };
}

const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    preferences: {
        theme: { type: String, default: "dark" },
        riskPerTrade: { type: Number, default: 1 },

        accountBalance: { type: Number },
        riskMode: { type: String, enum: ["percent", "fixed"], default: "percent" },
        riskPercent: { type: Number, default: 1 },
        riskAmount: { type: Number },
        pipValuePerLot: { type: Number, default: 10 },

        maxDailyLossAmount: { type: Number },
        maxDailyLossPercent: { type: Number },
        maxTradesPerDay: { type: Number },
        stopAfterLosses: { type: Number },
        enforcement: { type: String, enum: ["warn", "block"], default: "block" },

        fundedReadOnlyEnabled: { type: Boolean, default: false },
        fundedProvider: { type: String },
        fundedTerminalType: { type: String, enum: ["mt4", "mt5", "other"], default: "mt5" },
        fundedAccountId: { type: String },
        fundedServer: { type: String },
        fundedExecutionEnabled: { type: Boolean, default: false },
        fundedLiveOpenPositions: [{
            ticket: { type: String },
            symbol: { type: String },
            direction: { type: String, enum: ["long", "short"] },
            volume: { type: Number },
            openPrice: { type: Number },
            currentPrice: { type: Number },
            unrealizedPnl: { type: Number },
            sl: { type: Number },
            tp: { type: Number },
            openTime: { type: Date },
        }],
        fundedLiveUpdatedAt: { type: Date },
    },
}, { timestamps: true });

export const User = mongoose.model<IUser>("User", UserSchema);
