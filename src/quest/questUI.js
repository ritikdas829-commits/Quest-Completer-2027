/**
 * questUI.js — UI Builder — Banner + SelectMenu + Rewards + Progress + View Button — FINAL FIXED
 * Location: src/quest/questUI.js
 */
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
        console.error('[QuestUI] Failed to fetch quests:', err.message);
        // Token 401 ya error pe empty rakho — Dummy mat banao
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Token Error\nSlot #${active.slot} - ${err.message.includes('401') ? 'Token expired! Use `;link` to relink.' : err.message.slice(0,100)}`));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    
    // REAL QUEST LIST — No dummy!
    let allQuests = rawQuests.map(q => {
        const cfg = q.config || {};
        const msgs = cfg.messages || {};
        return {
            id: q.id,
            game: msgs.game_title || 'Unknown Game',
            publisher: msgs.game_publisher || 'Unknown Publisher',
            questName: msgs.quest_name || '【entity-Discord¦canonical_name=Discord】 Quest',
            enrolledAt: q.userStatus?.enrolled_at ? new Date(q.userStatus.enrolled_at).toLocaleDateString() : 'N/A',
            expiresAt: cfg.expires_at ? new Date(cfg.expires_at).toLocaleDateString() : 'N/A',
            rewards: cfg.rewards_config?.rewards?.map(r => `${r.messages?.name} ${r.orb_quantity ? `(${r.orb_quantity} Orbs)` : ''}`.trim()).join(', ') || 'Quest Reward',
            tasks: Object.keys((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}),
            banner: cfg.assets?.hero ? `https://cdn.discordapp.com/app-assets/${cfg.application?.id}/quest-assets/${cfg.assets.hero}.png` : (cfg.assets?.game_tile ? `https://cdn.discordapp.com/app-assets/${cfg.application?.id}/quest-assets/${cfg.assets.game_tile}.png` : null),
            url: `https://discord.com/quests/${q.id}` || 'https://discord.com/quests',
            progress: { total: q.isCompleted?.() ? 100 : (q.getProgress?.() || 0), web: 0, mobile: 0 },
            config: cfg,
            isCompleted: q.isCompleted?.(),
            hasClaimed: q.hasClaimedRewards?.()
        };
    });

    // FIX: Dummy mat banao — Real No Quests card dikhao!
    if (!allQuests.length) {
        const c = new ContainerBuilder().setAccentColor(0x4F545C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# 🔍 No Quests Available\n` +
            `Active slot **${active.username || 'Slot #' + active.slot}** pe abhi koi active quest nahi hai.\n\n` +
            `Discord roz naye quests deta hai — Check back later!\n\n` +
            `-# Tip: \`;\`questlist se sab quests ka status dekh sakte ho`
        ));
        return { components: [c], flags: MessageFlags.IsComponentsV2 };
    }
    
    const selected = allQuests.find(q => q.id === selectedQuestId) || allQuests[0];
    const c1 = new ContainerBuilder().setAccentColor(selected.isCompleted ? 0x57F287 : 0x5865F2);
    
    const contentText = 
        `• **Game:** ${selected.game}\n` +
        `• **Publisher:** ${selected.publisher}\n` +
        `• **Quest Name:** ${selected.questName}\n` +
        `• **Enrolled At:** ${selected.enrolledAt}\n` +
        `• **Expires At:** ${selected.expiresAt}\n` +
        `• **Progress:**\n✅ ${selected.progress?.total ?? 0}%\n\n` +
        `## Rewards:\n• ${selected.rewards}\n\n## Tasks:\n${selected.tasks.map(t => `• ${t}`).join('\n')}`;

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
            new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel(selected.isCompleted ? 'Claim' : 'Start').setStyle(selected.isCompleted ? ButtonStyle.Success : ButtonStyle.Success).setEmoji(selected.isCompleted ? '🎁' : '▶️'),
            new ButtonBuilder().setCustomId('quest_stop_' + selected.id).setLabel('Stop').setStyle(ButtonStyle.Secondary).setEmoji('⏹️'),
            new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setStyle(ButtonStyle.Link).setURL(selected.url).setEmoji('🔗'))
    );
    
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📄 Quest Logs'), new TextDisplayBuilder().setContent('```ansi\n🧭 Quest selected: ' + selected.questName + '\n```'));
    
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}
