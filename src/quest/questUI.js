/**
 * questUI.js — Premium Neon Purple Quest Solver Dashboard
 * Final Optimized Edition: Fixed Banners, Clean Select Menu, Progress in Logs, User-Friendly Errors
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';

import { QuestClient } from './questClient.js';

const PURPLE = 0x9B4DFF;

const icons = {
    game: '✦',
    publisher: '👤',
    quest: '📋',
    enrolled: '🔎',
    expires: '🔥',
    progress: '◌',
    desktop: '🖥️',
    mobile: '📱',
    xbox: '🟢',
    playstation: '🔵',
    rewards: '💎',
    tasks: '🔗',
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

    if (taskType === 'STREAM_ON_DESKTOP' && status.stream_progress_seconds != null) {
        const sp = Number(status.stream_progress_seconds);
        if (Number.isFinite(sp)) current = Math.max(current, sp);
    }

    return Math.min(100, Math.floor((current / target) * 100));
}

function getBannerUrl(quest) {
    const config = quest?.config ?? {};
    const appId = config?.application?.id || config?.application_id || config?.applicationId;
    const assets = config?.assets ?? {};

    const directUrl = 
        quest?.bannerURL ?? 
        quest?.bannerUrl ?? 
        quest?.banner_url ?? 
        quest?.imageURL ?? 
        quest?.imageUrl ?? 
        config?.banner ?? 
        config?.hero;

    if (directUrl && typeof directUrl === 'string' && /^https:\/\/\S+/i.test(directUrl)) {
        return directUrl;
    }

    const assetValues = Object.values(assets);
    const raw = assets.hero || assets.hero_video || assets.quest_tile || assets.game_tile || assets.game_tile_video || assets.quest_bar || assets.card || assets.quest_home || assetValues[0];

    if (!raw) return null;
    const asset = String(raw).trim();
    if (!asset) return null;

    if (/^https:\/\/\S+/i.test(asset)) {
        return asset;
    }

    if (appId) {
        const filename = /\.(png|jpe?g|webp|gif)$/i.test(asset) ? asset : `${asset}.png`;
        return `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${filename}`;
    }

    return null;
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];
    if (!rewards.length) return '200 Orbs';
    return rewards.map(r => {
        const name = r?.messages?.name || 'Reward';
        if (r?.orb_quantity) {
            return `${r.orb_quantity} Orbs`;
        }
        return name;
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
        return `${label} for ${target}s`;
    } else if (type.includes('DESKTOP') || type.includes('PLAY')) {
        const mins = Math.ceil(target / 60);
        return mins > 1 ? `${label} for ${mins}m` : `${label} for ${target}s`;
    }
    return `${label} (${target}s)`;
}

function progressBar(percent) {
    const filled = Math.round(percent / 10);
    return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${percent}%`;
}

function text(content) {
    return new TextDisplayBuilder().setContent(content);
}

function separator() {
    return new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small);
}

export async function buildQuestSolverPanel(
    client,
    guildId,
    userId,
    selectedQuestId = null,
    customLogs = null
) {
    const prefix = client.config?.prefix || process.env.PREFIX || ';';
    const tokenStore = client.tokenStore;

    if (!tokenStore) {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(text('# ❌ Token Store Error\nToken store is not initialized.'));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    let active, token;
    try {
        active = await tokenStore.getActiveSlot(guildId, userId);
        token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    } catch {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(text('# ❌ Token Store Error\nCould not load token.'));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    if (!active || !token) {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        container.addTextDisplayComponents(text(`# ❌ No Active Slot\nUse \`${prefix}link\` to link a token.`));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    let rawQuests;
    try {
        const questClient = new QuestClient(token.trim().replace(/^['"]|['"]$/g, ''));
        const manager = await questClient.fetchQuests();
        rawQuests = manager.list() ?? [];
    } catch (error) {
        const container = new ContainerBuilder().setAccentColor(0xED4245);
        const rawErr = String(error?.message ?? error);

        let userFriendlyMsg = rawErr;
        if (rawErr.includes('401') || rawErr.toLowerCase().includes('unauthorized')) {
            userFriendlyMsg = `🔑 **Token Expired or Invalid!**\n\nYour linked Discord token has expired or is no longer valid.\nPlease use \`${prefix}link\` to re-link your token.`;
        } else {
            userFriendlyMsg = `⚠️ **Quest Fetch Failed**\n${shorten(rawErr, 250)}`;
        }

        container.addTextDisplayComponents(text(`# ❌ Quest Solver Error\n${userFriendlyMsg}`));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    const activeQuests = rawQuests.filter(quest => {
        const completed = quest.isCompleted?.() ?? false;
        const expired = quest.isExpired?.() ?? false;
        return !completed && !expired;
    });

    const allQuests = activeQuests.map(quest => {
        const config = quest.config ?? {};
        const messages = config.messages ?? {};
        const tasks = getTasks(config);
        const status = quest.userStatus ?? {};

        const platformProgress = {};
        for (const [type, tConf] of Object.entries(tasks)) {
            platformProgress[type] = getTaskProgress(type, tConf, status);
        }

        const perc = Object.values(platformProgress);
        const total = perc.length ? Math.floor(perc.reduce((a, b) => a + b, 0) / perc.length) : 0;

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
            banner: getBannerUrl(quest),
            progress: { total },
            sourceQuest: quest,
        };
    });

    const container = new ContainerBuilder().setAccentColor(PURPLE);

    container.addTextDisplayComponents(
        text('## 🔨 Quest Solver\n━━━━━━━━━━━━━━━━━━━━━━━━')
    );

    if (!allQuests.length) {
        container.addTextDisplayComponents(
            text('❌ **No Active Quests**\nNo active uncompleted quests found on this account right now.')
        );
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('quest_panel_refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Primary)
            )
        );
        container.addTextDisplayComponents(text('### 🧾 Quest Logs\n```ansi\nNo active quests\n```'));
        return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }

    const selected = allQuests.find(q => String(q.id) === String(selectedQuestId)) ?? allQuests[0];

    const desktop = selected.platformProgress['PLAY_ON_DESKTOP'] ?? selected.platformProgress['WATCH_VIDEO'] ?? 0;
    const mobile = selected.platformProgress['WATCH_VIDEO_ON_MOBILE'] ?? 0;
    const xbox = selected.platformProgress['PLAY_ON_XBOX'] ?? 0;
    const playstation = selected.platformProgress['PLAY_ON_PLAYSTATION'] ?? 0;

    container.addTextDisplayComponents(
        text(
            `**${icons.game} Game:**${selected.game}\n` +
            `**${icons.publisher} Publisher:**${selected.publisher}\n` +
            `**${icons.quest} Quest:**${selected.questName}\n` +
            `**${icons.enrolled} Enrolled:**${selected.enrolledAt}\n` +
            `**${icons.expires} Expires:**${selected.expiresAt}`
        )
    );

    let platformLines = `${icons.desktop} Desktop:${desktop}%  •  ${icons.mobile} Mobile:${mobile}%`;
    if (xbox > 0) platformLines += `\n${icons.xbox} Xbox:${xbox}%`;
    if (playstation > 0) platformLines += `\n${icons.playstation} PlayStation:${playstation}%`;

    container.addTextDisplayComponents(
        text(
            `### Platform Status\n` +
            platformLines
        )
    );

    container.addTextDisplayComponents(
        text(
            `### ${icons.rewards} Rewards\n` +
            `🎁 **${selected.rewards}**`
        )
    );

    const taskLines = Object.entries(selected.tasks).length
        ? Object.entries(selected.tasks).map(([type, task]) => `• ${formatTaskDuration(type, task)}`).join('\n')
        : '• Task details unavailable';

    container.addTextDisplayComponents(
        text(`### ${icons.tasks} Tasks\n${taskLines}`)
    );

    if (selected.banner && /^https:\/\/\S+/i.test(selected.banner)) {
        container.addSeparatorComponents(separator());
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(selected.banner)
                    .setDescription(`${selected.questName} quest banner`)
            )
        );
    }

    container.addSeparatorComponents(separator());

    const options = allQuests.slice(0, 25).map(item =>
        new StringSelectMenuOptionBuilder()
            .setLabel(shorten(`${item.game} :${item.questName}`, 100))
            .setValue(String(item.id))
            .setDescription(shorten(`Progress: ${item.progress.total}\% \vert{}${item.rewards}`, 100))
            .setEmoji('🎯')
            .setDefault(String(item.id) === String(selected.id))
    );

    if (options.length) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('quest_select')
                    .setPlaceholder('Select an active quest...')
                    .addOptions(options)
            )
        );
    }

    // Action Buttons
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quest_start_${selected.id}`)
                .setLabel('Start')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`quest_stop_${selected.id}`)
                .setLabel('Stop')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId('quest_refresh')
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary)
        )
    );

    // Reliable Link Button for Quests Page
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View Quest')
                .setEmoji('🔗')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.com/quests')
        )
    );

    const logDetails = String(customLogs ?? `Quest selected: ${selected.questName}\nStatus: Ready to run`).slice(0, 600);
    const progressLogText = `📊 Progress: ${selected.progress.total}\%\n${progressBar(selected.progress.total)}`;

    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(
        text(
            `### 🧾 Quest Logs\n` +
            `${progressLogText}\n` +
            `\`\`\`text\n${logDetails}\n\`\`\``
        )
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}
