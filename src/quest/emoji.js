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

// 📂 Independent Categories per UI/File (Single Source of Truth)
export const EMOJI_CATEGORIES = {
    "🟢 System & Status": [
        'sys_success', 'sys_error', 'sys_warn', 'sys_loading', 'sys_online', 'sys_offline'
    ],
    "🎨 Orbie Panel UI": [
        'panel_premium', 'panel_trial', 'panel_crown', 'panel_ticket', 'panel_success', 'panel_error', 'panel_shield'
    ],
    "🔗 Premium Link UI": [
        'link_icon', 'link_gear', 'link_success', 'link_error', 'link_lock'
    ],
    "⚔️ Quest Commands UI": [
        'quest_link', 'quest_search', 'quest_list', 'quest_gear', 'quest_bell', 'quest_error', 
        'quest_success', 'quest_desktop', 'quest_video', 'quest_stream', 'quest_activity', 
        'quest_mobile', 'quest_orbs', 'quest_gift', 'quest_task', 'quest_expire', 'quest_stats', 
        'quest_reward', 'quest_warn', 'quest_dot', 'quest_loading', 'quest_robot'
    ],
    "🎰 Slot UI & Management": [
        'slot_success', 'slot_error', 'slot_lock'
    ],
    "🔑 Key Command UI": [
        'key_error', 'key_gift', 'key_slot', 'key_duration', 'key_shield', 'key_rocket', 
        'key_success', 'key_user', 'key_id', 'key_status', 'key_type', 'key_expiry', 'key_chart'
    ],
    "⚡ Event Handler UI": [
        'event_error', 'event_warn', 'event_list', 'event_link', 'event_success', 
        'event_online', 'event_dot', 'event_loading', 'event_gift', 'event_robot'
    ],
    "📖 Guide Command UI": [
        'guide_ticket', 'guide_ios', 'guide_phone', 'guide_pc'
    ],
    "📖 Help Command UI": [
        'help_bot', 'help_presence', 'help_quest', 'help_utility', 
        'help_success', 'help_warn', 'help_online', 'help_globe'
    ],
    "🏓 Ping Command UI": [
        'ping_icon', 'ping_info', 'ping_arrow', 'ping_success', 'ping_warning', 'ping_error', 'ping_bot'
    ],
    "🔑 Key Activation Handler UI": [
        'activate_error', 'activate_list', 'activate_success', 'activate_trial', 
        'activate_expire', 'activate_reward', 'activate_shield', 'activate_rocket', 'activate_link', 'activate_online'
    ],
    "💬 Message Handler UI": [
        'msg_premium', 'msg_diamond', 'msg_star', 'msg_gift', 'msg_error'
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
    panel_premium: "💎",
    panel_trial: "💎",
    panel_crown: "👑",
    panel_ticket: "🎫",
    panel_success: "✅",
    panel_error: "❌",
    panel_shield: "🔒",

    // Premium Link UI
    link_icon: "🔗",
    link_gear: "⚙️",
    link_success: "✅",
    link_error: "❌",
    link_lock: "🔒",

    // Quest Commands UI
    quest_link: "🔗",
    quest_search: "🔍",
    quest_list: "📋",
    quest_gear: "⚙️",
    quest_bell: "🔔",
    quest_error: "❌",
    quest_success: "✅",
    quest_desktop: "🖥️",
    quest_video: "🎬",
    quest_stream: "📺",
    quest_activity: "🎮",
    quest_mobile: "📱",
    quest_orbs: "✨",
    quest_gift: "🎁",
    quest_task: "📋",
    quest_expire: "📅",
    quest_stats: "📊",
    quest_reward: "🎁",
    quest_warn: "⚠️",
    quest_dot: "🔵",
    quest_loading: "⚙️",
    quest_robot: "🤖",

    // Slot UI & Management
    slot_success: "✅",
    slot_error: "❌",
    slot_lock: "🔒",

    // Key Command UI
    key_error: "❌",
    key_gift: "🎁",
    key_slot: "🎰",
    key_duration: "🎯",
    key_shield: "🔒",
    key_rocket: "🚀",
    key_success: "✅",
    key_user: "👤",
    key_id: "🆔",
    key_status: "🟢",
    key_type: "🏷️",
    key_expiry: "⏳",
    key_chart: "📊",

    // Event Handler UI
    event_error: "❌",
    event_warn: "⚠️",
    event_list: "📊",
    event_link: "🔗",
    event_success: "✅",
    event_online: "🟢",
    event_dot: "⚪",
    event_loading: "🔄",
    event_gift: "🎁",
    event_robot: "🤖",

    // Guide Command UI
    guide_ticket: "🎫",
    guide_ios: "🍎",
    guide_phone: "📱",
    guide_pc: "💻",

    // Help Command UI
    help_bot: "🤖",
    help_presence: "🟢",
    help_quest: "⚔️",
    help_utility: "🛠️",
    help_success: "✨",
    help_warn: "💡",
    help_online: "🌐",
    help_globe: "🌍",

    // Ping Command UI
    ping_icon: "🏓",
    ping_info: "⚡",
    ping_arrow: "🚀",
    ping_success: "🟢",
    ping_warning: "🟡",
    ping_error: "🔴",
    ping_bot: "🤖",

    // Key Activation Handler UI
    activate_error: "❌",
    activate_list: "📋",
    activate_success: "✅",
    activate_trial: "🧿",
    activate_expire: "⏱️",
    activate_reward: "📦",
    activate_shield: "🛡️",
    activate_rocket: "🚀",
    activate_link: "🔗",
    activate_online: "⚡",

    // Message Handler UI
    msg_premium: "💙",
    msg_diamond: "💎",
    msg_star: "🌟",
    msg_gift: "🎁",
    msg_error: "❌"
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
