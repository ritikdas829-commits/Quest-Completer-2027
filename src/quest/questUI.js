
/**
 * questUI.js — FINAL CUSTOM EMOJI SETUP + PHOTO GUARANTEED
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
// 🎯 YOUR CUSTOM EMOJIS - MAPPED BY USE
// ==========================================
const EMOJI = {
    list: "<:list:1562284923870650570>",
    links: "<a:links:1562284922058834052>",
    emoji_15: "<a:emoji_15:1561626842539229235>",
    qdiamond: "<:qdiamond:1561994071302479913>",
    loading: "<a:SA_CH_IconLoading:1561693801209274368>",
    orbs: "<:orbs:1551629656946507837>",
    announce: "<a:announce:1486435765838942289>",
    s_admin: "<a:s_admin:1561693808670806067>",
    online: "<a:online:1561693806846410842>",
    gift: "<:GO_RedGiveaway:1561693805428740236>",
    warn: "<:Warn:1561693802412900394>",
    arrow: "<a:arrow_53:1551629637535408259>",
    dot: "<a:spider_red_dot:1562113229251936396>",
};

// Helper: Safely parse custom emoji for Buttons & Menus
function parseEmoji(emojiStr) {
    if (!emojiStr) return { name: '💎' };
    const match = emojiStr.match(/<a?:(\w+):(\d+)>/);
    if (match) {
        return { name: match[1], id: match[2], animated: emojiStr.startsWith('<a:') };
    }
    return { name: emojiStr };
}

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
    if (status.stream_progress_seconds != null) current = Math.max(current, Number(status.stream_progress_seconds)||0);
    if (status.video_progress_seconds != null) current = Math.max(current, Number(status.video_progress_seconds)||0);
    return Math.min(100, Math.floor((current / target) * 100));
}

function getQuestImages(quest) {
    const data = quest?.toJSON?.() ?? {};
    const config = quest?.config ?? data.config ?? {};
    const assets = config.assets ?? {};
    const app = quest?.application ?? config.application ?? {};
    const appId = app.id || config.application_id || config.application?.id;

    let bannerUrl = null;
    const direct = [data.bannerURL, data.bannerUrl, data.banner_url, config.banner_url, assets.hero, assets.game_tile, assets.quest_tile].find(u => typeof u === 'string' && u.startsWith('https://') && !/\.mp4/i.test(u));
    if (direct) bannerUrl = direct;

    if (!bannerUrl && appId) {
        const keys = ['hero', 'game_tile', 'quest_tile', 'quest_bar', 'card', 'thumbnail'];
        for (const k of keys) {
            const v = assets[k];
            if (!v) continue;
            let s = String(v).trim();
            if (s.startsWith('https://') && !/\.mp4/i.test(s)) { bannerUrl = s; break; }
            let filename = s.split('/').pop().replace(/\.mp4$/i, '.png');
            if (!/\.(png|jpe?g|webp)$/i.test(filename)) filename += '.png';
            bannerUrl = `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${filename}`;
            break;
        }
    }

    let iconUrl = null;
    const rawIcon = app.icon || config.icon || app.icon_hash;
    if (typeof rawIcon === 'string' && rawIcon.trim() !== '') {
        const t = rawIcon.trim();
        if (t.startsWith('https://')) iconUrl = t;
        else if (appId) iconUrl = `https://cdn.discordapp.com/app-icons/${appId}/${t.split('/').pop().trim()}.png?size=512`;
    }
    // If banner is video thumbnail that may 404, use icon as fallback
    if (bannerUrl && /hero_video/i.test(bannerUrl) && iconUrl) bannerUrl = iconUrl;
    return { banner: bannerUrl, icon: iconUrl };
}

function formatTimestamp(v) {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'N/A';
    return `<t:${Math.floor(d.getTime()/1000)}:d>`;
}
function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];
    if (!rewards.length) return `200 Orbs ${EMOJI.qdiamond}`;
    return rewards.map(r => r?.orb_quantity ? `${r.orb_quantity} Orbs ${EMOJI.qdiamond}` : r?.messages?.name).join(', ');
}
function shorten(v, max=100){ return String(v??'').slice(0,max); }
function progressBar(p){ const f=Math.round(p/10); return '#'.repeat(f)+'-'.repeat(10-f); }
function text(c){ return new TextDisplayBuilder().setContent(c); }

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId, customLogs) {
    const tokenStore = client.tokenStore;
    if (!tokenStore) {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.warn} Token Store Error`));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }
    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.warn} Token Error`));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }
    if (!active || !token) {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# 🔑 No Active Slot`));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const qc=new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager=await qc.fetchQuests();
        rawQuests=manager.list() ?? [];
    } catch (e) {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# ${EMOJI.warn} Error
`+shorten(String(e.message??e),200)));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(q => { try { return q.id !== EXCLUDED_QUEST_ID && !q.isExpired?.() && !q.isCompleted?.(); } catch { return true; } });

    const allQuests = activeQuests.map(quest => {
        const config=quest.config ?? {};
        const messages=config.messages ?? {};
        const tasks=getTasks(config);
        const status=quest.userStatus ?? {};
        const images=getQuestImages(quest);
        const platformProgress={};
        for (const t of Object.keys(tasks)) platformProgress[t]=getTaskProgress(t,tasks[t],status);
        const seen=new Set(); const uniq=[];
        for (const k of Object.keys(platformProgress)) {
            const base=k.replace(/_\d+$/, '');
            if (!seen.has(base)) { seen.add(base); uniq.push(platformProgress[k]); }
        }
        const total = uniq.length ? Math.max(...uniq) : 0;
        return {
            id:quest.id, game:messages.game_title || config.application?.name || 'Unknown',
            publisher:messages.game_publisher || 'Unknown', questName:messages.quest_name || 'Discord Quest',
            enrolledAt:formatTimestamp(status.enrolled_at), expiresAt:formatTimestamp(config.expires_at),
            rewards:buildRewardText(config), tasks, platformProgress, images, progress:{total}
        };
    });

    if (!allQuests.length) {
        const c=new ContainerBuilder().setAccentColor(ACCENT);
        c.addTextDisplayComponents(text(`# ${EMOJI.list} Quest Solver

No active Quests found.`));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }

    const selected = allQuests.find(q=>String(q.id)===String(selectedQuestId)) ?? allQuests[0];
    const container=new ContainerBuilder().setAccentColor(ACCENT);

    // Header - with s_admin and list
    container.addTextDisplayComponents(text(`# ${EMOJI.s_admin} ${selected.game}`));

    const desktopPct = selected.platformProgress['PLAY_ON_DESKTOP'] ?? selected.platformProgress['WATCH_VIDEO'] ?? selected.platformProgress['WATCH_VIDEO_ON_DESKTOP'] ?? selected.progress.total;
    const mobilePct = selected.platformProgress['WATCH_VIDEO_ON_MOBILE'] ?? selected.platformProgress['PLAY_ON_MOBILE'] ?? selected.progress.total;

    let info = `### ${EMOJI.orbs} Quest Overview
`;
    info += `${EMOJI.gift} **Reward:** ${selected.rewards}
`;
    info += `${EMOJI.emoji_15} **Game:** ${selected.game}
`;
    info += `${EMOJI.list} **Publisher:** ${selected.publisher}
`;
    info += `${EMOJI.online} **Enrolled At:** ${selected.enrolledAt}
`;
    info += `${EMOJI.arrow} **Expires At:** ${selected.expiresAt}

`;
    info += `### ${EMOJI.loading} Live Progress
`;
    const progIcon = selected.progress.total >= 100 ? '✅' : EMOJI.dot;
    info += `${progIcon} **Progress:** \`${selected.progress.total}%\`
`;
    info += `-# ${EMOJI.online} **Web/Desktop**: ${desktopPct}%
`;
    info += `-# ${EMOJI.emoji_15} **Mobile**: ${mobilePct}%
`;

    container.addTextDisplayComponents(text(info));

    const seenT=new Set(); const taskLines=[];
    for (const type of Object.keys(selected.tasks)) {
        const base=type.replace(/_\d+$/, '');
        if (seenT.has(base)) continue;
        seenT.add(base);
        const t=selected.tasks[type];
        if (type.includes('PLAY_ON_DESKTOP')) taskLines.push(`${EMOJI.dot} Play On Desktop for ${Math.ceil((t.target||900)/60)}m`);
        else if (type.includes('WATCH_VIDEO_ON_MOBILE')) taskLines.push(`${EMOJI.dot} Watch Video On Mobile for ${Math.ceil((t.target||0)/60)}m`);
        else if (type.includes('WATCH_VIDEO')) taskLines.push(`${EMOJI.dot} Watch Video On Desktop for ${Math.ceil((t.target||0)/60)}m`);
        else taskLines.push(`${EMOJI.dot} ${type.replace(/_/g,' ')}`);
    }
    container.addTextDisplayComponents(text(`### ${EMOJI.list} Tasks:
${taskLines.join('\n')}`));

    // PHOTO GUARANTEED
    const galleryItems=[];
    const img = selected.images?.banner || selected.images?.icon;
    if (img && img.startsWith('https://')) {
        galleryItems.push(new MediaGalleryItemBuilder().setURL(img).setDescription(selected.game));
    } else {
        galleryItems.push(new MediaGalleryItemBuilder().setURL('https://cdn.discordapp.com/embed/avatars/0.png').setDescription('Quest'));
    }
    try { container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItems)); } catch {}

    // Dropdown with qdiamond
    const menuOptions=[];
    for (const q of allQuests.slice(0,25)) {
        const opt=new StringSelectMenuOptionBuilder().setLabel(shorten(q.game+': '+q.questName,95)).setValue(String(q.id)).setDescription(shorten(`${q.progress.total}% - ${q.rewards}`,100)).setEmoji(parseEmoji(EMOJI.qdiamond));
        if (String(q.id)===String(selected.id)) opt.setDefault(true);
        menuOptions.push(opt);
    }
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('quest_select').setPlaceholder(shorten(selected.game+': '+selected.questName,100)).addOptions(menuOptions)));

    const isRunning = customLogs && String(customLogs).toLowerCase().includes('fast mode');
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_start_'+selected.id).setLabel('Start').setEmoji(parseEmoji('▶️')).setStyle(isRunning?ButtonStyle.Secondary:ButtonStyle.Success).setDisabled(isRunning),
        new ButtonBuilder().setCustomId('quest_stop_'+selected.id).setLabel('Stop').setEmoji(parseEmoji('⏹️')).setStyle(isRunning?ButtonStyle.Danger:ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setEmoji(parseEmoji('🔄')).setStyle(ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setEmoji(parseEmoji(EMOJI.links)).setStyle(ButtonStyle.Link).setURL(`https://discord.com/quests/${selected.id}`)));

    const logsContainer=new ContainerBuilder().setAccentColor(ACCENT);
    logsContainer.addTextDisplayComponents(text(`### ${EMOJI.announce} ${selected.game} Logs`));
    const now=new Date();
    const tStr=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
    let logText=customLogs || `${EMOJI.dot} Quest selected\n[${tStr(now)}] ${EMOJI.loading} Fast mode active\n[${tStr(now)}] ${EMOJI.online} Progress -> ${selected.questName} [${selected.progress.total}%] [${progressBar(selected.progress.total)}]`;
    logsContainer.addTextDisplayComponents(text('```prolog\n'+String(logText).slice(0,900)+'\n```'));

    return { components:[container, logsContainer], flags:MessageFlags.IsComponentsV2, allowedMentions:{parse:[]} };
}
