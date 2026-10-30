/**
 * emoji.js — Professional MongoDB Emoji Manager with Clean Defaults & Custom Trial/Card Emojis
 * Location: src/quest/emoji.js
 */

import mongoose from 'mongoose';

const questEmojiSchema = new mongoose.Schema({
    guildId: { type: String, default: 'global', index: true },
    key: { type: String, required: true, index: true },
    value: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

questEmojiSchema.index({ guildId: 1, key: 1 }, { unique: true });

const EmojiModel = mongoose.models.QuestEmoji || mongoose.model('QuestEmoji', questEmojiSchema);

const DEFAULT_EMOJIS = {
    // Basic States
    success: "✅",
    done: "✅",
    error: "❌",
    warn: "⚠️",
    loading: "⚙️",
    online: "🟢",
    offline: "🔴",
    link: "🔗",
    search: "🔍",
    list: "📋",
    links: "🔗",
    
    // Premium & Panel Emojis
    premium: "💎",
    diamond: "💎",
    qdiamond: "💎",
    orbs: "✨",
    star: "🌟",
    crown: "👑",
    trial: "💎",
    mail: "📬",
    announce: "📢",
    s_admin: "🛠️",
    gift: "🎁",
    arrow: "➡️",
    dot: "•",

    // Trial & Card Section Emojis
    keyType: "🏷️",
    tag: "🏷️",
    duration: "🎯",
    target: "🎯",
    expire: "⏳",
    hourglass: "⏳",
    key: "🔑",
    keyIcon: "🔑",
    keyButton: "🔑",
    ticket: "🎫",
    scroll: "📜",
    notes: "📜",

    // Profile & Presence Emojis
    user: "👤",
    id: "🆔",
    slot: "🎰",
    calendar: "📅",
    globe: "🌐",

    // Extra Actions & Utilities
    rocket: "🚀",
    lightning: "⚡",
    bell: "🔔",
    pin: "📌",
    sparkles: "✨",

    // Security & Extra Utility
    lock: "🔒",
    unlock: "🔓",
    shield: "🛡️",
    task: "📋",
    stats: "📊",
    reward: "🎁",
    desktop: "🖥️",
    mobile: "📱",
    apple: "🍎", // Added for iOS guide button
    video: "🎬",
    stream: "📺",
    activity: "🎮",
    gear: "⚙️",
    robot: "🤖"
};

export class EmojiStore {
    constructor() {
        this.cache = new Map();
        this.loadIntoCache();
    }

    makeCacheKey(guildId, key) {
        return `${guildId}_${key}`;
    }

    async loadIntoCache() {
        try {
            const docs = await EmojiModel.find({});
            for (const doc of docs) {
                const cacheKey = this.makeCacheKey(doc.guildId, doc.key);
                this.cache.set(cacheKey, doc.value);
            }
            console.log(`🎨 Loaded ${docs.length} custom emoji(s) into memory cache.`);
        } catch (err) {
            console.error('❌ Error loading emojis into cache:', err.message);
        }
    }

    async getEmojis(guildId = 'global') {
        try {
            const customEmojis = {};
            for (const [cacheKey, value] of this.cache.entries()) {
                if (cacheKey.startsWith(`${guildId}_`) || cacheKey.startsWith(`global_`)) {
                    const key = cacheKey.split('_').slice(1).join('_');
                    customEmojis[key] = value;
                }
            }
            return { ...DEFAULT_EMOJIS, ...customEmojis };
        } catch (e) {
            console.error('❌ Error fetching emojis:', e.message);
            return DEFAULT_EMOJIS;
        }
    }

    async saveEmoji(key, value, guildId = 'global') {
        try {
            if (!key || !value) return false;

            const cacheKey = this.makeCacheKey(guildId, key);
            this.cache.set(cacheKey, value);

            await EmojiModel.findOneAndUpdate(
                { guildId, key },
                { value, updatedAt: new Date() },
                { upsert: true, new: true }
            );

            console.log(`✅ Emoji saved [${guildId}] ${key} -> ${value}`);
            return true;
        } catch (e) {
            console.error(`❌ Error saving emoji [${guildId}] ${key}:`, e.message);
            return false;
        }
    }
}

export const emojiStore = new EmojiStore();

export async function getEmojis(guildId = 'global') {
    return await emojiStore.getEmojis(guildId);
}

export async function saveEmoji(key, value, guildId = 'global') {
    return await emojiStore.saveEmoji(key, value, guildId);
}
