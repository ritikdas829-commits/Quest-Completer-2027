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

// 🎨 Default Emojis including Trial/Premium Card specific icons
const DEFAULT_EMOJIS = {
    // Status & UI Indicators
    success: "✅",
    done: "✅",
    error: "❌",
    warn: "⚠️",
    loading: "⚙️",
    online: "🟢",
    offline: "🔴",

    // Quest & Navigation Elements
    link: "🔗",
    search: "🔍",
    list: "📋",
    links: "🔗",
    qdiamond: "💎",
    orbs: "✨",
    announce: "📢",
    s_admin: "🛠️",
    gift: "🎁",
    arrow: "➡️",
    dot: "•",

    // Cards & Sections Headings (Trial/Premium Card Icons)
    crown: "👑",
    keyType: "🏷️",
    duration: "🎯",
    expire: "⏳",
    keyIcon: "🔑",
    ticket: "🎫",
    notes: "📜",
    task: "📋",
    stats: "📊",
    reward: "🎁",

    // Task Type Icons
    desktop: "🖥️",
    mobile: "📱",
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
