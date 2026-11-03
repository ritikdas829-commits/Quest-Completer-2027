/**
 * emoji.js — Per-File Independent Emoji Manager — Screenshot Exact Version
 * Location: src/quest/emoji.js
 * Har file ka emoji alag se change kar sakte ho!
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

// ⚔️ Quest Commands UI — Screenshot Exact Emojis + Per-File Control
export const QUEST_UI_CATEGORIES = {
    "⚔️ Quest Commands UI — Screenshot Exact": [
        'quest_header_tool', 'quest_overview_star', 'quest_gift', 'quest_gift_sparkle',
        'quest_game', 'quest_publisher', 'quest_enrolled', 'quest_expires',
        'quest_live_progress', 'quest_progress', 'quest_success', 'quest_error',
        'quest_desktop', 'quest_mobile', 'quest_tasks_header',
        'quest_task_desktop', 'quest_task_mobile', 'quest_task_video', 'quest_task_generic',
        'quest_search', 'quest_list', 'quest_gear', 'quest_bell',
        'quest_btn_start', 'quest_btn_stop', 'quest_btn_refresh', 'quest_btn_link',
        'quest_logs', 'quest_link', 'quest_warn',
        'quest_bar_fill', 'quest_bar_empty', 'quest_bar_zero',
        'quest_dot', 'quest_loading', 'quest_robot', 'quest_stats', 'quest_reward'
    ]
};

export const EMOJI_CATEGORIES = {
    "🟢 System & Status": ['sys_success', 'sys_error', 'sys_warn', 'sys_loading', 'sys_online', 'sys_offline'],
    "🎨 Orbie Panel UI": ['panel_premium', 'panel_trial', 'panel_crown', 'panel_ticket', 'panel_success', 'panel_error', 'panel_shield'],
    "🔗 Premium Link UI": ['link_icon', 'link_gear', 'link_success', 'link_error', 'link_lock'],
    ...QUEST_UI_CATEGORIES,
    "🎰 Slot UI & Management": ['slot_success', 'slot_error', 'slot_lock'],
    "🔑 Key Command UI": ['key_error', 'key_gift', 'key_slot', 'key_duration', 'key_shield', 'key_rocket', 'key_success', 'key_user', 'key_id', 'key_status', 'key_type', 'key_expiry', 'key_chart'],
    "⚡ Event Handler UI": ['event_error', 'event_warn', 'event_list', 'event_link', 'event_success', 'event_online', 'event_dot', 'event_loading', 'event_gift', 'event_robot'],
    "📖 Guide Command UI": ['guide_ticket', 'guide_ios', 'guide_phone', 'guide_pc'],
    "📖 Help Command UI": ['help_bot', 'help_presence', 'help_quest', 'help_utility', 'help_success', 'help_warn', 'help_online', 'help_globe'],
    "🏓 Ping Command UI": ['ping_icon', 'ping_info', 'ping_arrow', 'ping_success', 'ping_warning', 'ping_error', 'ping_bot'],
    "🔑 Key Activation Handler UI": ['activate_error', 'activate_list', 'activate_success', 'activate_trial', 'activate_expire', 'activate_reward', 'activate_shield', 'activate_rocket', 'activate_link', 'activate_online'],
    "💬 Message Handler UI": ['msg_premium', 'msg_diamond', 'msg_star', 'msg_gift', 'msg_error'],
    "📥 Invite Tracker UI": ['invite_join', 'invite_wait', 'invite_warn', 'invite_success', 'invite_leave', 'invite_lock']
};

// Screenshot ke exact emojis as defaults
export const DEFAULT_QUEST_EMOJIS = {
    quest_header_tool: "🛠️",
    quest_overview_star: "✨",
    quest_gift: "🎁",
    quest_gift_sparkle: "✨",
    quest_game: "🟢",
    quest_publisher: "📋",
    quest_enrolled: "📅",
    quest_expires: "➡️",
    quest_live_progress: "📊",
    quest_progress: "⏳",
    quest_success: "✅",
    quest_error: "❌",
    quest_desktop: "🖥️",
    quest_mobile: "📱",
    quest_tasks_header: "📋",
    quest_task_desktop: "🖥️",
    quest_task_mobile: "📱",
    quest_task_video: "🎬",
    quest_task_generic: "⚙️",
    quest_search: "🔍",
    quest_list: "📋",
    quest_gear: "⚙️",
    quest_bell: "🔔",
    quest_btn_start: "▶️",
    quest_btn_stop: "⏹️",
    quest_btn_refresh: "🔄",
    quest_btn_link: "🔗",
    quest_logs: "📋",
    quest_link: "🔗",
    quest_warn: "⚠️",
    quest_bar_fill: "█",
    quest_bar_empty: "░",
    quest_bar_zero: "░░░░░░░░░░",
    quest_dot: "🔵",
    quest_loading: "⚙️",
    quest_robot: "🤖",
    quest_stats: "📊",
    quest_reward: "🎁"
};

const DEFAULT_EMOJIS = {
    sys_success: "✅", sys_error: "❌", sys_warn: "⚠️", sys_loading: "⚙️", sys_online: "🟢", sys_offline: "🔴",
    panel_premium: "💎", panel_trial: "💎", panel_crown: "👑", panel_ticket: "🎫", panel_success: "✅", panel_error: "❌", panel_shield: "🔒",
    link_icon: "🔗", link_gear: "⚙️", link_success: "✅", link_error: "❌", link_lock: "🔒",
    ...DEFAULT_QUEST_EMOJIS,
    slot_success: "✅", slot_error: "❌", slot_lock: "🔒",
    key_error: "❌", key_gift: "🎁", key_slot: "🎰", key_duration: "🎯", key_shield: "🔒", key_rocket: "🚀", key_success: "✅", key_user: "👤", key_id: "🆔", key_status: "🟢", key_type: "🏷️", key_expiry: "⏳", key_chart: "📊",
    event_error: "❌", event_warn: "⚠️", event_list: "📊", event_link: "🔗", event_success: "✅", event_online: "🟢", event_dot: "⚪", event_loading: "🔄", event_gift: "🎁", event_robot: "🤖",
    guide_ticket: "🎫", guide_ios: "🍎", guide_phone: "📱", guide_pc: "💻",
    help_bot: "🤖", help_presence: "🟢", help_quest: "⚔️", help_utility: "🛠️", help_success: "✨", help_warn: "💡", help_online: "🌐", help_globe: "🌍",
    ping_icon: "🏓", ping_info: "⚡", ping_arrow: "🚀", ping_success: "🟢", ping_warning: "🟡", ping_error: "🔴", ping_bot: "🤖",
    activate_error: "❌", activate_list: "📋", activate_success: "✅", activate_trial: "🧿", activate_expire: "⏱️", activate_reward: "📦", activate_shield: "🛡️", activate_rocket: "🚀", activate_link: "🔗", activate_online: "⚡",
    msg_premium: "💙", msg_diamond: "💎", msg_star: "🌟", msg_gift: "🎁", msg_error: "❌",
    invite_join: "📥", invite_wait: "⏳", invite_warn: "⚠️", invite_success: "🎉", invite_leave: "📤", invite_lock: "🔒"
};

function sanitizeEmoji(emojiValue, fallback = "⭐") {
    if (!emojiValue || typeof emojiValue !== 'string') return fallback;
    const customEmojiRegex = /^(?:<a?:[a-zA-Z0-9_]+:(\d+)>|(\d+))$/;
    const trimmed = emojiValue.trim();
    if (customEmojiRegex.test(trimmed)) return trimmed;
    if (trimmed.length <= 8 && !trimmed.includes(' ')) {
        if (trimmed.includes(':') && !trimmed.startsWith('<')) return fallback;
        return trimmed;
    }
    if ([...trimmed].length <= 2) return trimmed;
    return fallback;
}

export class EmojiStore {
    constructor() {
        this.cache = new Map();
        this.loadIntoCache();
    }
    makeCacheKey(guildId, key) { return `${guildId}::${key}`; }
    async loadIntoCache() {
        try {
            const docs = await EmojiModel.find({});
            for (const doc of docs) {
                const cacheKey = this.makeCacheKey(doc.guildId, doc.key);
                this.cache.set(cacheKey, sanitizeEmoji(doc.value, DEFAULT_EMOJIS[doc.key] || "⭐"));
            }
            console.log(`🎨 Loaded ${docs.length} emoji(s) — Per-File Controlled`);
        } catch (err) {
            console.error('❌ Error loading emojis:', err.message);
        }
    }
    async getEmojis(guildId = 'global') {
        try {
            const merged = { ...DEFAULT_EMOJIS };
            for (const [cacheKey, value] of this.cache.entries()) {
                if (cacheKey.startsWith(`global::`)) {
                    const key = cacheKey.split('::')[1];
                    if (key) merged[key] = sanitizeEmoji(value, merged[key] || "⭐");
                }
            }
            if (guildId !== 'global') {
                for (const [cacheKey, value] of this.cache.entries()) {
                    if (cacheKey.startsWith(`${guildId}::`)) {
                        const key = cacheKey.split('::')[1];
                        if (key) merged[key] = sanitizeEmoji(value, merged[key] || "⭐");
                    }
                }
            }
            for (const k in merged) {
                merged[k] = sanitizeEmoji(merged[k], DEFAULT_EMOJIS[k] || "⭐");
            }
            return merged;
        } catch (e) {
            return DEFAULT_EMOJIS;
        }
    }
    async saveEmoji(key, value, guildId = 'global') {
        try {
            if (!key || !value) return false;
            const safeValue = sanitizeEmoji(value, DEFAULT_EMOJIS[key] || "⭐");
            const cacheKey = this.makeCacheKey(guildId, key);
            this.cache.set(cacheKey, safeValue);
            await EmojiModel.findOneAndUpdate(
                { guildId, key },
                { value: safeValue, updatedAt: new Date() },
                { upsert: true, new: true }
            );
            console.log(`✅ Emoji saved [${guildId}] ${key} -> ${safeValue}`);
            return true;
        } catch (e) {
            console.error(`❌ Error saving emoji [${guildId}] ${key}:`, e.message);
            return false;
        }
    }
}

export const emojiStore = new EmojiStore();
export async function getEmojis(guildId = 'global') { return await emojiStore.getEmojis(guildId); }
export async function saveEmoji(key, value, guildId = 'global') { return await emojiStore.saveEmoji(key, value, guildId); }
