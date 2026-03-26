import mongoose from "mongoose";
import { config } from "../config";

const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/ganesh_journal";
const BATCH_SIZE = 500;

async function migrateCollection(sourceDb: any, targetDb: any, collectionName: string) {
    const sourceCollection = sourceDb.collection(collectionName);
    const targetCollection = targetDb.collection(collectionName);

    const total = await sourceCollection.countDocuments({});
    if (total === 0) {
        console.log(`- ${collectionName}: empty, skipped`);
        return { total: 0, processed: 0 };
    }

    let processed = 0;
    const cursor = sourceCollection.find({});

    while (await cursor.hasNext()) {
        const batch: any[] = [];
        while (batch.length < BATCH_SIZE && await cursor.hasNext()) {
            const doc = await cursor.next();
            if (doc) batch.push(doc);
        }

        if (batch.length === 0) break;

        const ops = batch.map((doc: any) => {
            if (collectionName === "users" && typeof doc?.email === "string" && doc.email.trim()) {
                const { _id, ...rest } = doc;
                return {
                    updateOne: {
                        filter: { email: doc.email },
                        update: {
                            $set: rest,
                            $setOnInsert: { _id },
                        },
                        upsert: true,
                    },
                };
            }

            return {
                replaceOne: {
                    filter: { _id: doc._id },
                    replacement: doc,
                    upsert: true,
                },
            };
        });

        await targetCollection.bulkWrite(ops, { ordered: false });
        processed += batch.length;
    }

    console.log(`- ${collectionName}: ${processed}/${total} migrated`);
    return { total, processed };
}

async function run() {
    const sourceUri = process.env.LOCAL_MONGO_URI || DEFAULT_LOCAL_URI;
    const targetUri = config.mongoUri;

    if (!targetUri) {
        throw new Error("MONGO_URI is required (Atlas target)");
    }

    console.log("Starting Mongo migration...");
    console.log(`Source: ${sourceUri}`);
    console.log("Target: MONGO_URI from server/.env");

    const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
    const targetConn = await mongoose.createConnection(targetUri).asPromise();

    try {
        const sourceDb = sourceConn.db;
        const targetDb = targetConn.db;

        if (!sourceDb || !targetDb) {
            throw new Error("Could not access source or target database");
        }

        const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
        const names = collections
            .map((c: any) => String(c?.name || ""))
            .filter((name: string) => name && !name.startsWith("system."));

        if (names.length === 0) {
            console.log("No collections found in source DB.");
            return;
        }

        let grandTotal = 0;
        let grandProcessed = 0;

        for (const name of names) {
            const result = await migrateCollection(sourceDb, targetDb, name);
            grandTotal += result.total;
            grandProcessed += result.processed;
        }

        console.log(`Migration complete. Documents migrated: ${grandProcessed}/${grandTotal}`);
    } finally {
        await sourceConn.close();
        await targetConn.close();
    }
}

run().catch((err) => {
    console.error("Migration failed:", err?.message || err);
    process.exit(1);
});