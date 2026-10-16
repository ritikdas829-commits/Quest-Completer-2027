/**
 * mongo.js - Central MongoDB Connection - Multi Server Safe - No Crash
 * Location: src/utils/mongo.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
let client = null;
let dbInstance = null;
let isConnecting = false;

export async function getDatabase() {
    if (dbInstance) return dbInstance;
    if (!uri) {
        console.warn("⚠️ MONGO_URI not set - Using memory only - Data will be lost on reset");
        return null;
    }
    if (isConnecting) {
        // Wait for existing connection
        await new Promise(r => setTimeout(r, 500));
        return dbInstance || getDatabase();
    }
    try {
        isConnecting = true;
        if (!client) {
            client = new MongoClient(uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            await client.connect();
            dbInstance = client.db();
            console.log("📂 MongoDB Connected - Multi Server - Multi User - Persistent");
        }
        isConnecting = false;
        return dbInstance;
    } catch (err) {
        isConnecting = false;
        console.error("❌ MongoDB Connect Error:", err.message);
        return null;
    }
}

export async function getCollection(name) {
    try {
        const db = await getDatabase();
        if (!db) return null;
        return db.collection(name);
    } catch (err) {
        console.error(`❌ Collection ${name} error:`, err.message);
        return null;
    }
}

export function isMongoReady() {
    return !!dbInstance;
}
