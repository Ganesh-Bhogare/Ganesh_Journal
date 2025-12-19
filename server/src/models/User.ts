import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    email: string;
    passwordHash: string;
    name?: string;
    preferences?: {
        theme?: "dark" | "light";
        riskPerTrade?: number;
    };
}

const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    preferences: {
        theme: { type: String, default: "dark" },
        riskPerTrade: { type: Number, default: 1 },
    },
}, { timestamps: true });

export const User = mongoose.model<IUser>("User", UserSchema);
