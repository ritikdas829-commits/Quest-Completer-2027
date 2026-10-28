/**
 * questUI.js — Official Quests CDN Banner, Dynamic Button Emojis & Cooldown State
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
import { PREFIX } from '../utils/config.js';
import { checkActivityCooldown } from './suspiciousActivity.js';

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

// 🎯 OFFICIAL QUESTS CDN BANNER RESOLVER
function getQuestImages(quest) {
    const data = quest?.toJSON?.() ?? {};
    const config = quest?.config ?? data.config ?? {};
    const assets = config.assets ?? {};
    const questId = quest?.id || data.id;

    let banner = null;

    const keys = ['hero', 'quest_bar_hero', 'game_tile', 'logotype', 'banner'];
    for (const key of keys) {
        const raw = assets[key] || config[key];
        if (!raw || typeof raw !== 'string') continue;
        let asset = raw.trim();
        if (!asset) continue;

        if (asset.startsWith('http')) {
            banner = asset;
            break;
        }

        if (asset.startsWith('quests/')) {
            banner = `https://cdn.discordapp.com/${asset}`;
            break;
        }

        if (questId) {
            banner = `https://cdn.discordapp.com/quests/${questId}/${asset}`;
            break;
        }
    }

    let icon = null;
    const app = quest?.application || config.application || data.application || {};
    const appId = app.id || config.application_id;
    const rawIcon = app.icon || config.icon;
    if (rawIcon && appId) {
        icon = rawIcon.startsWith('http')
            ? rawIcon
            : `https://cdn.discordapp.com/app-icons/${appId}/${rawIcon}.png?size=512`;
    }

    return { banner, icon };
}

function formatTimestamp(v) { if (!v) return 'N/A'; const d = new Date(v); if (isNaN(d.getTime())) return 'N/A'; return `<t:${Math.floor(d.getTime() / 1000)}:d>`; }
function shorten(v, max = 100) { return String(v ?? '').slice(0, max); }
function progressBar(p) { const f = Math.round(p / 10); return '█'.repeat(f) + '░'.repeat(10 - f); }
function text(c) { return new TextDisplayBuilder().setContent(c); }

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId, customLogs, isTaskActive = false) {
    const EMOJI = await getEmojis(guildId);

    // 🛑 COOLDOWN & SECURITY CHECK
    const cooldown = checkActivityCooldown(userId);
    if (cooldown.active) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(
            `### ${EMOJI.error || '❌'} Security Cooldown Active\n` +
            `\`\`\`prolog\n` +
            `[SECURITY] Account temporarily locked due to activity safety.\n` +
            `[STATUS] Cooldown remaining: ~${cooldown.remaining} hours.\n` +
            `[INFO] Please wait until the activity restriction lifts to avoid account flags.\n` +
            `\`\`\``
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const tokenStore = client.tokenStore;
    if (!tokenStore) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.error || '❌'} Token System Unreachable`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    let active, rawToken;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        rawToken = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch (err) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.warn || '⚠️'} Database Read Failure`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    if (!active || !rawToken) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`### ${EMOJI.link || '🔑'} No Active Discord Account Linked\nPlease use \`${PREFIX}link\`.`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    // Clean token string thoroughly (remove quotes, spaces, newlines)
    const token = String(rawToken).trim().replace(/^['"]+|['"]+$/g, '').replace(/\s+/g, '');

    let rawQuests;
    try {
        const qc = new QuestClient(token);
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() ?? [];
    } catch (e) {
        console.error("Quest Fetch Error:", e);
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        let errorDesc = "Failed to fetch quest details due to timeout or network delay.";
        
        // Strict check: only show auth error if status is explicitly 401/403
        if (e.status === 401 || e.status === 403 || (e.message && (e.message.includes('401') || e.message.includes('403') || e.message.includes('Unauthorized')))) {
            errorDesc = `Your Discord token is **expired or invalid**.\nPlease re-link using \`${PREFIX}link\`.`;
        } else {
            errorDesc = `Failed to connect to Discord API: ${e.message || 'Unknown network error'}\nPlease try again later.`;
        }

        c.addTextDisplayComponents(text(
            `### ${EMOJI.error || '❌'} Quest Fetch Error\n` +
            `\`\`\`prolog\n[ERROR] ${errorDesc}\n\`\`\``
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(q => {
        try { return q.id !== EXCLUDED_QUEST_ID && !q.isExpired?.() && !q.isCompleted?.(); } catch { return true; }
    });

    const allQuests = activeQuests.map(quest => {
        const config = quest.config ?? {}, messages = config.messages ?? {}, tasks = getTasks(config), status = quest.userStatus ?? {}, images = getQuestImages(quest);
        const platformProgress = {};
        for (const t of Object.keys(tasks)) platformProgress[t] = getTaskProgress(t, tasks[t], status);
        
        const desktopKeys = Object.keys(platformProgress).filter(k => !k.includes('MOBILE'));
        const mobileKeys = Object.keys(platformProgress).filter(k => k.includes('MOBILE'));

        const desktopTotal = desktopKeys.length ? Math.max(...desktopKeys.map(k => platformProgress[k])) : 0;
        const mobileTotal = mobileKeys.length ? Math.max(...mobileKeys.map(k => platformProgress[k])) : 0;
        const total = Math.max(desktopTotal, mobileTotal);

        const rewardsList = config.rewards_config?.rewards ?? [];
        const rewardTexts = rewardsList.map(r => {
            const rName = r.messages?.name || 'Reward';
            if (r.orb_quantity) return `${r.orb_quantity} Orbs`;
            if (r.quantity) return `${r.quantity}d Nitro`;
            return rName;
        });
        const rewardSummary = rewardTexts.length ? rewardTexts.join(', ') : 'Exclusive Reward';

        return { 
            id: quest.id, 
            game: messages.game_title || config.application?.name || 'Unknown Game', 
            publisher: messages.game_publisher || 'Unknown Publisher', 
            questName: messages.quest_name || 'Discord Quest', 
            enrolledAt: formatTimestamp(status.enrolled_at), 
            expiresAt: formatTimestamp(config.expires_at), 
            tasks, 
            platformProgress: { desktop: desktopTotal, mobile: mobileTotal }, 
            images, 
            progress: { total },
            rewardSummary 
        };
    });

    // 🛑 PROFESSIONAL NO QUESTS EMPTY STATE
    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(ACCENT);
        c.addTextDisplayComponents(text(
            `# ${EMOJI.search || '🔍'} No Quests Available\n\n` +
            `${EMOJI.list || '📑'} There are no active, uncompleted quests on your account right now.\n\n` +
            `${EMOJI.gear || '⚙️'} New quests drop periodically — check back later!\n\n` +
            `-# ${EMOJI.bell || '🔔'} Use \`${PREFIX}autoquest\` to auto-complete quests when they drop`
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const selected = allQuests.find(q => String(q.id) === String(selectedQuestId)) ?? allQuests[0];
    const container = new ContainerBuilder().setAccentColor(ACCENT);
    container.addTextDisplayComponents(text(`# ${EMOJI.s_admin || '🛠️'} ${selected.game}`));

    let info = `### ${EMOJI.orbs || '✨'} Quest Overview\n`;
    info += `${EMOJI.gift || '🎁'} **Reward:** ${selected.rewardSummary} ${EMOJI.orbs || '✨'}\n`;
    info += `${EMOJI.online || '🟢'} **Game:** ${selected.game}\n`;
    info += `${EMOJI.list || '📋'} **Publisher:** ${selected.publisher}\n`;
    info += `${EMOJI.expire || '📅'} **Enrolled At:** ${selected.enrolledAt}\n`;
    info += `${EMOJI.arrow || '➡️'} **Expires At:** ${selected.expiresAt}\n\n`;
    info += `### ${EMOJI.stats || '📊'} Live Progress\n`;
    const progIcon = selected.progress.total >= 100 ? (EMOJI.success || '✅') : (EMOJI.loading || '⏳');
    info += `${progIcon} **Progress:** \`${selected.progress.total}%\` \`${progressBar(selected.progress.total)}\`\n`;
    info += `-# ${EMOJI.desktop || '🖥️'} **Web/Desktop**: ${selected.platformProgress.desktop}%\n`;
    info += `-# ${EMOJI.mobile || '📱'} **Mobile**: ${selected.platformProgress.mobile}%\n`;
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

    // BANNER
    const bannerUrl = selected.images?.banner;
    const isRealBanner = bannerUrl && bannerUrl.startsWith('https://');
    if (isRealBanner) {
        try { 
            const gallery = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl));
            container.addMediaGalleryComponents(gallery); 
        } catch {}
    }

    // SELECT DROPDOWN WITH EMOJI PARSING
    const menuOptions = [];
    for (const q of allQuests.slice(0, 25)) {
        const hasMobile = Object.keys(q.tasks).some(t => t.includes('MOBILE'));
        const pEmoji = hasMobile ? (EMOJI.mobile || '📱') : (EMOJI.desktop || '🖥️');
        const pLabelPrefix = hasMobile ? '[Mobile] ' : '[Desktop] ';
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(shorten(pLabelPrefix + q.game + ': ' + q.questName, 95))
            .setValue(String(q.id))
            .setDescription(`${q.progress.total}% Complete — Reward: ${q.rewardSummary}`)
            .setEmoji(parseEmoji(pEmoji));
        if (String(q.id) === String(selected.id)) opt.setDefault(true);
        menuOptions.push(opt);
    }
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('quest_select').setPlaceholder(shorten(selected.game + ': ' + selected.questName, 100)).addOptions(menuOptions)
    ));

    // 4 BUTTONS LAYOUT WITH DYNAMIC EMOJIS & ACTIVITY STATUS
    const running = isTaskActive || (customLogs && customLogs.toLowerCase().includes('fast mode') && selected.progress.total < 100);
    
    const startEmoji = parseEmoji(EMOJI.play || '▶️');
    const stopEmoji = parseEmoji(EMOJI.stop || '⏹️');
    const refreshEmoji = parseEmoji(EMOJI.refresh || '🔄');
    const viewEmoji = parseEmoji(EMOJI.link || '🔗');

    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quest_start_' + selected.id)
            .setLabel(running ? 'Activity Active (Cooldown)' : 'Start Task')
            .setEmoji(startEmoji)
            .setStyle(running ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(!!running),
        new ButtonBuilder()
            .setCustomId('quest_stop_' + selected.id)
            .setLabel('Stop Task')
            .setEmoji(stopEmoji)
            .setStyle(ButtonStyle.Danger)
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quest_refresh')
            .setLabel('Refresh UI')
            .setEmoji(refreshEmoji)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel(`View ${selected.game} Quest on Discord`)
            .setEmoji(viewEmoji)
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/quests/${selected.id}`)
    ));

    // LOGS
    const logsContainer = new ContainerBuilder().setAccentColor(ACCENT);
    logsContainer.addTextDisplayComponents(text(`### ${EMOJI.list || '📋'} ${selected.game} Solver Status Logs`));
    const now = new Date();
    const tStr = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    let rawLog = customLogs || `Quest initialized.\n[${tStr(now)}] Real-time monitoring active.\n[${tStr(now)}] Current Progress -> ${selected.questName} [${selected.progress.total}%] [${progressBar(selected.progress.total)}]`;
    const cleanedLogs = String(rawLog).split('\n').filter(line => !line.includes('[INFO]') && !line.includes('task keys =') && !line.includes('using task type')).join('\n');
    logsContainer.addTextDisplayComponents(text('```prolog\n' + cleanedLogs.slice(0, 900) + '\n```'));

    return { components: [container, logsContainer], flags: MessageFlags.IsComponentsV2 };
}
