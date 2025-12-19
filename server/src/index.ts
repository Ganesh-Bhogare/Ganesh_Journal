import mongoose from "mongoose";
import { createApp } from "./app";
import { config } from "./config";

// Bootstraps the server and connects to MongoDB
async function bootstrap() {
    try {
        await mongoose.connect(config.mongoUri);
        console.log("MongoDB connected");

        const app = createApp();
        const server = app.listen(config.port, () => {
            console.log(`Server running on http://localhost:${config.port}`);
        });

        server.on("error", (err: any) => {
            if (err?.code === "EADDRINUSE") {
                console.error(
                    `Port ${config.port} is already in use. Stop the other server process or set PORT in server/.env (e.g. PORT=4001).`
                );
                process.exit(1);
            }
            console.error("Server failed to start", err);
            process.exit(1);
        });
    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

bootstrap();
