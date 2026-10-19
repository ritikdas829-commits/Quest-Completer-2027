
/**
 * questUI.js — Quest Solver Dashboard
 * Location: src/quest/questUI.js
 * Features: Banner, Progress, Rewards, Select Menu, Buttons, Logs
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';

import { QuestClient } from './questClient.js';

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

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

    if (!Number.isFinite(target) || target <= 0) {
        return 0;
    }

    const progress = status.progress ?? {};
    const details = status.details ?? {};

    const eventName =
        taskConfig?.event_name ??
        taskConfig?.type ??
        taskType;

    const candidates = [
        details[taskType]?.progress,
        details[taskType]?.value,
        details[eventName]?.progress,
        details[eventName]?.value,
        progress[taskType]?.value,
        progress[taskType]?.progress,
        progress[taskType],
        progress[eventName]?.value,
        progress[eventName]?.progress,
        progress[eventName],
    ];

    let current = 0;

    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) {
            continue;
        }

        const value =
            typeof candidate === 'object'
                ? candidate.value ?? candidate.progress
                : candidate;

        const number = Number(value);

        if (Number.isFinite(number)) {
            current = Math.max(0, number);
            break;
        }
    }

    // Some quest types expose a separate stream-progress field.
    if (
        taskType === 'STREAM_ON_DESKTOP' &&
        status.stream_progress_seconds != null
    ) {
        const streamProgress = Number(
            status.stream_progress_seconds
        );

        if (Number.isFinite(streamProgress)) {
            current = Math.max(current, streamProgress);
        }
    }

    return Math.min(
        100,
        Math.floor((current / target) * 100)
    );
}

function getBannerUrl(config, questId) {
    const applicationId = config?.application?.id;
    const assets = config?.assets ?? {};

    const asset = assets.hero || assets.game_tile;

    if (!applicationId || !asset) {
        console.log('[QuestUI] Banner asset missing:', {
            questId,
            applicationId: applicationId ?? null,
            assets,
        });

        return null;
    }

    // This is the asset URL format used by the existing project.
    const url =
        `https://cdn.discordapp.com/app-assets/` +
        `${applicationId}/quest-assets/${asset}.png`;

    console.log('[QuestUI] Banner URL:', {
        questId,
        url,
    });

    return url;
}

function formatDate(value) {
    if (!value) return 'N/A';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'N/A'
        : date.toLocaleDateString();
}

function buildRewardText(config) {
    const rewards = config?.rewards_config?.rewards ?? [];

    if (!rewards.length) {
        return 'Quest Reward';
    }

    return rewards.map((reward) => {
        const name = reward.messages?.name || 'Reward';

        return reward.orb_quantity
            ? `${name} (${reward.orb_quantity} Orbs)`
            : name;
    }).join(', ');
}

function shorten(value, max = 100) {
    return String(value ?? '').slice(0, max);
}

// --------------------------------------------------
// MAIN UI
// --------------------------------------------------

export async function buildQuestSolverPanel(
    client,
    guildId,
    userId,
    selectedQuestId = null,
    customLogs = null
) {
    const prefix =
        client.config?.prefix ||
        process.env.PREFIX ||
        ';';

    const tokenStore = client.tokenStore;

    // Token store check
    if (!tokenStore) {
        const container = new ContainerBuilder()
            .setAccentColor(0xED4245);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# ❌ Token Store Error\n' +
                'Token store is not initialized.'
            )
        );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    // Active token lookup
    let active;
    let token;

    try {
        active = await tokenStore.getActiveSlot(
            guildId,
            userId
        );

        token = active
            ? (
                active.token ||
                await tokenStore.get(
                    guildId,
                    userId,
                    active.slot
                )
            )
            : null;
    } catch (error) {
        console.error(
            '[QuestUI] Token lookup failed:',
            error.message
        );

        const container = new ContainerBuilder()
            .setAccentColor(0xED4245);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# ❌ Token Store Error\n' +
                'Could not load the active token slot.'
            )
        );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    if (!active || !token) {
        const container = new ContainerBuilder()
            .setAccentColor(0xED4245);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# ❌ No Active Slot\n' +
                `Use \`${prefix}link\` to link a token.`
            )
        );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    const cleanToken =
        typeof token === 'string'
            ? token.trim().replace(/^['"]|['"]$/g, '')
            : token;

    // Fetch quests
    let rawQuests;

    try {
        const questClient = new QuestClient(cleanToken);
        const manager = await questClient.fetchQuests();

        rawQuests = manager.list() ?? [];
    } catch (error) {
        console.error(
            '[QuestUI] Fetch failed:',
            error.message
        );

        const isAuthError =
            /\b(401|403)\b/.test(error.message);

        const container = new ContainerBuilder()
            .setAccentColor(0xED4245);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                isAuthError
                    ? '# ❌ Authentication Error\n' +
                      `Slot #${active.slot} could not access quests. ` +
                      `Check your connection using \`${prefix}link\`.`
                    : '# ❌ Quest Fetch Error\n' +
                      shorten(error.message, 250)
            )
        );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    // Prepare quest data
    const allQuests = rawQuests.map((quest) => {
        const config = quest.config ?? {};
        const messages = config.messages ?? {};
        const tasks = getTasks(config);

        const status = quest.userStatus ?? {};
        const completed = quest.isCompleted?.() ?? false;

        const platformProgress = {};

        for (const [taskType, taskConfig] of Object.entries(tasks)) {
            platformProgress[taskType] = completed
                ? 100
                : getTaskProgress(
                    taskType,
                    taskConfig,
                    status
                );
        }

        const percentages = Object.values(platformProgress);

        // Displayed estimate based on available task percentages.
        // This is not guaranteed to match Discord's internal formula.
        const overallProgress = completed
            ? 100
            : percentages.length
                ? Math.floor(
                    percentages.reduce(
                        (sum, percentage) => sum + percentage,
                        0
                    ) / percentages.length
                )
                : 0;

        return {
            id: quest.id,

            game:
                messages.game_title ||
                config.application?.name ||
                'Unknown Game',

            publisher:
                messages.game_publisher ||
                'Unknown Publisher',

            questName:
                messages.quest_name ||
                'Discord Quest',

            enrolledAt: formatDate(status.enrolled_at),
            expiresAt: formatDate(config.expires_at),

            rewards: buildRewardText(config),
            tasks,
            platformProgress,

            banner: getBannerUrl(config, quest.id),

            url: 'https://discord.com/quests',

            progress: {
                total: overallProgress,
            },

            isCompleted: completed,
            hasClaimed:
                quest.hasClaimedRewards?.() ?? false,
        };
    });

    // No quests
    if (!allQuests.length) {
        const container = new ContainerBuilder()
            .setAccentColor(0x4F545C);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# 🔍 No Quests Available\n' +
                `Active slot: **${active.username || `Slot #${active.slot}`}**\n\n` +
                'No quests were returned by the API.'
            )
        );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };
    }

    // Selected quest
    const selected =
        allQuests.find(
            (quest) => quest.id === selectedQuestId
        ) ?? allQuests[0];

    const container = new ContainerBuilder()
        .setAccentColor(
            selected.isCompleted ? 0x57F287 : 0x5865F2
        );

    const TASK_LABELS = {
        PLAY_ON_DESKTOP: {
            icon: '🖥️',
            label: 'Desktop',
        },
        PLAY_ON_XBOX: {
            icon: '🟩',
            label: 'Xbox',
        },
        PLAY_ON_PLAYSTATION: {
            icon: '🟦',
            label: 'PlayStation',
        },
        WATCH_VIDEO: {
            icon: '🎬',
            label: 'Video',
        },
        STREAM_ON_DESKTOP: {
            icon: '📺',
            label: 'Stream',
        },
        PLAY_ACTIVITY: {
            icon: '🎮',
            label: 'Activity',
        },
        WATCH_VIDEO_ON_MOBILE: {
            icon: '📱',
            label: 'Mobile Video',
        },
        WATCH_VIDEO_BY_STREAM: {
            icon: '📺',
            label: 'Video Stream',
        },
        WATCH_VIDEO_EMBED: {
            icon: '🎞️',
            label: 'Embedded Video',
        },
        LEARN_MORE: {
            icon: '📖',
            label: 'Learn More',
        },
        ACHIEVEMENT_IN_ACTIVITY: {
            icon: '🏆',
            label: 'Achievement',
        },
        LAUNCH_APPLICATION: {
            icon: '🚀',
            label: 'Launch Application',
        },
    };

    // Progress display
    let progressDetails =
        `✅ **${selected.progress.total}%**`;

    const breakdown = Object.entries(
        selected.platformProgress
    ).map(([taskType, percentage]) => {
        const meta = TASK_LABELS[taskType] ?? {
            icon: '⚙️',
            label: taskType,
        };

        return (
            `${meta.icon} **${meta.label}:** ` +
            `${percentage}%`
        );
    });

    if (breakdown.length) {
        progressDetails += '\n' + breakdown.join('\n');
    }

    // Quest details
    const taskLines = Object.keys(selected.tasks).length
        ? Object.keys(selected.tasks)
            .map((task) => `• ${task}`)
            .join('\n')
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

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            '# 🔮 Quest Solver'
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(contentText)
    );

    // Banner
    if (selected.banner) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(selected.banner)
            )
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '🖼️ *Quest banner is unavailable.*'
            )
        );
    }

    // Quest select menu
    const menuOptions = allQuests
        .slice(0, 25)
        .map((quest) => {
            const option =
                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        shorten(
                            `${quest.game}: ${quest.questName}`,
                            100
                        )
                    )
                    .setValue(quest.id)
                    .setDescription(
                        shorten(quest.rewards || 'Reward', 100)
                    )
                    .setEmoji(
                        quest.isCompleted ? '✅' : '🎯'
                    );

            if (quest.id === selected.id) {
                option.setDefault(true);
            }

            return option;
        });

    const menu = new StringSelectMenuBuilder()
        .setCustomId('quest_select')
        .setPlaceholder('Pick a quest...')
        .addOptions(menuOptions);

    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(menu)
    );

    // Start / Claim, Stop, Refresh buttons
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quest_start_${selected.id}`)
                .setLabel(
                    selected.isCompleted ? 'Claim' : 'Start'
                )
                .setStyle(ButtonStyle.Success)
                .setEmoji(
                    selected.isCompleted ? '🎁' : '▶️'
                ),

            new ButtonBuilder()
                .setCustomId(`quest_stop_${selected.id}`)
                .setLabel('Stop')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏹️'),

            new ButtonBuilder()
                .setCustomId('quest_refresh')
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
        )
    );

    // Link button must be in its own action row.
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View Quest')
                .setStyle(ButtonStyle.Link)
                .setURL(selected.url)
                .setEmoji('🔗')
        )
    );

    // Logs
    const safeLogs = String(
        customLogs ??
        `🧭 Quest selected: ${selected.questName}\n` +
        `📝 Status: ${
            selected.isCompleted
                ? selected.hasClaimed
                    ? 'Completed / Claimed'
                    : 'Completed / Unclaimed'
                : selected.enrolledAt !== 'N/A'
                    ? 'Enrolled'
                    : 'Not enrolled'
        }`
    ).slice(0, 1500);

    const logsContainer = new ContainerBuilder()
        .setAccentColor(0x2B2D31);

    logsContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            '## 📄 Quest Logs'
        ),
        new TextDisplayBuilder().setContent(
            `\`\`\`text\n${safeLogs}\n\`\`\``
        )
    );

    return {
        components: [
            container,
            logsContainer,
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}
