import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from '【entity-discord¦canonical_name=Discord】.js';
import { QuestClient } from './questClient.js';

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId = null) {
    const tokenStore = client.tokenStore;
    const accounts = await tokenStore.getAllSlots(guildId, userId);
    const active = accounts.find(a => a.isActive) || accounts[0];
    
    if (!active) { 
        const c = new ContainerBuilder().setAccentColor(0xED4245); 
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ❌ No Active Slot\nUse `;link` to link token!')); 
        return { components: [c], flags: MessageFlags.IsComponentsV2 }; 
    }
    
    let rawQuests = [];
    try {
        const qc = new QuestClient(active.token);
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() || [];
    } catch (err) {
        const is401 = err.message.includes('401');
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            is401 
            ? `# ❌ Token Expired\nSlot #${active.slot} token expired! Use \`;link\` to relink.`
            : `# ❌ Error\n${err.message.slice(0,200)}`
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    
    let allQuests = rawQuests.map(q => {
        const cfg = q.config || {};
        const msgs = cfg.messages || {};
        return {
            id: q.id,
            game: msgs.game_title || 'Unknown',
            publisher: msgs.game_publisher || 'Unknown',
            questName: msgs.quest_name || '【entity-Discord¦canonical_name=Discord】 Quest',
            expiresAt: cfg.expires_at ? new Date(cfg.expires_at).toLocaleDateString() : 'N/A',
            rewards: cfg.rewards_config?.rewards?.map(r => r.messages?.name).join(', ') || 'Reward',
            tasks: Object.keys((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}),
            banner: cfg.assets?.hero ? `https://cdn.discordapp.com/app-assets/${cfg.application?.id}/quest-assets/${cfg.assets.hero}.png` : null,
            url: `https://discord.com/quests`,
            progress: { total: q.isCompleted?.() ? 100 : 0 },
            isCompleted: q.isCompleted?.()
        };
    });

    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(0x4F545C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# 🔍 No Quests Available\nSlot **${active.username || active.slot}** has no active quests now.\n\nCheck back later!`
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    
    const selected = allQuests.find(q => q.id === selectedQuestId) || allQuests[0];
    const c1 = new ContainerBuilder().setAccentColor(selected.isCompleted ? 0x57F287 : 0x5865F2);
    
    const contentText = 
        `• Game: ${selected.game}\n` +
        `• Publisher: ${selected.publisher}\n` +
        `• Quest Name: ${selected.questName}\n` +
        `• Expires At: ${selected.expiresAt}\n` +
        `• Progress: ${selected.progress?.total ?? 0}%\n\n` +
        `Rewards: ${selected.rewards}\n` +
        `Tasks: ${selected.tasks.join(', ')}`;

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

    const menu = new StringSelectMenuBuilder().setCustomId('quest_select_' + Date.now()).setPlaceholder('Pick a quest...').addOptions(menuOptions);
    c1.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
    
    c1.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel('Start').setStyle(ButtonStyle.Success).setEmoji('▶️'),
            new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        )
    );
    
    return { components: [c1], flags: MessageFlags.IsComponentsV2 };
}
