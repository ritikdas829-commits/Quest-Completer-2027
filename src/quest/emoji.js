/**
 * emoji.js — Professional MongoDB Emoji Manager with Safe Validation & Crash Prevention
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
    apple: "🍎", 
    video: "🎬",
    stream: "📺",
    activity: "🎮",
    gear: "⚙️",
    robot: "🤖"
};

/**
 * 🛡️ Helper: Validates if an emoji string is safe to use in Discord components (Buttons/Select menus)
 * Prevents [COMPONENT_INVALID_EMOJI] crashes.
 */
function sanitizeEmoji(emojiValue, fallback = "⭐") {
    if (!emojiValue || typeof emojiValue !== 'string') return fallback;

    // 1. Check if it's a standard unicode emoji or basic string
    // 2. Check if it's a custom Discord emoji format: <:name:id> or <a:name:id> or just an ID digits string
    const customEmojiRegex = /^(?:<a?:[a-zA-Z0-9_]+:(\d+)>|(\d+))$/;
    
    if (customEmojiRegex.test(emojiValue.trim()) || emojiValue.trim().length <= 8) {
        return emojiValue.trim();
    }

    // If it's a messy text string (like raw app emoji names without proper formatting), fallback safely
    if (emojiValue.includes(":") && !emojiValue.startsWith("<")) {
        return fallback;
    }

    return emojiValue.trim();
}

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
                // Sanitize upon loading into cache
                this.cache.set(cacheKey, sanitizeEmoji(doc.value));
            }
            console.log(`🎨 Loaded ${docs.length} custom emoji(s) into memory cache safely.`);
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
                    customEmojis[key] = sanitizeEmoji(value);
                }
            }
            // Merge defaults with sanitized custom ones
            const merged = { ...DEFAULT_EMOJIS, ...customEmojis };
            
            // Double-check all values to ensure no raw unformatted text goes into discord components
            for (const k in merged) {
                merged[k] = sanitizeEmoji(merged[k], DEFAULT_EMOJIS[k] || "⭐");
            }
            return merged;
        } catch (e) {
            console.error('❌ Error fetching emojis:', e.message);
            return DEFAULT_EMOJIS;
        }
    }

    async saveEmoji(key, value, guildId = 'global') {
        try {
            if (!key || !value) return false;

            const safeValue = sanitizeEmoji(value);
            const cacheKey = this.makeCacheKey(guildId, key);
            this.cache.set(cacheKey, safeValue);

            await EmojiModel.findOneAndUpdate(
                { guildId, key },
                { value: safeValue, updatedAt: new Date() },
                { upsert: true, new: true }
            );

            console.log(`✅ Emoji saved safely [${guildId}] ${key} -> ${safeValue}`);
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
