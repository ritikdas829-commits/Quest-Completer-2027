/**
 * questUI.js — UI Builder — Banner + SelectMenu + Rewards + Platform Breakdown + Dynamic Logs — ACCURATE FIXED
 * Location: src/quest/questUI.js
 */
import { 
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, 
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MediaGalleryBuilder, 
    MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags 
} from 'discord.js';
import { QuestClient } from './questClient.js';

// Helper function to calculate exact task progress percentage
function calculateTaskProgress(taskType, taskConfig, userStatus, isCompleted) {
    if (isCompleted) return 100;
    if (!userStatus) return 0;

    const target = taskConfig?.target || 1;
    let current = 0;

    // Check Discord API progress schemas
    if (userStatus.stream_progress_seconds !== undefined) {
        current = userStatus.stream_progress_seconds;
    } else if (userStatus.progress && userStatus.progress[taskType] !== undefined) {
        const val = userStatus.progress[taskType];
        current = typeof val === 'object' ? (val.value || val.progress || 0) : val;
    } else if (userStatus.progress && typeof userStatus.progress === 'number') {
        current = userStatus.progress;
    }

    return Math.min(100, Math.floor((current / target) * 100));
}

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId = null, customLogs = null) {
    const tokenStore = client.tokenStore;
    const prefix = client.config?.prefix || process.env.PREFIX || ';';

    if (!tokenStore) {
        const c = new ContainerBuilder().setAccentColor(0xED4245); 
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Token Store Error\nToken store is not initialized.`)); 
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }

    // Secure token lookup
    const active = await tokenStore.getActiveSlot(guildId, userId);
    const token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;
    
    if (!active || !token) { 
        const c = new ContainerBuilder().setAccentColor(0xED4245); 
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ No Active Slot\nUse \`${prefix}link\` to link token!`)); 
        return { components: [c], flags: MessageFlags.IsComponentsV2 }; 
    }
    
    const cleanToken = typeof token === 'string' ? token.trim().replace(/['"]+/g, '') : token;

    let rawQuests = [];
    try {
        const qc = new QuestClient(cleanToken);
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() || [];
    } catch (err) {
        console.error('[QuestUI] Failed to fetch quests:', err.message);
        const is401 = err.message.includes('401');
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            is401 
            ? `# ❌ Token Expired\nSlot #${active.slot} ka token expire ho gaya! Use \`${prefix}link\` se dubara link karo.`
            : `# ❌ Error\n${err.message.slice(0,200)}`
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    
    let allQuests = rawQuests.map(q => {
        const cfg = q.config || {};
        const msgs = cfg.messages || {};
        const tasksObj = (cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {};
        const userStatus = q.userStatus || {};
        const isComp = q.isCompleted?.() || false;
        
        let platformProgress = {};
        let totalPctSum = 0;
        const taskTypes = Object.keys(tasksObj);

        for (const taskType of taskTypes) {
            const pct = calculateTaskProgress(taskType, tasksObj[taskType], userStatus, isComp);
            platformProgress[taskType] = pct;
            totalPctSum += pct;
        }

        // Average calculated overall progress across all tasks
        const overallProgress = isComp ? 100 : (taskTypes.length > 0 ? Math.floor(totalPctSum / taskTypes.length) : 0);

        return {
            id: q.id,
            game: msgs.game_title || 'Unknown Game',
            publisher: msgs.game_publisher || 'Unknown Publisher',
            questName: msgs.quest_name || 'Discord Quest',
            enrolledAt: userStatus.enrolled_at ? new Date(userStatus.enrolled_at).toLocaleDateString() : 'N/A',
            expiresAt: cfg.expires_at ? new Date(cfg.expires_at).toLocaleDateString() : 'N/A',
            rewards: cfg.rewards_config?.rewards?.map(r => `${r.messages?.name} ${r.orb_quantity ? `(${r.orb_quantity} Orbs)` : ''}`.trim()).join(', ') || 'Quest Reward',
            tasks: tasksObj,
            platformProgress,
            banner: cfg.assets?.hero ? `https://cdn.discordapp.com/app-assets/${cfg.application?.id}/quest-assets/${cfg.assets.hero}.png` : (cfg.assets?.game_tile ? `https://cdn.discordapp.com/app-assets/${cfg.application?.id}/quest-assets/${cfg.assets.game_tile}.png` : null),
            url: `https://discord.com/quests`,
            progress: { total: overallProgress },
            config: cfg,
            isCompleted: isComp,
            hasClaimed: q.hasClaimedRewards?.()
        };
    });

    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(0x4F545C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# 🔍 No Quests Available\nActive slot **${active.username || 'Slot #' + active.slot}** pe abhi koi active quest nahi hai.`
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    
    const selected = allQuests.find(q => q.id === selectedQuestId) || allQuests[0];
    const c1 = new ContainerBuilder().setAccentColor(selected.isCompleted ? 0x57F287 : 0x5865F2);
    
    const TASK_LABELS = {
        PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Desktop' },
        PLAY_ON_XBOX:          { icon: '🟩', label: 'Xbox' },
        PLAY_ON_PLAYSTATION:   { icon: '🟦', label: 'PlayStation' },
        WATCH_VIDEO:           { icon: '🎬', label: 'Video' },
        STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream' },
        PLAY_ACTIVITY:         { icon: '🎮', label: 'Activity' },
        WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Mobile Video' }
    };

    let progressDetails = `✅ **${selected.progress.total}%**`;
    const breakdownEntries = Object.entries(selected.platformProgress || {}).map(([type, pct]) => {
        const meta = TASK_LABELS[type] || { icon: '⚙️', label: type };
        return `${meta.icon} **${meta.label}:**${pct}%`;
    });

    if (breakdownEntries.length > 0) {
        progressDetails += `\n${breakdownEntries.join('\n')}`;
    }

    const contentText = 
        `• **Game:** ${selected.game}\n` +
        `• **Publisher:** ${selected.publisher}\n` +
        `• **Quest Name:** ${selected.questName}\n` +
        `• **Enrolled At:** ${selected.enrolledAt}\n` +
        `• **Expires At:** ${selected.expiresAt}\n` +
        `• **Progress:**\n${progressDetails}\n\n` +
        `## Rewards:\n• ${selected.rewards}\n\n## Tasks:\n${Object.keys(selected.tasks).map(t => `• ${t}`).join('\n')}`;

    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🔮 Quest Solver'));
    c1.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));
    
    if (selected.banner) {
        c1.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(selected.banner)));
    }
    
    const menuOptions = allQuests.slice(0, 25).map(function(q) {
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel((q.game + ': ' + q.questName).slice(0, 100))
            .setValue(q.id)
            .setDescription((q.rewards || 'Reward').slice(0, 100));
        if (q.id === selected.id) opt.setDefault(true);
        opt.setEmoji(q.isCompleted ? '✅' : '🎯');
        return opt;
    });

    // FIXED: Static Custom ID so dropdown selection always works!
    const menu = new StringSelectMenuBuilder().setCustomId('quest_select').setPlaceholder('Pick a quest...').addOptions(menuOptions);
    c1.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
    
    c1.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel(selected.isCompleted ? 'Claim' : 'Start').setStyle(ButtonStyle.Success).setEmoji(selected.isCompleted ? '🎁' : '▶️'),
            new ButtonBuilder().setCustomId('quest_stop_' + selected.id).setLabel('Stop').setStyle(ButtonStyle.Secondary).setEmoji('⏹️'),
            new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setStyle(ButtonStyle.Link).setURL(selected.url).setEmoji('🔗'))
    );
    
    const logDisplay = customLogs || `🧭 Quest selected: ${selected.questName}\n📝 Status: Ready / Enrolled`;
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 📄 Quest Logs'), 
        new TextDisplayBuilder().setContent(`\`\`\`ansi\n${logDisplay}\n\`\`\``)
    );
    
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}
