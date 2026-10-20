/**
 * questUI.js — Final Optimized Edition with Corrected Quest CDN Banners
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
    if (taskType === 'STREAM_ON_DESKTOP' && status.stream_progress_seconds != null) {
        const sp = Number(status.stream_progress_seconds);
        if (Number.isFinite(sp)) current = Math.max(current, sp);
    }
    return Math.min(100, Math.floor((current / target) * 100));
}

function getBannerUrl(quest) {
    const config = quest?.config ?? {};
    const assets = config?.assets ?? {};
    
    const direct = quest?.bannerURL || quest?.bannerUrl || quest?.banner_url || config?.banner_url || config?.banner;
    if (direct && typeof direct === 'string' && /^https:\/\/\S+/i.test(direct)) {
        return direct;
    }

    const assetKeys = ['hero', 'hero_video', 'quest_bar_hero', 'quest_tile', 'game_tile', 'quest_bar', 'quest_home', 'card', 'splash'];
    let raw = null;
    for (const key of assetKeys) {
        if (assets[key] && String(assets[key]).trim() !== '') {
            raw = assets[key];
            break;
        }
    }

    if (!raw) {
        const vals = Object.values(assets).filter(v => v && typeof v === 'string' && v.trim() !== '');
        if (vals.length) raw = vals[0];
    }

    if (!raw) return null;
    const asset = String(raw).trim();
    if (!asset) return null;

    if (/^https:\/\/\S+/i.test(asset)) return asset;

    if (quest?.id) {
        const filename = /\.(png|jpe?g|webp|gif|mp4)$/i.test(asset) ? asset : `${asset}.png`;
        return `https://cdn.discordapp.com/quest-assets/${quest.id}/${filename}`;
    }

    return null;
}

function formatDate(v) {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'N/A';
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];
    if (!rewards.length) return '700 Orbs';
    return rewards.map(r => r?.orb_quantity ? `${r.orb_quantity} Orbs` : (r?.messages?.name || 'Reward')).join(', ');
}

function shorten(v, max) { 
    if (max === undefined) max = 100;
    return String(v ?? '').slice(0, max); 
}

function progressBar(p) { 
    const f = Math.round(p / 10); 
    let a = '';
    for(let i=0;i<f;i++) a+='#';
    let b = '';
    for(let i=0;i<10-f;i++) b+='-';
    return a+b;
}

function text(c) { 
    return new TextDisplayBuilder().setContent(c); 
}

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId, customLogs) {
    if (selectedQuestId === undefined) selectedQuestId = null;
    if (customLogs === undefined) customLogs = null;
    const prefix = client.config?.prefix || process.env.PREFIX || ';';
    const tokenStore = client.tokenStore;

    if (!tokenStore) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text('# Token Store Error\nToken store not initialized.'));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text('# Token Store Error\nCould not load token.'));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    if (!active || !token) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(text('# No Active Slot\nUse `' + prefix + 'link` to link a token.'));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const qc = new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() ?? [];
    } catch (error) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        const raw = String(error?.message ?? error);
        let msg = raw;
        if (raw.includes('401') || raw.toLowerCase().includes('unauthorized')) {
            msg = 'Token Expired! Use `' + prefix + 'link` to relink.';
        }
        c.addTextDisplayComponents(text('# Quest Solver Error\n' + shorten(msg, 300)));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(q => {
        try { return !q.isExpired?.(); } catch { return true; }
    });

    const allQuests = activeQuests.map(quest => {
        const config = quest.config ?? {};
        const messages = config.messages ?? {};
        const tasks = getTasks(config);
        const status = quest.userStatus ?? {};
        const platformProgress = {};
        for (const t of Object.keys(tasks)) {
            platformProgress[t] = getTaskProgress(t, tasks[t], status);
        }
        const perc = Object.values(platformProgress);
        const total = perc.length ? Math.floor(perc.reduce((a, b) => a + b, 0) / perc.length) : 0;
        return {
            id: quest.id,
            game: messages.game_title || config.application?.name || 'Unknown Game',
            publisher: messages.game_publisher || 'Unknown',
            questName: messages.quest_name || 'Discord Quest',
            enrolledAt: formatDate(status.enrolled_at),
            expiresAt: formatDate(config.expires_at),
            rewards: buildRewardText(config),
            tasks,
            platformProgress,
            banner: getBannerUrl(quest),
            progress: { total },
            isCompleted: (()=>{ try { return quest.isCompleted?.() ?? false; } catch { return false; } })(),
        };
    });

    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(ACCENT);
        c.addTextDisplayComponents(text('## Quest Solver\n\nNo Quests found. Check https://discord.com/quests'));
        c.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary)));
        c.addTextDisplayComponents(text('```\nNo quests\n```'));
        return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }

    const selected = allQuests.find(q => String(q.id) === String(selectedQuestId)) ?? allQuests[0];

    const container = new ContainerBuilder().setAccentColor(ACCENT);
    container.addTextDisplayComponents(text('## Quest Solver'));

    const isCompleted = selected.progress.total >= 100;
    const progressIcon = isCompleted ? '[Done]' : '[Active]';
    const desktopPct = selected.platformProgress['PLAY_ON_DESKTOP'] ?? selected.platformProgress['WATCH_VIDEO'] ?? selected.platformProgress['STREAM_ON_DESKTOP'] ?? 0;
    const playstationPct = selected.platformProgress['PLAY_ON_PLAYSTATION'] ?? 0;
    const hasPlaystation = Object.keys(selected.platformProgress).some(k => k.includes('PLAYSTATION'));

    let progressSection = '';
    progressSection += 'Game: ' + selected.game + '\n';
    progressSection += 'Publisher: ' + selected.publisher + '\n';
    progressSection += 'Quest Name: ' + selected.questName + '\n';
    progressSection += 'Enrolled At: ' + selected.enrolledAt + '\n';
    progressSection += 'Expires At: ' + selected.expiresAt + '\n';
    progressSection += 'Progress: ' + progressIcon + ' ' + selected.progress.total + '%\n';
    progressSection += 'Desktop: ' + desktopPct + '%\n';
    if (hasPlaystation) progressSection += 'PlayStation: ' + playstationPct + '%\n';

    container.addTextDisplayComponents(text(progressSection));
    container.addTextDisplayComponents(text('Rewards: ' + selected.rewards));

    const taskLines = Object.keys(selected.tasks).map(type => {
        const t = selected.tasks[type];
        if (type === 'PLAY_ON_DESKTOP') return '- Play On Desktop for ' + Math.ceil((t.target || 900) / 60) + 'm';
        if (type === 'PLAY_ON_PLAYSTATION') return '- Play On Playstation ' + (t.target || 900) + ' times';
        if (type === 'PLAY_ON_XBOX') return '- Play On Xbox ' + (t.target || 900) + ' times';
        if (type.indexOf('WATCH_VIDEO') !== -1) return '- Watch Video for ' + (t.target || 0) + 's to win ' + selected.rewards;
        return '- ' + type.replace(/_/g, ' ');
    }).join('\n');

    container.addTextDisplayComponents(text('Tasks:\n' + (taskLines || '- Play On Desktop for 15m')));

    if (selected.banner && selected.banner.startsWith('https://')) {
        try {
            container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(selected.banner).setDescription(selected.game + ' banner')));
        } catch {}
    }

    const menuOptions = [];
    for (const q of allQuests.slice(0, 25)) {
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(shorten(q.game + ': ' + q.questName, 95))
            .setValue(String(q.id))
            .setDescription(shorten(q.progress.total + '% - ' + q.rewards, 100));
        if (String(q.id) === String(selected.id)) {
            opt.setDefault(true);
        }
        menuOptions.push(opt);
    }

    container.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('quest_select').setPlaceholder(shorten(selected.game + ': ' + selected.questName, 100)).addOptions(menuOptions)));

    const isRunning = customLogs && String(customLogs).toLowerCase().indexOf('fast mode') !== -1;
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel('Start').setStyle(isRunning ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(isRunning ? true : false),
        new ButtonBuilder().setCustomId('quest_stop_' + selected.id).setLabel('Stop').setStyle(isRunning ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
    ));

    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setStyle(ButtonStyle.Link).setURL('https://discord.com/quests')));

    const logsContainer = new ContainerBuilder().setAccentColor(ACCENT);
    logsContainer.addTextDisplayComponents(text('Quest Logs'));

    const now = new Date();
    const tStr = function(d) { return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'); };
    let logText = customLogs;
    if (!logText) {
        if (isCompleted) {
            logText = 'Quest selected\nEnrolled\n[' + tStr(new Date(now - 900000)) + '] Fast mode active\n[' + tStr(now) + '] Quest completed! [' + selected.progress.total + '%] [' + progressBar(selected.progress.total) + ']';
        } else {
            logText = 'Quest selected\n[' + tStr(new Date(now - 360000)) + '] Fast mode active\n[' + tStr(now) + '] Progress -> ' + selected.questName + ' [' + selected.progress.total + '%] [' + progressBar(selected.progress.total) + ']';
        }
    }

    logsContainer.addTextDisplayComponents(text('```\n' + String(logText).slice(0, 900) + '\n```'));

    return {
        components: [container, logsContainer],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] }
    };
}
