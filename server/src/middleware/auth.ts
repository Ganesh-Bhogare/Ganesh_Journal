import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthPayload { userId: string }

// Verifies JWT and attaches userId to request
export function requireAuth(req: Request & { userId?: string }, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
        if (!token) return res.status(401).json({ error: "Unauthorized" });
        const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
        req.userId = payload.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}
