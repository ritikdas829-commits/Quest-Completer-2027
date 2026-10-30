/**
 * emoji.js — Professional MongoDB Emoji Manager with Categories & Crash Prevention
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

// 📂 Categorized Emojis Structure (Single Source of Truth)
export const EMOJI_CATEGORIES = {
    "🟢 Status & System Emojis": ['success', 'done', 'error', 'warn', 'loading', 'online', 'offline'],
    "🎨 Panel & Action Emojis": ['link', 'search', 'list', 'links', 'premium', 'diamond', 'qdiamond', 'orbs', 'star', 'crown', 'trial', 'mail', 'announce', 's_admin', 'gift', 'arrow', 'dot'],
    "🏷️ Trial & Card Emojis": ['keyType', 'tag', 'duration', 'target', 'expire', 'hourglass', 'key', 'keyIcon', 'keyButton', 'ticket', 'scroll', 'notes'],
    "👤 Profile & Slot Emojis": ['user', 'id', 'slot', 'calendar', 'globe'],
    "🛠️ Utilities & Devices Emojis": ['rocket', 'lightning', 'bell', 'pin', 'sparkles', 'lock', 'unlock', 'shield', 'task', 'stats', 'reward', 'desktop', 'mobile', 'apple', 'video', 'stream', 'activity', 'gear', 'robot']
};

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

    const customEmojiRegex = /^(?:<a?:[a-zA-Z0-9_]+:(\d+)>|(\d+))$/;
    
    if (customEmojiRegex.test(emojiValue.trim()) || emojiValue.trim().length <= 8) {
        return emojiValue.trim();
    }

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
            const merged = { ...DEFAULT_EMOJIS, ...customEmojis };
            
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
