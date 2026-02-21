import * as dotenv from 'dotenv';
import 'cross-fetch/polyfill';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Load env vars
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Our core "Top 5" roster that we want to keep perfect historical charts for.
const CORE_ROSTER = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"];

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndSaveDailyData(symbol: string) {
    console.log(`\nFetching 20yr TIME_SERIES_DAILY for ${symbol} via Yahoo Finance...`);
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=20y`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        if (!res.ok) {
            console.error(`🚨 Yahoo Finance API Error: ${res.status}`);
            return false;
        }

        const data = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) {
            console.error(`Unexpected API response for ${symbol}`);
            return true; // Return true to continue to next symbol, this just failed locally
        }

        const timestamps = result.timestamp;
        const quotes = result.indicators?.quote?.[0];

        if (!timestamps || !quotes) {
            console.error(`Missing quote data for ${symbol}`);
            return true;
        }

        // Format data into an array of candles
        let chartData: any[] = [];
        for (let j = 0; j < timestamps.length; j++) {
            // Some days might have missing 'close' due to half-days or errors, filter them
            if (quotes.close[j] !== null) {
                // Yahoo timestamps are given in seconds.
                const dateObj = new Date(timestamps[j] * 1000);
                const dateStr = dateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD

                chartData.push({
                    date: dateStr,
                    open: quotes.open[j] || quotes.close[j],
                    high: quotes.high[j] || quotes.close[j],
                    low: quotes.low[j] || quotes.close[j],
                    close: quotes.close[j],
                    volume: quotes.volume[j] || 0
                });
            }
        }

        // Yahoo already returns oldest -> newest. Just to be safe, filter limits if it gets insanely large.
        // We'll keep max 5000 days (approx 20 years).
        chartData = chartData.slice(-5000);

        // Save to Firestore using Web SDK
        await setDoc(doc(db, "market_cache", `${symbol}_daily`), {
            symbol: symbol,
            lastUpdated: serverTimestamp(),
            chartData: chartData,
        }, { merge: true });

        console.log(`✅ Saved ${chartData.length} days of history for ${symbol} to Firestore.`);
        return true;

    } catch (error) {
        console.error(`Failed to fetch/save data for ${symbol}:`, error);
        return true;
    }
}

async function main() {
    console.log("🚀 Starting Nightly Market Data Sync (Yahoo Finance)");
    console.log(`Roster: ${CORE_ROSTER.join(", ")}\n`);

    for (let i = 0; i < CORE_ROSTER.length; i++) {
        const symbol = CORE_ROSTER[i];

        const success = await fetchAndSaveDailyData(symbol);

        if (!success) break;

        // Yahoo Finance is free tier, let's just sleep 2s between to be polite.
        if (i < CORE_ROSTER.length - 1) {
            console.log("Sleeping 2 seconds between pulls to be polite...");
            await sleep(2000);
        }
    }

    console.log("\n✨ Market Data Sync Complete!");
    process.exit(0);
}

main();
