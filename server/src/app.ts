import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { config } from "./config";
import authRoutes from "./routes/auth";
import tradeRoutes from "./routes/trades";
import analyticsRoutes from "./routes/analytics";
import aiRoutes from "./routes/ai";
import { errorHandler } from "./middleware/errorHandler";

// Create and configure Express app
export function createApp() {
    const app = express();

    const shouldServeWeb = process.env.SERVE_WEB === "true" || process.env.NODE_ENV === "production";

    const explicitOrigins = (config.corsOrigin || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    app.use(cors({
        origin: (origin, cb) => {
            // If this server also serves the frontend, allow all origins
            // (browser will be same-origin in normal use; JWT still protects private APIs).
            if (shouldServeWeb) return cb(null, true);
            if (!origin) return cb(null, true);
            if (explicitOrigins.includes("*")) return cb(null, true);
            if (explicitOrigins.includes(origin)) return cb(null, true);
            // Dev convenience: allow any localhost port (Vite often shifts ports)
            if (/^https?:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
            return cb(null, false);
        },
    }));
    app.use(express.json({ limit: "2mb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use(morgan("dev"));

    // Static serving for uploaded screenshots
    app.use("/uploads", express.static(config.uploadDirAbs));

    // Routes
    app.use("/api/auth", authRoutes);
    app.use("/api/trades", tradeRoutes);
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/ai", aiRoutes);

    // Production: serve the frontend (Vite build) from this server.
    // This enables a single Render Web Service deployment.
    const webDistDir = path.resolve(__dirname, "..", "..", "web", "dist");
    if (shouldServeWeb && fs.existsSync(webDistDir)) {
        app.use(express.static(webDistDir));
        app.get("*", (req, res, next) => {
            // Don’t hijack API routes
            if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
            return res.sendFile(path.join(webDistDir, "index.html"));
        });
    }

    // Error handler
    app.use(errorHandler);

    return app;
}
