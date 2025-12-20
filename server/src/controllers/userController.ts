import { Request, Response } from "express";
import { User } from "../models/User";
import { userPreferencesSchema } from "../utils/validation";

export async function getPreferences(req: Request & { userId?: string }, res: Response) {
    try {
        const user = await User.findById(req.userId).select("preferences email name");
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json({ preferences: user.preferences || {} });
    } catch (_err) {
        return res.status(500).json({ error: "Failed to load preferences" });
    }
}

export async function updatePreferences(req: Request & { userId?: string }, res: Response) {
    try {
        const parsed = userPreferencesSchema.parse(req.body || {});

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.preferences = {
            ...(user.preferences || {}),
            ...parsed,
        };

        await user.save();
        return res.json({ preferences: user.preferences || {} });
    } catch (err: any) {
        if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Failed to update preferences" });
    }
}
