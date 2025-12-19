import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { config } from "../config";
import { registerSchema, loginSchema } from "../utils/validation";

// Registers a new user
export async function register(req: Request, res: Response) {
    try {
        const parsed = registerSchema.parse(req.body);
        const existing = await User.findOne({ email: parsed.email });
        if (existing) return res.status(400).json({ error: "Email already registered" });

        const passwordHash = await bcrypt.hash(parsed.password, 10);
        const user = await User.create({ email: parsed.email, passwordHash, name: parsed.name });

        const token = jwt.sign({ userId: user._id.toString() }, config.jwtSecret, { expiresIn: "7d" });
        return res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (err: any) {
        if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Registration failed" });
    }
}

// Authenticates a user and returns JWT
export async function login(req: Request, res: Response) {
    try {
        const parsed = loginSchema.parse(req.body);
        const user = await User.findOne({ email: parsed.email });
        if (!user) return res.status(400).json({ error: "Invalid credentials" });
        const ok = await bcrypt.compare(parsed.password, user.passwordHash);
        if (!ok) return res.status(400).json({ error: "Invalid credentials" });
        const token = jwt.sign({ userId: user._id.toString() }, config.jwtSecret, { expiresIn: "7d" });
        return res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (err: any) {
        if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: "Login failed" });
    }
}
