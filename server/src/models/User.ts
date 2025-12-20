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
    },
}, { timestamps: true });

export const User = mongoose.model<IUser>("User", UserSchema);
