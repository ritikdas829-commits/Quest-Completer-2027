/**
 * questUI.js — Complete Fixed & Crash-Free Edition
 * Location: src/quest/questUI.js
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import { QuestClient } from './questClient.js';

const ACCENT = 0x2B2D31;
const EXCLUDED_QUEST_ID = '1412491570820812933';

// ==========================================
// 🎯 CENTRAL EMOJIS (Clean & Supported Fallbacks)
// ==========================================
const EMOJI = {
    quest: "🏆",
    watch: "💻",
    phone: "📱",
    orb: "💎",
    log: "📝",
    start: "▶️",
    stop: "⏹️",
    refresh: "🔄",
    link: "🔗",
    selectOrb: "💎",
    done: "✅",
    active: "🌀",
    compass: "🧭",
    fastMode: "⚡",
    chart: "📈",
    error: "❌",
    key: "🔑",
    warning: "⚠️"
};

function getTasks(config) {
    return config?.task_config?.tasks ?? config?.task_config_v2?.tasks ?? {};
}

function getTaskProgress(taskType, taskConfig, status) {
    if (!status) return 0;
    const target = Number(taskConfig?.target ?? 1);
    if (!Number.isFinite(target) || target <= 0) return 0;
    const progress = status.progress ?? {};
    const details = status.details ?? {};
    const eventName = taskConfig?.event_name ?? taskConfig?.type ?? taskType;
    const candidates = [
        details[taskType]?.progress, details[taskType]?.value,
        details[eventName]?.progress, details[eventName]?.value,
        progress[taskType]?.value, progress[taskType]?.progress, progress[taskType],
        progress[eventName]?.value, progress[eventName]?.progress, progress[eventName],
    ];
    let current = 0;
    for (const c of candidates) {
        if (c == null) continue;
        const v = typeof c === 'object' ? (c.value ?? c.progress) : c;
        const n = Number(v);
        if (Number.isFinite(n)) { current = Math.max(0, n); break; }
    }
    if (status.stream_progress_seconds != null) {
        const sp = Number(status.stream_progress_seconds);
        if (Number.isFinite(sp)) current = Math.max(current, sp);
    }
    if (status.video_progress_seconds != null) {
        const vp = Number(status.video_progress_seconds);
        if (Number.isFinite(vp)) current = Math.max(current, vp);
    }
    return Math.min(100, Math.floor((current / target) * 100));
}

function getQuestImages(quest) {
    const data = quest?.toJSON?.() ?? {};
    const config = quest?.config ?? data.config ?? {};
    const assets = config.assets ?? {};
    const app = quest?.application ?? config.application ?? {};
    const appId = app.id || config.application_id || config.application?.id;

    let bannerUrl = null;

    const directCandidates = [
        data.bannerURL, data.bannerUrl, data.banner_url,
        config.banner_url, config.banner, config.assets?.banner,
        assets.banner, assets.hero, assets.game_tile, assets.quest_tile
    ];
    for (const cand of directCandidates) {
        if (typeof cand === 'string' && cand.startsWith('https://') && !/\.mp4/i.test(cand)) {
            bannerUrl = cand;
            break;
        }
    }

    if (!bannerUrl && appId) {
        const keys = ['hero', 'game_tile', 'quest_tile', 'quest_bar', 'card', 'hero_video', 'thumbnail', 'icon'];
        for (const k of keys) {
            const v = assets[k] || config[k];
            if (!v || String(v).trim() === '') continue;
            let s = String(v).trim();
            if (s.startsWith('https://') && !/\.mp4/i.test(s)) {
                bannerUrl = s;
                break;
            }
            let filename = s.split('/').pop();
            if (/\.mp4/i.test(filename)) {
                filename = filename.replace(/\.mp4/i, '.png');
            }
            if (!/\.(png|jpe?g|webp)$/i.test(filename)) {
                filename += '.png';
            }
            bannerUrl = `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${filename}`;
            break;
        }
    }

    let iconUrl = null;
    const rawIcon = app.icon || config.icon || app.icon_hash;
    if (typeof rawIcon === 'string' && rawIcon.trim() !== '') {
        const t = rawIcon.trim();
        if (t.startsWith('https://')) {
            iconUrl = t;
        } else if (appId) {
            const hash = t.split('/').pop().trim();
            iconUrl = `https://cdn.discordapp.com/app-icons/${appId}/${hash}.png?size=512`;
        }
    }

    return { banner: bannerUrl, icon: iconUrl };
}

function formatTimestamp(v) {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'N/A';
    const unix = Math.floor(d.getTime() / 1000);
    return `<t:${unix}:d>`;
}

function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];
    if (!rewards.length) return `200 Orbs ${EMOJI.orb}`;
    return rewards.map(r => r?.orb_quantity ? `${r.orb_quantity} Orbs ${EMOJI.orb}` : (r?.messages?.name || 'Reward')).join(', ');
}

function shorten(v, max = 100) { return String(v ?? '').slice(0, max); }
function progressBar(p) { const f = Math.round(p / 10); return '#'.repeat(f) + '-'.repeat(10 - f); }
function text(c) { return new TextDisplayBuilder().setContent(c); }

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId, customLogs) {
    selectedQuestId ??= null;
    customLogs ??= null;
    const prefix = client.config?.prefix || process.env.PREFIX || ';';
    const tokenStore = client.tokenStore;

    if (!tokenStore) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.error} Token Store Error`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.error} Token Error`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    if (!active || !token) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.key} No Active Slot\nUse \`${prefix}link\` to link a token.`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const qc = new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() ?? [];
    } catch (e) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.warning} Quest Solver Error\n` + shorten(String(e.message ?? e), 300)));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(q => {
        try { return q.id !== EXCLUDED_QUEST_ID && !q.isExpired?.() && !q.isCompleted?.(); } catch { return true; }
    });

    const allQuests = activeQuests.map(quest => {
        const config = quest.config ?? {};
        const messages = config.messages ?? {};
        const tasks = getTasks(config);
        const status = quest.userStatus ?? {};
        const images = getQuestImages(quest);
        const platformProgress = {};
        for (const t of Object.keys(tasks)) platformProgress[t] = getTaskProgress(t, tasks[t], status);
        const seen = new Set(); const uniq = [];
        for (const k of Object.keys(platformProgress)) {
            const base = k.replace(/_\d+$/, '');
            if (!seen.has(base)) { seen.add(base); uniq.push(platformProgress[k]); }
        }
        const total = uniq.length ? Math.max(...uniq) : 0;
        return {
            id: quest.id, game: messages.game_title || config.application?.name || 'Unknown',
            publisher: messages.game_publisher || 'Unknown', questName: messages.quest_name || 'Discord Quest',
            enrolledAt: formatTimestamp(status.enrolled_at), expiresAt: formatTimestamp(config.expires_at),
            rewards: buildRewardText(config), tasks, platformProgress, images, progress: { total }
        };
    });

    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(ACCENT);
        c.addTextDisplayComponents(text(`# ${EMOJI.quest} Quest Solver\n\nNo active Quests found.`));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setEmoji({ name: EMOJI.refresh }).setStyle(ButtonStyle.Primary)));
        return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }

    const selected = allQuests.find(q => String(q.id) === String(selectedQuestId)) ?? allQuests[0];
    const container = new ContainerBuilder().setAccentColor(ACCENT);

    // Header Title
    container.addTextDisplayComponents(text(`# ${EMOJI.quest} Quest Solver`));

    // Information Section
    const desktopPct = selected.platformProgress['PLAY_ON_DESKTOP'] ?? selected.platformProgress['WATCH_VIDEO'] ?? selected.platformProgress['WATCH_VIDEO_ON_DESKTOP'] ?? selected.platformProgress['STREAM_ON_DESKTOP'] ?? selected.progress.total;
    const mobilePct = selected.platformProgress['WATCH_VIDEO_ON_MOBILE'] ?? selected.platformProgress['PLAY_ON_MOBILE'] ?? selected.platformProgress['WATCH_VIDEO'] ?? selected.progress.total;

    let info = '';
    info += `- **Game:** ${selected.game}\n`;
    info += `- **Publisher:** ${selected.publisher}\n`;
    info += `- **Quest Name:** ${selected.questName}\n`;
    info += `- **Enrolled At:** ${selected.enrolledAt}\n`;
    info += `- **Expires At:** ${selected.expiresAt}\n`;
    info += `- **Progress:**\n`;
    const progEmoji = selected.progress.total >= 100 ? EMOJI.done : EMOJI.active;
    info += `${progEmoji} ${selected.progress.total}%\n`;
    info += `-# ${EMOJI.watch} **Web/Desktop**: ${desktopPct}%\n`;
    info += `-# ${EMOJI.phone} **Mobile**: ${mobilePct}%\n`;

    container.addTextDisplayComponents(text(info));
    container.addTextDisplayComponents(text(`## Rewards:\n- **${selected.rewards}**`));

    // Tasks Section
    const seenT = new Set(); const taskLines = [];
    for (const type of Object.keys(selected.tasks)) {
        const base = type.replace(/_\d+$/, '');
        if (seenT.has(base)) continue;
        seenT.add(base);
        const t = selected.tasks[type];
        if (type.includes('PLAY_ON_DESKTOP')) taskLines.push(`- Play On Desktop for ${Math.ceil((t.target || 900) / 60)}m`);
        else if (type.includes('WATCH_VIDEO_ON_MOBILE')) taskLines.push(`- Watch Video On Mobile for ${Math.ceil((t.target || 0) / 60)}m`);
        else if (type.includes('WATCH_VIDEO')) taskLines.push(`- Watch Video On ${type.includes('MOBILE') ? 'Mobile' : 'Desktop'} for ${Math.ceil((t.target || 0) / 60)}m`);
        else if (type.includes('PLAY_ON_PLAYSTATION')) taskLines.push(`- Play On Playstation ${t.target || 900} times`);
        else if (type.includes('PLAY_ON_XBOX')) taskLines.push(`- Play On Xbox ${t.target || 900} times`);
        else if (type.includes('STREAM')) taskLines.push(`- Stream On Desktop for ${Math.ceil((t.target || 900) / 60)}m`);
        else taskLines.push(`- ${type.replace(/_/g, ' ')}`);
    }
    container.addTextDisplayComponents(text(`## Tasks:\n${taskLines.join('\n') || '- Watch Video for 2m'}`));

    // --- PHOTO GUARANTEED ---
    const galleryItems = [];
    let activeImage = selected.images?.banner || selected.images?.icon;

    if (activeImage && typeof activeImage === 'string' && activeImage.startsWith('https://')) {
        galleryItems.push(new MediaGalleryItemBuilder().setURL(activeImage).setDescription(selected.game + ' banner'));
    } else {
        galleryItems.push(new MediaGalleryItemBuilder().setURL('https://cdn.discordapp.com/embed/avatars/0.png').setDescription('Discord Quest'));
    }

    try {
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItems));
    } catch {}

    // Dropdown Select Menu
    const menuOptions = [];
    for (const q of allQuests.slice(0, 25)) {
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(shorten(q.game + ': ' + q.questName, 95))
            .setValue(String(q.id))
            .setDescription(shorten(`${q.progress.total}% - ${q.rewards}`, 100))
            .setEmoji({ name: EMOJI.selectOrb });
        if (String(q.id) === String(selected.id)) opt.setDefault(true);
        menuOptions.push(opt);
    }

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('quest_select')
                .setPlaceholder(shorten(selected.game + ': ' + selected.questName, 100))
                .addOptions(menuOptions)
        )
    );

    // Buttons
    const isRunning = customLogs && String(customLogs).toLowerCase().includes('fast mode');
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel('Start').setEmoji({ name: EMOJI.start }).setStyle(isRunning ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(isRunning ? true : false),
        new ButtonBuilder().setCustomId('quest_stop_' + selected.id).setLabel('Stop').setEmoji({ name: EMOJI.stop }).setStyle(isRunning ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setEmoji({ name: EMOJI.refresh }).setStyle(ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setEmoji({ name: EMOJI.link }).setStyle(ButtonStyle.Link).setURL(`https://discord.com/quests/${selected.id}`)));

    // Quest Logs
    const logsContainer = new ContainerBuilder().setAccentColor(ACCENT);
    logsContainer.addTextDisplayComponents(text(`## ${EMOJI.log} Quest Logs`));
    const now = new Date();
    const tStr = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    let logText = customLogs;
    if (!logText) {
        logText = `${EMOJI.compass} Quest selected\n[${tStr(now)}] ${EMOJI.fastMode} Fast mode active\n[${tStr(now)}] ${EMOJI.chart} Progress -> ${selected.questName} [${selected.progress.total}%] [${progressBar(selected.progress.total)}]`;
    }
    logsContainer.addTextDisplayComponents(text('```prolog\n' + String(logText).slice(0, 900) + '\n```'));

    return { components: [container, logsContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}
