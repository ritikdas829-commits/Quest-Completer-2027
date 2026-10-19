/**
 * questUI.js — Premium Neon Purple Quest Solver Dashboard
 * Merged & Optimized Edition: Active Quests Filter + Accurate Progress & Banners
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

function safeText(value, fallback = 'Not available') {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    return String(value);
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

    if (taskType === 'STREAM_ON_DESKTOP' && status.stream_progress_seconds != null) {
        const sp = Number(status.stream_progress_seconds);
        if (Number.isFinite(sp)) current = Math.max(current, sp);
    }

    return Math.min(100, Math.floor((current / target) * 100));
}

function getBannerUrl(config) {
    const appId = config?.application?.id || config?.application_id || config?.applicationId;
    const assets = config?.assets ?? {};
    const raw = assets.hero || assets.hero_video || assets.game_tile || assets.quest_tile || assets.game_tile_video || assets.quest_bar || assets.card || Object.values(assets)[0];

    if (!appId || !raw) return null;
    const asset = String(raw).trim();
    if (!asset) return null;

    const filename = /\.(png|jpe?g|webp|gif)$/i.test(asset) ? asset : `${asset}.png`;
    return `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${filename}`;
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
        return r?.orb_quantity ? `${r.orb_quantity} ${name}` : name;
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
        container.addTextDisplayComponents(text(`# ❌ Quest Fetch Error\n${shorten(error.message, 250)}`));
        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    }

    // ── Filter to ONLY show active/uncompleted quests ──
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
            banner: getBannerUrl(config),
            url: 'https://discord.com/quests',
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
            `### ${icons.progress} Progress:${selected.progress.total}%\n` +
            `${progressBar(selected.progress.total)}\n` +
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

    if (selected.url && /^https:\/\/\S+/i.test(selected.url)) {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Quest')
                    .setEmoji('🔗')
                    .setStyle(ButtonStyle.Link)
                    .setURL(selected.url)
            )
        );
    }

    const logLines = String(customLogs ?? `Quest selected: ${selected.questName}\nStatus: Ready to run`).slice(0, 850);

    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(
        text(
            `### 🧾 Quest Logs\n` +
            `\`\`\`text\n${logLines}\n\`\`\``
        )
    );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}
