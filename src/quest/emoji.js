/**
 * emoji.js — Independent UI & File-specific Emoji Manager with Safe Validation
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

// 📂 Independent Categories per UI/File
export const EMOJI_CATEGORIES = {
    "🟢 System & Status": [
        'sys_success', 'sys_error', 'sys_warn', 'sys_loading', 'sys_online', 'sys_offline'
    ],
    "🎨 Orbie Panel UI": [
        'panel_link', 'panel_premium', 'panel_orbs', 'panel_star', 'panel_crown', 'panel_gift', 'panel_button'
    ],
    "👤 Profile & User UI": [
        'profile_user', 'profile_id', 'profile_slot', 'profile_calendar', 'profile_globe'
    ],
    "🔑 Key & Admin UI": [
        'admin_key', 'admin_duration', 'admin_target', 'admin_expire', 'admin_shield', 'admin_ticket'
    ]
};

const DEFAULT_EMOJIS = {
    // System & Status
    sys_success: "✅",
    sys_error: "❌",
    sys_warn: "⚠️",
    sys_loading: "⚙️",
    sys_online: "🟢",
    sys_offline: "🔴",

    // Orbie Panel UI
    panel_link: "🔗",
    panel_premium: "💎",
    panel_orbs: "✨",
    panel_star: "🌟",
    panel_crown: "👑",
    panel_gift: "🎁",
    panel_button: "⭐",

    // Profile & User UI
    profile_user: "👤",
    profile_id: "🆔",
    profile_slot: "🎰",
    profile_calendar: "📅",
    profile_globe: "🌐",

    // Key & Admin UI
    admin_key: "🔑",
    admin_duration: "🎯",
    admin_target: "🎯",
    admin_expire: "⏳",
    admin_shield: "🛡️",
    admin_ticket: "🎫"
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
            console.log(`🎨 Loaded ${docs.length} independent emoji(s) into memory cache safely.`);
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

            console.log(`✅ Independent Emoji saved safely [${guildId}] ${key} -> ${safeValue}`);
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
