import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const config = {};
env.split("\n").forEach(line => {
    const [key, val] = line.split("=");
    if (key && val) config[key] = val.replace(/"/g, "").trim();
});

const firebaseConfig = {
    apiKey: config.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: config.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: config.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: config.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: config.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const feedActivities = [
    {
        user: { name: "Sarah Jenkins", handle: "@sarahj", avatar: "SJ", color: "bg-blue-500", uid: "mock_1" },
        action: "purchased 15 shares of",
        ticker: "TSLA",
        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        likes: ["mock_user_1", "mock_user_2"],
        commentsList: [
            { id: 101, uid: "mock_user_3", user: "Mike Ross", text: "Bold move on TSLA!", timestamp: new Date().toISOString() },
            { id: 102, uid: "mock_user_4", user: "Elena Chen", text: "To the moon 🚀", timestamp: new Date().toISOString() }
        ],
        isPositive: false
    },
    {
        user: { name: "Mike Ross", handle: "@miker", avatar: "MR", color: "bg-purple-500", uid: "mock_2" },
        action: "hit a new all-time high portfolio value!",
        ticker: "Portfolio",
        timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        likes: ["mock_user_5"],
        commentsList: [
            { id: 201, uid: "mock_user_6", user: "David Kim", text: "Congrats man, huge W!", timestamp: new Date().toISOString() }
        ],
        isPositive: true
    },
    {
        user: { name: "Elena Chen", handle: "@elena_invests", avatar: "EC", color: "bg-pink-500", uid: "mock_3" },
        action: "sold their position in",
        ticker: "AAPL",
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        likes: [],
        commentsList: [],
        isPositive: true
    }
];

async function seed() {
    for (const act of feedActivities) {
        await addDoc(collection(db, "global_feed"), act);
    }
    console.log("Seeded");
    process.exit(0);
}
seed();
