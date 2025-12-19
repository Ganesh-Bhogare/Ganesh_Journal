import mongoose from "mongoose";
import { config } from "../config";
import { User } from "../models/User";
import { Trade } from "../models/Trade";

function parseDateTime(value: string): Date {
    // Format: MM/DD/YYYY, HH:mm
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})$/);
    if (!match) {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
        return d;
    }
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const d = new Date(year, month - 1, day, hour, minute, 0);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
    return d;
}

function moneyToNumber(value: string): number {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    // "-$7.88" or "$31.32"
    const cleaned = trimmed.replace(/[$,]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) throw new Error(`Invalid money: ${value}`);
    return n;
}

type BrokerRow = {
    instrument: string;
    side: "Buy" | "Sell";
    openTime: string;
    openPrice: number;
    closeTime: string;
    closePrice: number;
    takeProfit?: number;
    stopLoss?: number;
    lotSize: number;
    fees: string;
    pnl: string;
};

const rows: BrokerRow[] = [
    {
        instrument: "XAUUSD",
        side: "Sell",
        openTime: "12/19/2025, 12:25",
        openPrice: 4326.27,
        closeTime: "12/19/2025, 12:43",
        closePrice: 4328.19,
        takeProfit: 4309.21,
        stopLoss: 4328.19,
        lotSize: 0.04,
        fees: "-$0.20",
        pnl: "-$7.88",
    },
    {
        instrument: "EURUSD",
        side: "Buy",
        openTime: "12/17/2025, 18:03",
        openPrice: 1.17145,
        closeTime: "12/17/2025, 18:29",
        closePrice: 1.17266,
        takeProfit: 1.17351,
        stopLoss: 1.17148,
        lotSize: 0.27,
        fees: "-$1.35",
        pnl: "$31.32",
    },
    {
        instrument: "GBPUSD",
        side: "Sell",
        openTime: "12/16/2025, 21:49",
        openPrice: 1.34241,
        closeTime: "12/17/2025, 11:05",
        closePrice: 1.33835,
        takeProfit: 1.33791,
        stopLoss: 1.33835,
        lotSize: 0.06,
        fees: "-$0.30",
        pnl: "$23.98",
    },
    {
        instrument: "XAUUSD",
        side: "Sell",
        openTime: "12/15/2025, 19:03",
        openPrice: 4339.28,
        closeTime: "12/15/2025, 20:38",
        closePrice: 4324.87,
        takeProfit: 4301.73,
        stopLoss: 4324.87,
        lotSize: 0.02,
        fees: "-$0.10",
        pnl: "$28.69",
    },
    {
        instrument: "XAUUSD",
        side: "Buy",
        openTime: "12/15/2025, 19:45",
        openPrice: 4328.54,
        closeTime: "12/15/2025, 19:46",
        closePrice: 4329.01,
        lotSize: 0.01,
        fees: "-$0.05",
        pnl: "$0.42",
    },
    {
        instrument: "USDJPY",
        side: "Sell",
        openTime: "12/12/2025, 21:09",
        openPrice: 155.9,
        closeTime: "12/15/2025, 08:09",
        closePrice: 155.448,
        takeProfit: 155.448,
        stopLoss: 155.597,
        lotSize: 0.06,
        fees: "-$0.30",
        pnl: "$16.42",
    },
    {
        instrument: "EURUSD",
        side: "Sell",
        openTime: "12/15/2025, 07:07",
        openPrice: 1.17362,
        closeTime: "12/15/2025, 07:18",
        closePrice: 1.17414,
        stopLoss: 1.17414,
        lotSize: 0.05,
        fees: "-$0.25",
        pnl: "-$2.85",
    },
    {
        instrument: "GBPUSD",
        side: "Buy",
        openTime: "12/12/2025, 17:51",
        openPrice: 1.33697,
        closeTime: "12/12/2025, 17:57",
        closePrice: 1.33698,
        stopLoss: 1.33698,
        lotSize: 0.35,
        fees: "-$1.75",
        pnl: "-$1.40",
    },
    {
        instrument: "EURUSD",
        side: "Buy",
        openTime: "12/10/2025, 16:45",
        openPrice: 1.1633,
        closeTime: "12/10/2025, 18:49",
        closePrice: 1.16297,
        takeProfit: 1.16476,
        stopLoss: 1.16297,
        lotSize: 0.17,
        fees: "-$0.85",
        pnl: "-$6.46",
    },
    {
        instrument: "EURUSD",
        side: "Buy",
        openTime: "12/9/2025, 19:52",
        openPrice: 1.1632,
        closeTime: "12/9/2025, 20:32",
        closePrice: 1.16201,
        stopLoss: 1.16201,
        lotSize: 0.17,
        fees: "-$0.85",
        pnl: "-$21.08",
    },
    {
        instrument: "XAUUSD",
        side: "Buy",
        openTime: "12/9/2025, 07:41",
        openPrice: 4193.15,
        closeTime: "12/9/2025, 08:00",
        closePrice: 4187.78,
        stopLoss: 4188.33,
        lotSize: 0.02,
        fees: "-$0.10",
        pnl: "-$10.84",
    },
    {
        instrument: "XAUUSD",
        side: "Buy",
        openTime: "12/8/2025, 13:26",
        openPrice: 4209.5,
        closeTime: "12/8/2025, 13:30",
        closePrice: 4206.1,
        takeProfit: 4220.07,
        stopLoss: 4206.1,
        lotSize: 0.02,
        fees: "-$0.10",
        pnl: "-$6.90",
    },
    {
        instrument: "XAUUSD",
        side: "Buy",
        openTime: "12/4/2025, 09:34",
        openPrice: 4196.2,
        closeTime: "12/4/2025, 11:08",
        closePrice: 4185.13,
        takeProfit: 4241.56,
        stopLoss: 4186.95,
        lotSize: 0.02,
        fees: "-$0.10",
        pnl: "-$22.24",
    },
];

async function main() {
    await mongoose.connect(config.mongoUri);

    const userCount = await User.countDocuments();
    if (userCount !== 1) {
        throw new Error(`Expected exactly 1 user in DB, found ${userCount}.`);
    }
    const user = await User.findOne();
    if (!user) throw new Error("User not found");

    const existing = await Trade.countDocuments({ userId: user._id });
    console.log(`Found user: ${user.email} (${user._id}). Existing trades: ${existing}`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const r of rows) {
        const entryTime = parseDateTime(r.openTime);
        const exitTime = parseDateTime(r.closeTime);
        const direction = r.side === "Buy" ? "long" : "short";
        const pnl = moneyToNumber(r.pnl);

        const existingTrade = await Trade.findOne({
            userId: user._id,
            instrument: r.instrument,
            direction,
            entryTime,
            entryPrice: r.openPrice,
            exitTime,
            exitPrice: r.closePrice,
        }).select("_id");

        if (existingTrade) {
            skippedCount++;
            continue;
        }

        const notes = `Imported from broker list | Fees: ${moneyToNumber(r.fees)}`;

        await Trade.create({
            userId: user._id,
            date: entryTime,
            instrument: r.instrument,
            direction,
            entryTime,
            entryPrice: r.openPrice,
            exitTime,
            exitPrice: r.closePrice,
            stopLoss: r.stopLoss,
            takeProfit: r.takeProfit,
            lotSize: r.lotSize,
            pnl,
            notes,
        });

        insertedCount++;
    }

    console.log(`Inserted trades: ${insertedCount}. Skipped existing: ${skippedCount}.`);

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
