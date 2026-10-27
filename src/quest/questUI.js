/**
 * questUI.js — High-Performance MongoDB Emoji Integration & Enhanced Error Reporting
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
import { getEmojis } from './emoji.js';

const ACCENT = 0x2B2D31;
const EXCLUDED_QUEST_ID = '1412491570820812933';

function parseEmoji(s) {
    if (!s) return { name: '💎' };
    const m = s.match(/<a?:(\w+):(\d+)>/);
    if (m) return { name: m[1], id: m[2], animated: s.startsWith('<a:') };
    return { name: s };
}

function getTasks(c) { return c?.task_config?.tasks ?? c?.task_config_v2?.tasks ?? {}; }

function getTaskProgress(type, cfg, status) {
    if (!status) return 0;
    const target = Number(cfg?.target ?? 1);
    if (!Number.isFinite(target) || target <= 0) return 0;
    const p = status.progress ?? {}, d = status.details ?? {};
    const en = cfg?.event_name ?? cfg?.type ?? type;
    const cand = [d[type]?.progress, d[type]?.value, d[en]?.progress, p[type]?.value, p[type]?.progress, p[en]?.value];
    let cur = 0;
    for (const c of cand) { 
        if (c == null) continue; 
        const v = typeof c === 'object' ? (c.value ?? c.progress) : c; 
        const n = Number(v); 
        if (Number.isFinite(n)) { cur = Math.max(0, n); break; } 
    }
    if (status.stream_progress_seconds != null) cur = Math.max(cur, Number(status.stream_progress_seconds) || 0);
    if (status.video_progress_seconds != null) cur = Math.max(cur, Number(status.video_progress_seconds) || 0);
    return Math.min(100, Math.floor((cur / target) * 100));
}

function getQuestImages(quest) {
    const data = quest?.toJSON?.() ?? {};
    const config = quest?.config ?? data.config ?? {};
    const assets = config.assets ?? {};
    const app = quest?.application ?? config.application ?? {};
    const appId = app.id || config.application_id || config.application?.id;
    
    let banner = null;
    const possibleUrls = [assets.hero, assets.game_tile, assets.quest_tile, assets.banner, config.banner_url, config.image_url];

    for (const u of possibleUrls) {
        if (typeof u === 'string' && u.trim() !== '') {
            let cleaned = u.trim();
            if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
                if (!/\.mp4/i.test(cleaned)) { banner = cleaned; break; }
            } else if (appId && cleaned.length > 0) {
                banner = `https://cdn.discordapp.com/app-assets/${appId}/${cleaned}.png?size=1024`;
                break;
            }
        }
    }
    return { banner };
}

function formatTimestamp(v) { if (!v) return 'N/A'; const d = new Date(v); if (isNaN(d.getTime())) return 'N/A'; return `<t:${Math.floor(d.getTime() / 1000)}:d>`; }
function shorten(v, max = 100) { return String(v ?? '').slice(0, max); }
function progressBar(p) { const f = Math.round(p / 10); return '█'.repeat(f) + '░'.repeat(10 - f); }
function text(c) { return new TextDisplayBuilder().setContent(c); }

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId, customLogs) {
    const EMOJI = await getEmojis(guildId);

    const tokenStore = client.tokenStore;
    if (!tokenStore) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.error || '❌'} Token System Unreachable\nThe internal Token Store system is unavailable.`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch (err) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.warn || '⚠️'} Database Read Failure\nUnable to retrieve user token.`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    if (!active || !token) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.link || '🔑'} No Active Discord Account Linked\nPlease link a valid token using \`?link\`.`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const qc = new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() ?? [];
    } catch (e) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.error || '❌'} Discord API Authentication Error\nFailed to fetch quest details.`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(q => {
        try { return q.id !== EXCLUDED_QUEST_ID && !q.isExpired?.() && !q.isCompleted?.(); } catch { return true; }
    });

    const allQuests = activeQuests.map(quest => {
        const config = quest.config ?? {}, messages = config.messages ?? {}, tasks = getTasks(config), status = quest.userStatus ?? {}, images = getQuestImages(quest);
        const platformProgress = {};
        for (const t of Object.keys(tasks)) platformProgress[t] = getTaskProgress(t, tasks[t], status);
        const seen = new Set(), uniq = [];
        for (const k of Object.keys(platformProgress)) {
            const base = k.replace(/_\d+$/, '');
            if (!seen.has(base)) { seen.add(base); uniq.push(platformProgress[k]); }
        }
        const total = uniq.length ? Math.max(...uniq) : 0;
        return { id: quest.id, game: messages.game_title || config.application?.name || 'Unknown Game', publisher: messages.game_publisher || 'Unknown Publisher', questName: messages.quest_name || 'Discord Quest', enrolledAt: formatTimestamp(status.enrolled_at), expiresAt: formatTimestamp(config.expires_at), tasks, platformProgress, images, progress: { total } };
    });

    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(ACCENT);
        c.addTextDisplayComponents(text(`# ${EMOJI.list || '📋'} Quest Solver\n\n### ${EMOJI.search || '🔍'} No Active Quests Available`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const selected = allQuests.find(q => String(q.id) === String(selectedQuestId)) ?? allQuests[0];
    const container = new ContainerBuilder().setAccentColor(ACCENT);
    container.addTextDisplayComponents(text(`# ${EMOJI.s_admin || '🛠️'} ${selected.game}`));

    const desktopPct = selected.platformProgress['PLAY_ON_DESKTOP'] ?? selected.platformProgress['WATCH_VIDEO'] ?? selected.platformProgress['WATCH_VIDEO_ON_DESKTOP'] ?? selected.progress.total;
    const mobilePct = selected.platformProgress['WATCH_VIDEO_ON_MOBILE'] ?? selected.platformProgress['PLAY_ON_MOBILE'] ?? 0;

    let info = `### ${EMOJI.orbs || '✨'} Quest Overview\n`;
    info += `${EMOJI.gift || '🎁'} **Reward:** 200 Orbs ${EMOJI.orbs || '✨'}\n`;
    info += `${EMOJI.online || '🟢'} **Game:** ${selected.game}\n`;
    info += `${EMOJI.list || '📋'} **Publisher:** ${selected.publisher}\n`;
    info += `${EMOJI.expire || '📅'} **Enrolled At:** ${selected.enrolledAt}\n`;
    info += `${EMOJI.arrow || '➡️'} **Expires At:** ${selected.expiresAt}\n\n`;
    info += `### ${EMOJI.stats || '📊'} Live Progress\n`;
    const progIcon = selected.progress.total >= 100 ? (EMOJI.success || '✅') : (EMOJI.loading || '⏳');
    info += `${progIcon} **Progress:** \`${selected.progress.total}%\` \`${progressBar(selected.progress.total)}\`\n`;
    info += `-# ${EMOJI.desktop || '🖥️'} **Web/Desktop**: ${desktopPct}%\n`;
    info += `-# ${EMOJI.mobile || '📱'} **Mobile**: ${mobilePct}%\n`;
    container.addTextDisplayComponents(text(info));

    const seenT = new Set(), taskLines = [];
    for (const type of Object.keys(selected.tasks)) {
        const base = type.replace(/_\d+$/, '');
        if (seenT.has(base)) continue;
        seenT.add(base);
        const t = selected.tasks[type];
        if (type.includes('PLAY_ON_DESKTOP')) taskLines.push(`${EMOJI.desktop || '🖥️'} Play On Desktop for ${Math.ceil((t.target || 900) / 60)} minutes`);
        else if (type.includes('WATCH_VIDEO_ON_MOBILE')) taskLines.push(`${EMOJI.mobile || '📱'} Watch Video On Mobile for ${Math.ceil((t.target || 0) / 60)} minutes`);
        else if (type.includes('WATCH_VIDEO')) taskLines.push(`${EMOJI.video || '🎬'} Watch Video On Desktop for ${Math.ceil((t.target || 0) / 60)} minutes`);
        else taskLines.push(`${EMOJI.gear || '⚙️'} ${type.replace(/_/g, ' ')}`);
    }
    container.addTextDisplayComponents(text(`### ${EMOJI.task || '📋'} Tasks Required:\n${taskLines.join('\n')}`));

    // BANNER GALLERY
    const galleryItems = [];
    const bannerUrl = selected.images?.banner;
    if (bannerUrl && typeof bannerUrl === 'string' && bannerUrl.startsWith('http')) {
        try { galleryItems.push(new MediaGalleryItemBuilder().setURL(bannerUrl).setDescription(shorten(selected.game, 100))); } catch {}
    }
    if (galleryItems.length > 0) {
        try { container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItems)); } catch {}
    }

    // SELECT DROPDOWN WITH PLATFORM EMOJIS
    const menuOptions = [];
    for (const q of allQuests.slice(0, 25)) {
        const hasMobile = Object.keys(q.tasks).some(t => t.includes('MOBILE'));
        const pEmoji = hasMobile ? (EMOJI.mobile || '📱') : (EMOJI.desktop || '🖥️');
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(shorten(q.game + ': ' + q.questName, 95))
            .setValue(String(q.id))
            .setDescription(`${q.progress.total}% Complete — Reward: 200 Orbs`)
            .setEmoji(parseEmoji(pEmoji));
        if (String(q.id) === String(selected.id)) opt.setDefault(true);
        menuOptions.push(opt);
    }
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('quest_select')
            .setPlaceholder(shorten(selected.game + ': ' + selected.questName, 100))
            .addOptions(menuOptions)
    ));

    // CONTROL BUTTONS
    const isRunning = customLogs && String(customLogs).toLowerCase().includes('fast mode');
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel('Start Task').setEmoji(parseEmoji(EMOJI.success || '▶️')).setStyle(isRunning ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(isRunning),
        new ButtonBuilder().setCustomId('quest_stop_' + selected.id).setLabel('Stop Task').setEmoji(parseEmoji(EMOJI.error || '⏹️')).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh UI').setEmoji(parseEmoji(EMOJI.loading || '🔄')).setStyle(ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('View Quest on Discord').setEmoji(parseEmoji(EMOJI.links || '🔗')).setStyle(ButtonStyle.Link).setURL(`https://discord.com/quests/${selected.id}`)
    ));

    // LOGS PANEL
    const logsContainer = new ContainerBuilder().setAccentColor(ACCENT);
    logsContainer.addTextDisplayComponents(text(`### ${EMOJI.list || '📋'} ${selected.game} Solver Status Logs`));
    const now = new Date();
    const tStr = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    let rawLog = customLogs || `Quest initialized.\n[${tStr(now)}] Real-time monitoring active.\n[${tStr(now)}] Current Progress -> ${selected.questName} [${selected.progress.total}%] [${progressBar(selected.progress.total)}]`;
    logsContainer.addTextDisplayComponents(text('```prolog\n' + String(rawLog).slice(0, 900) + '\n```'));

    return { components: [container, logsContainer], flags: MessageFlags.IsComponentsV2 };
}
