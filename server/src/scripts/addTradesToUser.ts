import mongoose from "mongoose";
import { config } from "../config";
import { User } from "../models/User";
import { Trade } from "../models/Trade";

const targetEmail = "ganeshjagdish294@gmail.com";

// Sample trades to import
const sampleTrades = [
    {
        date: new Date("2024-01-15"),
        instrument: "EURUSD",
        direction: "long" as const,
        session: "London" as const,
        killzone: "London Open" as const,
        weeklyBias: "Bullish" as const,
        dailyBias: "Bullish" as const,
        drawOnLiquidity: "Buy-side" as const,
        isPremiumDiscount: true,
        setupType: "FVG" as const,
        pdArrays: ["FVG", "Order Block"],
        entryTime: new Date("2024-01-15T08:00:00Z"),
        entryTimeframe: "15m",
        entryConfirmation: "FVG Tap" as const,
        entryPrice: 1.0850,
        stopLoss: 1.0830,
        takeProfit: 1.0910,
        exitTime: new Date("2024-01-15T14:30:00Z"),
        exitPrice: 1.0910,
        lotSize: 0.5,
        riskPerTrade: 100,
        pnl: 300,
        rr: 3.0,
        outcome: "win" as const,
        emotionalState: "Calm" as const,
        partialTaken: true,
        slMovedToBE: true,
        followedHTFBias: true,
        correctSession: true,
        validPDArray: true,
        riskRespected: true,
        noEarlyExit: true,
        notes: "Perfect setup with London killzone. HTF bullish, entered on discount FVG."
    },
    {
        date: new Date("2024-01-16"),
        instrument: "GBPUSD",
        direction: "short" as const,
        session: "New York" as const,
        killzone: "NY AM" as const,
        weeklyBias: "Bearish" as const,
        dailyBias: "Bearish" as const,
        drawOnLiquidity: "Sell-side" as const,
        isPremiumDiscount: false,
        setupType: "Breaker Block" as const,
        pdArrays: ["Breaker Block", "FVG"],
        entryTime: new Date("2024-01-16T13:30:00Z"),
        entryTimeframe: "5m",
        entryConfirmation: "Displacement" as const,
        entryPrice: 1.2720,
        stopLoss: 1.2745,
        takeProfit: 1.2645,
        exitTime: new Date("2024-01-16T16:00:00Z"),
        exitPrice: 1.2645,
        lotSize: 0.3,
        riskPerTrade: 75,
        pnl: 225,
        rr: 3.0,
        outcome: "win" as const,
        emotionalState: "Calm" as const,
        partialTaken: false,
        slMovedToBE: true,
        followedHTFBias: true,
        correctSession: true,
        validPDArray: true,
        riskRespected: true,
        noEarlyExit: true,
        notes: "NY killzone short from premium. Clean execution."
    },
    {
        date: new Date("2024-01-17"),
        instrument: "USDJPY",
        direction: "long" as const,
        session: "Asia" as const,
        killzone: undefined,
        weeklyBias: "Bullish" as const,
        dailyBias: "Range" as const,
        drawOnLiquidity: "Buy-side" as const,
        isPremiumDiscount: true,
        setupType: "Order Block" as const,
        pdArrays: ["Order Block"],
        entryTime: new Date("2024-01-17T02:00:00Z"),
        entryTimeframe: "1h",
        entryConfirmation: "MSS" as const,
        entryPrice: 147.80,
        stopLoss: 147.50,
        takeProfit: 148.40,
        exitTime: new Date("2024-01-17T05:30:00Z"),
        exitPrice: 147.60,
        lotSize: 0.2,
        riskPerTrade: 60,
        pnl: -40,
        rr: 0.67,
        outcome: "loss" as const,
        emotionalState: "Hesitant" as const,
        partialTaken: false,
        slMovedToBE: false,
        followedHTFBias: true,
        correctSession: false,
        validPDArray: true,
        riskRespected: true,
        noEarlyExit: false,
        notes: "Exited early during Asian range. Should have waited for London."
    },
    {
        date: new Date("2024-01-18"),
        instrument: "AUDUSD",
        direction: "short" as const,
        session: "London" as const,
        killzone: "London Open" as const,
        weeklyBias: "Bearish" as const,
        dailyBias: "Bearish" as const,
        drawOnLiquidity: "Sell-side" as const,
        isPremiumDiscount: false,
        setupType: "FVG" as const,
        pdArrays: ["FVG", "Mitigation Block"],
        entryTime: new Date("2024-01-18T15:00:00Z"),
        entryTimeframe: "15m",
        entryConfirmation: "FVG Tap" as const,
        entryPrice: 0.6620,
        stopLoss: 0.6640,
        takeProfit: 0.6560,
        exitTime: new Date("2024-01-18T17:45:00Z"),
        exitPrice: 0.6560,
        lotSize: 0.4,
        riskPerTrade: 80,
        pnl: 240,
        rr: 3.0,
        outcome: "win" as const,
        emotionalState: "Calm" as const,
        partialTaken: true,
        slMovedToBE: true,
        followedHTFBias: true,
        correctSession: true,
        validPDArray: true,
        riskRespected: true,
        noEarlyExit: true,
        notes: "London close reversal. Took partials at 1R, rest to target."
    },
    {
        date: new Date("2024-01-19"),
        instrument: "NZDUSD",
        direction: "long" as const,
        session: "New York" as const,
        killzone: "NY PM" as const,
        weeklyBias: "Bullish" as const,
        dailyBias: "Bullish" as const,
        drawOnLiquidity: "Buy-side" as const,
        isPremiumDiscount: true,
        setupType: "Order Block" as const,
        pdArrays: ["Order Block", "FVG"],
        entryTime: new Date("2024-01-19T18:00:00Z"),
        entryTimeframe: "5m",
        entryConfirmation: "MSS" as const,
        entryPrice: 0.6120,
        stopLoss: 0.6100,
        takeProfit: 0.6180,
        exitTime: new Date("2024-01-19T20:30:00Z"),
        exitPrice: 0.6180,
        lotSize: 0.25,
        riskPerTrade: 50,
        pnl: 150,
        rr: 3.0,
        outcome: "win" as const,
        emotionalState: "Calm" as const,
        partialTaken: false,
        slMovedToBE: true,
        followedHTFBias: true,
        correctSession: true,
        validPDArray: true,
        riskRespected: true,
        noEarlyExit: true,
        notes: "NY PM session continuation. Let it run to full TP."
    }
];

