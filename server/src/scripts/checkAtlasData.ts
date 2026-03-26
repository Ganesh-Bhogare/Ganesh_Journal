import mongoose from "mongoose";
import { config } from "../config";

async function run() {
    if (!config.mongoUri) throw new Error("MONGO_URI is missing");

    await mongoose.connect(config.mongoUri);
    const db = mongoose.connection.db;
    if (!db) throw new Error("No database selected");

    console.log(`Connected DB: ${db.databaseName}`);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    if (!collections.length) {
        console.log("No collections found.");
        return;
    }

    for (const c of collections) {
        const name = String(c?.name || "");
        if (!name) continue;
        const count = await db.collection(name).countDocuments({});
        console.log(`${name}: ${count}`);
    }
}

run()
    .catch((err) => {
        console.error("Atlas check failed:", err?.message || err);
        process.exit(1);
    })
    .finally(async () => {
        await mongoose.disconnect();
    });