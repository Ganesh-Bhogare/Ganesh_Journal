import mongoose, { Document, Schema } from "mongoose";

export type TradeScreenshotKind = "htf" | "entry" | "postTrade" | "chart";

export interface ITradeScreenshot extends Document {
    tradeId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    kind: TradeScreenshotKind;
    mimeType: string;
    originalName?: string;
    data: Buffer;
}

const TradeScreenshotSchema = new Schema<ITradeScreenshot>({
    tradeId: { type: Schema.Types.ObjectId, ref: "Trade", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["htf", "entry", "postTrade", "chart"], required: true },
    mimeType: { type: String, required: true },
    originalName: { type: String },
    data: { type: Buffer, required: true },
}, { timestamps: true });

TradeScreenshotSchema.index({ tradeId: 1, kind: 1 }, { unique: true });

export const TradeScreenshot = mongoose.model<ITradeScreenshot>("TradeScreenshot", TradeScreenshotSchema);
