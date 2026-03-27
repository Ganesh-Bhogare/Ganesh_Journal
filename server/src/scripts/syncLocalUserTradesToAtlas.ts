import mongoose from "mongoose";
import { config } from "../config";

const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/ganesh_journal";
const BATCH_SIZE = 500;

async function run() {
    const sourceUri = process.env.LOCAL_MONGO_URI || DEFAULT_LOCAL_URI;
    const targetUri = config.mongoUri;

    if (!targetUri) {
        throw new Error("MONGO_URI is required for Atlas target");
    }

    console.log("Sync local user trades -> Atlas (email-mapped userId)");
    console.log(`Source: ${sourceUri}`);
    console.log("Target: MONGO_URI from server/.env");

    const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
    const targetConn = await mongoose.createConnection(targetUri).asPromise();

    try {
        const sourceDb = sourceConn.db;
        const targetDb = targetConn.db;
        if (!sourceDb || !targetDb) throw new Error("Could not access source/target DB");

        const sourceUsers = await sourceDb.collection("users").find({ email: { $exists: true } }).toArray();
        if (sourceUsers.length === 0) {
            console.log("No source users found.");
            return;
        }

        let totalCopied = 0;
        let totalUsersProcessed = 0;

        for (const sourceUser of sourceUsers) {
            const email = String(sourceUser?.email || "").trim();
            if (!email) continue;

            const targetUser = await targetDb.collection("users").findOne({ email });
            if (!targetUser?._id) {
                console.log(`- ${email}: target user not found, skipped`);
                continue;
            }

            const localTrades = await sourceDb.collection("trades").find({ userId: sourceUser._id }).toArray();
            if (localTrades.length === 0) {
                console.log(`- ${email}: no local trades`);
                totalUsersProcessed += 1;
                continue;
            }

            let userCopied = 0;
            for (let i = 0; i < localTrades.length; i += BATCH_SIZE) {
                const batch = localTrades.slice(i, i + BATCH_SIZE);
                const ops = batch.map((trade: any) => ({
                    replaceOne: {
                        filter: { _id: trade._id },
                        replacement: {
                            ...trade,
                            userId: targetUser._id,
                        },
                        upsert: true,
                    },
                }));

                await targetDb.collection("trades").bulkWrite(ops, { ordered: false });
                userCopied += batch.length;
            }

            // Cleanup: if any old trades in Atlas still reference the old local userId, reattach them.
            const remap = await targetDb.collection("trades").updateMany(
                { userId: sourceUser._id },
                { $set: { userId: targetUser._id } }
            );

            console.log(`- ${email}: synced ${userCopied} trades (remapped legacy refs: ${remap.modifiedCount})`);
            totalCopied += userCopied;
            totalUsersProcessed += 1;
        }

        console.log(`Done. Users processed: ${totalUsersProcessed}, trades synced: ${totalCopied}`);
    } finally {
        await sourceConn.close();
        await targetConn.close();
    }
}

run().catch((err) => {
    console.error("Sync failed:", err?.message || err);
    process.exit(1);
});
