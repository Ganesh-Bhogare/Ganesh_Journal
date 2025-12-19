import dotenv from "dotenv";
import path from "path";

// Load env from the process working directory first (monorepo root),
// then fall back to the server workspace .env (server/.env).
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const config = {
    port: parseInt(process.env.PORT || "4000", 10),
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/ganesh_journal",
    jwtSecret: process.env.JWT_SECRET || "change-me",
    uploadDir: process.env.UPLOAD_DIR || "uploads",
    uploadDirAbs: "",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "",
    openaiAppName: process.env.OPENAI_APP_NAME || "",
};

// Resolve upload directory relative to the server workspace (stable across environments)
const serverWorkspaceRoot = path.resolve(__dirname, "..");
config.uploadDirAbs = path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.resolve(serverWorkspaceRoot, config.uploadDir);
