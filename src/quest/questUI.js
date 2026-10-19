/**
 * questUI.js — Quest Solver Dashboard (Filtered Active Quests Only)
 * Location: src/quest/questUI.js
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';

import { QuestClient } from './questClient.js';

function getTasks(config) {
    return (
        config?.task_config?.tasks ??
        config?.task_config_v2?.tasks ??
        {}
    );
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
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = typeof candidate === 'object' ? candidate.value ?? candidate.progress : candidate;
        const number = Number(value);
        if (Number.isFinite(number)) {
            current = Math.max(0, number);
            break;
        }
    }
    return Math.min(100, Math.floor((current / target) * 100));
}

function getBannerUrl(config) {
    const applicationId = config?.application?.id || config?.application_id || config?.applicationId;
    const assets = config?.assets ?? {};
    const rawAsset = assets.hero || assets.hero_video || assets.game_tile || assets.quest_tile || assets.game_tile_video || assets.quest_bar || assets.card || Object.values(assets)[0];

    if (!applicationId || !rawAsset) return null;
    const asset = String(rawAsset).trim();
    if (!asset) return null;

    const filename = /\.(png|jpe?g|webp|gif)$/i.test(asset) ? asset : `${asset}.png`;
    return `https://cdn.discordapp.com/app-assets/${applicationId}/quest-assets/${filename}`;
}

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
}

function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];
    if (!rewards.length) return 'Quest Reward';
    return rewards.map((reward) => {
        const name = reward?.messages?.name || 'Reward';
        return reward?.orb_quantity ? `${name} (${reward.orb_quantity} Orbs)` : name;
    }).join(', ');
}

function shorten(value, max = 100) {
    return String(value ?? '').slice(0, max);
}

function formatTaskDuration(type, task) {
    const target = task?.target ?? 0;
    const TASK_NAMES = {
        PLAY_ON_DESKTOP: 'Play On Desktop',
        PLAY_ON_XBOX: 'Play On Xbox',
        PLAY_ON_PLAYSTATION: 'Play On PlayStation',
        WATCH_VIDEO: 'Watch Video',
        STREAM_ON_DESKTOP: 'Stream On Desktop',
        PLAY_ACTIVITY: 'Play Activity',
        WATCH_VIDEO_ON_MOBILE: 'Watch Video On Mobile',
    };
    const label = TASK_NAMES[type] ?? type;
    if (type.includes('VIDEO')) {
        return `${label} for${target}s`;
    } else if (type.includes('DESKTOP') || type.includes('PLAY')) {
        const mins = Math.ceil(target / 60);
        return mins > 1 ? `${label} for${mins}m` : `${label} for${target}s`;
    }
    return `${label} (${target}s)`;
}

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId = null, customLogs = null) {
    const prefix = client.config?.prefix || process.env.PREFIX || ';';
    const tokenStore = client.tokenStore;

    if (!tokenStore) {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ❌ Token Store Error\nToken store is not initialized.'));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ❌ Token Store Error\nCould not load token.'));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    if (!active || !token) {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ No Active Slot\nUse \`${prefix}link\` to link a token.`));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const questClient = new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager = await questClient.fetchQuests();
        rawQuests = manager.list() ?? [];
    } catch (error) {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Quest Fetch Error\n${shorten(error.message, 250)}`));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    // ── Filter Out Completed / Expired Quests (Only Active To-Do Quests) ──
    const activeQuests = rawQuests.filter((quest) => {
        const isComp = quest.isCompleted?.() ?? false;
        const isExp = quest.isExpired?.() ?? false;
        return !isComp && !isExp;
    });

    const allQuests = activeQuests.map((quest) => {
        const config = quest.config ?? {};
        const messages = config.messages ?? {};
        const tasks = getTasks(config);
        const status = quest.userStatus ?? {};
        
        const platformProgress = {};
        for (const [taskType, taskConfig] of Object.entries(tasks)) {
            platformProgress[taskType] = getTaskProgress(taskType, taskConfig, status);
        }

        const percentages = Object.values(platformProgress);
        const overallProgress = percentages.length 
            ? Math.floor(percentages.reduce((a, b) => a + b, 0) / percentages.length) 
            : 0;

        return {
            id: quest.id,
            game: messages.game_title || config.application?.name || 'Unknown Game',
            publisher: messages.game_publisher || 'Unknown Publisher',
            questName: messages.quest_name || 'Discord Quest',
            enrolledAt: formatDate(status.enrolled_at),
            expiresAt: formatDate(config.expires_at),
            rewards: buildRewardText(config),
            tasks,
            platformProgress,
            banner: getBannerUrl(config),
            url: 'https://discord.com/quests',
            progress: { total: overallProgress },
            sourceQuest: quest,
        };
    });

    if (!allQuests.length) {
        const container = new ContainerBuilder().setAccentColor(0x4F545C);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# 🔍 No Active Quests\nThere are no pending active quests on this account.')
        );
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    const selected = allQuests.find((q) => q.id === selectedQuestId) ?? allQuests[0];
    const container = new ContainerBuilder().setAccentColor(0x5865F2);

    const TASK_LABELS = {
        PLAY_ON_DESKTOP: { icon: '🖥️', label: 'Desktop' },
        PLAY_ON_XBOX: { icon: '🟩', label: 'Xbox' },
        PLAY_ON_PLAYSTATION: { icon: '🟦', label: 'PlayStation' },
        WATCH_VIDEO: { icon: '🎬', label: 'Video' },
        WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Mobile' },
    };

    let progressDetails = `📊 **${selected.progress.total}%**`;
    const breakdown = Object.entries(selected.platformProgress).map(([taskType, pct]) => {
        const meta = TASK_LABELS[taskType] ?? { icon: '⚙️', label: taskType };
        return `• ${meta.icon} **${meta.label}:**${pct}%`;
    });

    if (breakdown.length) {
        progressDetails += '\n' + breakdown.join('\n');
    }

    const taskLines = Object.entries(selected.tasks).length
        ? Object.entries(selected.tasks).map(([type, task]) => `• ${formatTaskDuration(type, task)}`).join('\n')
        : '• No task details available';

    const contentText =
        `• **Game:** ${selected.game}\n` +
        `• **Publisher:** ${selected.publisher}\n` +
        `• **Quest Name:** ${selected.questName}\n` +
        `• **Enrolled At:** ${selected.enrolledAt}\n` +
        `• **Expires At:** ${selected.expiresAt}\n` +
        `• **Progress:**\n${progressDetails}\n\n` +
        `## 🎁 Rewards\n• ${selected.rewards}\n\n` +
        `## 📋 Tasks\n${taskLines}`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🔮 Quest Solver'));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const mainSection = new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(contentText)
    );

    if (selected.banner) {
        mainSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(selected.banner));
    }

    container.addSectionComponents(mainSection);

    const menuOptions = allQuests.slice(0, 25).map((q) => {
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(shorten(`${q.game}:${q.questName}`, 100))
            .setValue(q.id)
            .setDescription(shorten(q.rewards || 'Reward', 100))
            .setEmoji('🎯');
        if (q.id === selected.id) opt.setDefault(true);
        return opt;
    });

    const menu = new StringSelectMenuBuilder().setCustomId('quest_select').setPlaceholder('Pick an active quest...').addOptions(menuOptions);
    container.addActionRowComponents(new ActionRowBuilder().addComponents(menu));

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`quest_start_${selected.id}`).setLabel('Start').setStyle(ButtonStyle.Success).setEmoji('▶️'),
            new ButtonBuilder().setCustomId(`quest_stop_${selected.id}`).setLabel('Stop').setStyle(ButtonStyle.Secondary).setEmoji('⏹️'),
            new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        )
    );

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('View Quest').setStyle(ButtonStyle.Link).setURL(selected.url).setEmoji('🔗')
        )
    );

    const safeLogs = String(customLogs ?? `🧭 Quest selected: ${selected.questName}\n📝 Status: Ready to run`).slice(0, 1500);
    const logsContainer = new ContainerBuilder().setAccentColor(0x2B2D31);
    logsContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 📄 Quest Logs'),
        new TextDisplayBuilder().setContent(`\`\`\`text\n${safeLogs}\n\`\`\``)
    );

    return {
        components: [container, logsContainer],
        flags: MessageFlags.IsComponentsV2,
    };
}