async function addTradesToUser() {
    try {
        await mongoose.connect(config.mongoUri);
        console.log("✅ MongoDB connected");

        // Find user
        const user = await User.findOne({ email: targetEmail });
        if (!user) {
            console.error(`❌ User ${targetEmail} not found in database`);
            console.log("\nAvailable users:");
            const allUsers = await User.find({}).select("email name");
            allUsers.forEach(u => console.log(`  - ${u.email} (${u.name || 'No name'})`));
            process.exit(1);
        }

        console.log(`✅ Found user: ${user.email} (ID: ${user._id})`);

        // Check existing trades
        const existingCount = await Trade.countDocuments({ userId: user._id });
        console.log(`📊 User currently has ${existingCount} trades`);

        // Add trades
        console.log(`\n📥 Adding ${sampleTrades.length} sample trades...`);
        const created = [];
        for (const tradeData of sampleTrades) {
            const trade = await Trade.create({
                ...tradeData,
                userId: user._id
            });
            created.push(trade);
            const pnl = trade.pnl ?? 0;
            console.log(`  ✓ ${trade.date.toISOString().split('T')[0]} - ${trade.instrument} ${trade.direction} - ${trade.outcome} (${pnl > 0 ? '+' : ''}$${pnl})`);
        }

        const newCount = await Trade.countDocuments({ userId: user._id });
        console.log(`\n✅ Successfully added ${created.length} trades`);
        console.log(`📊 User now has ${newCount} total trades`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
}

addTradesToUser();
