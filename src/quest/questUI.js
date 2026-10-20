/**
 * questUI.js - 100% Orbie Clone UI + Verified Logic
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
    if (taskType.includes('STREAM') && status.stream_progress_seconds != null) {
        const sp = Number(status.stream_progress_seconds);
        if (Number.isFinite(sp)) current = Math.max(current, sp);
    }
    if (taskType.includes('WATCH_VIDEO') && status.video_progress_seconds != null) {
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
    const appId = app.id || config.application_id;

    // 1. Direct HTTPS (skip mp4)
    let bannerUrl = [
        data.bannerURL, data.bannerUrl, data.banner_url, config.banner_url, config.banner
    ].find(u => typeof u === 'string' && u.startsWith('https://') && !/\.mp4/i.test(u)) ?? null;

    // 2. Fallback - Game quests CDN URL
    if (!bannerUrl && appId) {
        const order = ['hero', 'game_tile', 'quest_tile', 'quest_bar', 'card', 'hero_video'];
        for (const k of order) {
            const v = assets[k];
            if (!v || String(v).trim() === '') continue;
            const s = String(v).trim();
            if (/\.mp4/i.test(s)) continue;
            if (s.startsWith('https://')) { bannerUrl = s; break; }
            let filename = s.split('/').pop();
            if (!/\.(png|jpe?g|webp)$/i.test(filename)) filename += '.png';
            bannerUrl = `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${filename}`;
            break;
        }
    }

    let iconUrl = null;
    const rawIcon = app.icon;
    if (typeof rawIcon === 'string' && rawIcon.trim() !== '') {
        const t = rawIcon.trim();
        if (t.startsWith('https://')) iconUrl = t;
        else if (appId) {
            const hash = t.split('/').pop().trim();
            iconUrl = `https://cdn.discordapp.com/app-icons/${appId}/${hash}.png?size=512`;
        }
    }

    return { banner: bannerUrl, icon: iconUrl };
}

function formatDate(v) {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'N/A';
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];
    if (!rewards.length) return '200 Orbs';
    return rewards.map(r => r?.orb_quantity ? `${r.orb_quantity} Orbs` : (r?.messages?.name || 'Reward')).join(', ');
}

function shorten(v, max=100) { return String(v ?? '').slice(0, max); }
function progressBar(p) { const f=Math.round(p/10); return '#'.repeat(f) + '-'.repeat(10-f); }
function text(c) { return new TextDisplayBuilder().setContent(c); }

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId, customLogs) {
    selectedQuestId ??= null;
    customLogs ??= null;
    const prefix = client.config?.prefix || process.env.PREFIX || ';';
    const tokenStore = client.tokenStore;

    if (!tokenStore) {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text('# ❌ Token Store Error\nToken store not initialized.'));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }
    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text('# ❌ Token Store Error\nCould not load token.'));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }
    if (!active || !token) {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text(`# 🔑 No Active Slot\nUse \`${prefix}link\` to link a token.`));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const qc=new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager=await qc.fetchQuests();
        rawQuests=manager.list() ?? [];
    } catch (e) {
        const c=new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text('# ⚠️ Quest Solver Error\n' + shorten(String(e.message ?? e), 300)));
        return { components:[c], flags:MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(q => {
        try { return q.id !== EXCLUDED_QUEST_ID && !q.isExpired?.() && !q.isCompleted?.(); } catch { return true; }
    });

    const allQuests = activeQuests.map(quest => {
        const config=quest.config ?? {};
        const messages=config.messages ?? {};
        const tasks=getTasks(config);
        const status=quest.userStatus ?? {};
        const images=getQuestImages(quest);
        const platformProgress={};
        for (const t of Object.keys(tasks)) platformProgress[t]=getTaskProgress(t,tasks[t],status);
        
        // FIX: Use MAX instead of Average for precise progress calculation
        const seen=new Set(); const uniq=[];
        for (const k of Object.keys(platformProgress)) {
            const base=k.replace(/_\d+$/, '');
            if (!seen.has(base)) { seen.add(base); uniq.push(platformProgress[k]); }
        }
        const total = uniq.length ? Math.max(...uniq) : 0;
        return {
            id:quest.id, game:messages.game_title || config.application?.name || 'Unknown',
            publisher:messages.game_publisher || 'Unknown', questName:messages.quest_name || 'Discord Quest',
            enrolledAt:formatDate(status.enrolled_at), expiresAt:formatDate(config.expires_at),
            rewards:buildRewardText(config), tasks, platformProgress, images, progress:{total}
        };
    });

    if (!allQuests.length) {
        const c=new ContainerBuilder().setAccentColor(ACCENT);
        c.addTextDisplayComponents(text('## 🏆 Quest Solver\n\nNo active Quests found. Check https://discord.com/quests'));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setEmoji({name:'🔄'}).setStyle(ButtonStyle.Primary)));
        return { components:[c], flags:MessageFlags.IsComponentsV2, allowedMentions:{parse:[]} };
    }

    const selected = allQuests.find(q=>String(q.id)===String(selectedQuestId)) ?? allQuests[0];
    const container=new ContainerBuilder().setAccentColor(ACCENT);

    container.addTextDisplayComponents(text('## 🏆 Quest Solver'));

    const desktopPct = selected.platformProgress['PLAY_ON_DESKTOP'] ?? selected.platformProgress['WATCH_VIDEO'] ?? selected.platformProgress['WATCH_VIDEO_ON_DESKTOP'] ?? selected.platformProgress['STREAM_ON_DESKTOP'] ?? selected.progress.total;
    const mobilePct = selected.platformProgress['WATCH_VIDEO_ON_MOBILE'] ?? selected.platformProgress['PLAY_ON_MOBILE'] ?? selected.platformProgress['WATCH_VIDEO'] ?? 0;
    const hasMobile = Object.keys(selected.platformProgress).some(k=>k.includes('MOBILE'));
    const hasDesktop = !hasMobile || Object.keys(selected.platformProgress).some(k=>k.includes('DESKTOP') || k.includes('WATCH_VIDEO'));

    let info = '';
    info += `• **Game:** ${selected.game}\n`;
    info += `• **Publisher:** ${selected.publisher}\n`;
    info += `• **Quest Name:** ${selected.questName}\n`;
    info += `• **Enrolled At:** ${selected.enrolledAt}\n`;
    info += `• **Expires At:** ${selected.expiresAt}\n`;
    info += `• **Progress:**\n`;
    if (hasMobile && !hasDesktop) {
        info += `🌀 ${selected.progress.total}%\n`;
        info += `📱 **Mobile:** ${mobilePct}%\n`;
    } else if (hasMobile && hasDesktop) {
        info += `🌀 ${selected.progress.total}%\n`;
        info += `💻 **Desktop:** ${desktopPct}%\n`;
        info += `📱 **Mobile:** ${mobilePct}%\n`;
    } else {
        info += `🌀 ${selected.progress.total}%\n`;
        info += `💻 **Desktop:** ${desktopPct}%\n`;
        if (Object.keys(selected.platformProgress).some(k=>k.includes('PLAYSTATION'))) {
            info += `🎮 **PlayStation:** ${selected.platformProgress['PLAY_ON_PLAYSTATION'] ?? 0}%\n`;
        }
    }
    container.addTextDisplayComponents(text(info));

    container.addTextDisplayComponents(text(`### 🎁 Rewards:\n• **${selected.rewards}** 💎`));

    const seenT=new Set(); const taskLines=[];
    for (const type of Object.keys(selected.tasks)) {
        const base=type.replace(/_\d+$/, '');
        if (seenT.has(base)) continue;
        seenT.add(base);
        const t=selected.tasks[type];
        if (type.includes('PLAY_ON_DESKTOP')) taskLines.push(`• Play On Desktop for ${Math.ceil((t.target||900)/60)}m`);
        else if (type.includes('WATCH_VIDEO_ON_MOBILE')) taskLines.push(`• Watch Video On Mobile for ${Math.ceil((t.target||0)/60)}m`);
        else if (type.includes('WATCH_VIDEO')) taskLines.push(`• Watch Video On ${type.includes('MOBILE')?'Mobile':'Desktop'} for ${t.target||0}s`);
        else if (type.includes('PLAY_ON_PLAYSTATION')) taskLines.push(`• Play On Playstation ${t.target||900} times`);
        else taskLines.push(`• ${type.replace(/_/g,' ')}`);
    }
    container.addTextDisplayComponents(text(`### 📋 Tasks:\n${taskLines.join('\n') || '• Play On Desktop for 15m'}`));

    // --- Media Gallery (Banner + Icon Fallback) ---
    const galleryItems=[];
    if (selected.images?.banner && selected.images.banner.startsWith('https://')) {
        galleryItems.push(new MediaGalleryItemBuilder().setURL(selected.images.banner).setDescription(selected.game + ' banner'));
    }
    if (selected.images?.icon && selected.images.icon.startsWith('https://')) {
        if (!selected.images.banner || selected.images.icon !== selected.images.banner) {
            galleryItems.push(new MediaGalleryItemBuilder().setURL(selected.images.icon).setDescription(selected.game + ' icon'));
        }
    }
    if (galleryItems.length>0) {
        try { container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItems)); } catch {}
    }

    const menuOptions=[];
    for (const q of allQuests.slice(0,25)) {
        const opt=new StringSelectMenuOptionBuilder().setLabel(shorten(q.game+': '+q.questName,95)).setValue(String(q.id)).setDescription(shorten(`${q.progress.total}% - ${q.rewards}`,100)).setEmoji({name:'💎'});
        if (String(q.id)===String(selected.id)) opt.setDefault(true);
        menuOptions.push(opt);
    }
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('quest_select').setPlaceholder(shorten(selected.game+': '+selected.questName,100)).addOptions(menuOptions)));

    const isRunning = customLogs && String(customLogs).toLowerCase().includes('fast mode');
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_start_'+selected.id).setLabel('Start').setEmoji({name:'▶️'}).setStyle(isRunning?ButtonStyle.Secondary:ButtonStyle.Success).setDisabled(isRunning?true:false),
        new ButtonBuilder().setCustomId('quest_stop_'+selected.id).setLabel('Stop').setEmoji({name:'⏹️'}).setStyle(isRunning?ButtonStyle.Danger:ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setEmoji({name:'🔄'}).setStyle(ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setEmoji({name:'🔗'}).setStyle(ButtonStyle.Link).setURL(`https://discord.com/quests/${selected.id}`)));

    const logsContainer=new ContainerBuilder().setAccentColor(ACCENT);
    logsContainer.addTextDisplayComponents(text('## 📝 Quest Logs'));
    const now=new Date();
    const tStr=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
    let logText=customLogs;
    if (!logText) {
        logText=`🧭 Quest selected\n[${tStr(now)}] ⚡ Fast mode active\n[${tStr(now)}] 📈 Progress -> ${selected.questName} [${selected.progress.total}%] [${progressBar(selected.progress.total)}]`;
    }
    logsContainer.addTextDisplayComponents(text('```\n' + String(logText).slice(0,900) + '\n```'));

    return { components:[container, logsContainer], flags:MessageFlags.IsComponentsV2, allowedMentions:{parse:[]} };
}
