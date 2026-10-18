/**
 * questUI.js — UI Builder — Banner + SelectMenu + Rewards + Progress + View Button — FIXED
 * Location: src/quest/questUI.js
 */
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { QuestClient } from './questClient.js';

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId = null) {
    const tokenStore = client.tokenStore;
    const accounts = await tokenStore.getAllSlots(guildId, userId);
    const active = accounts.find(a => a.isActive) || accounts[0];
    
    if (!active) { 
        const c = new ContainerBuilder().setAccentColor(0xED4245); 
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ❌ No Active Slot\nUse ;link to link token!')); 
        return { components: [c], flags: MessageFlags.IsComponentsV2 }; 
    }
    
    let rawQuests = [];
    try {
        const qc = new QuestClient(active.token);
        const manager = await qc.fetchQuests();
        rawQuests = manager.list() || [];
    } catch (err) {
        console.error('[QuestUI] Failed to fetch quests:', err);
        rawQuests = [];
    }
    
    let allQuests = rawQuests.map(q => {
        const cfg = q.config || {};
        const msgs = cfg.messages || {};
        return {
            id: q.id,
            game: msgs.game_title || 'Unknown Game',
            publisher: msgs.game_publisher || 'Unknown Publisher',
            questName: msgs.quest_name || 'Discord Quest',
            expiresAt: cfg.expires_at ? new Date(cfg.expires_at).toLocaleDateString() : 'N/A',
            rewards: cfg.rewards_config?.rewards?.[0]?.messages?.name || 'Quest Reward',
            tasks: Object.keys((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}),
            banner: cfg.assets?.game_tile ? `https://cdn.discordapp.com/app-assets/${cfg.application?.id}/quest-assets/${cfg.assets.game_tile}.png` : null,
            url: 'https://discord.com/quests',
            progress: { total: q.isCompleted?.() ? 100 : 0 },
            config: cfg
        };
    });

    if (!allQuests.length) {
        allQuests = [{ 
            id: 'firefox', 
            game: "No Active Quests Found", 
            publisher: 'Discord', 
            questName: 'Check back later', 
            expiresAt: 'N/A', 
            progress: { total: 0 }, 
            rewards: 'None', 
            tasks: ['No quests currently available on this token.'], 
            banner: null, 
            url: 'https://discord.com/quests',
            config: { messages: { game_title: 'No Quests', game_publisher: 'Discord', quest_name: 'None' } }
        }];
    }
    
    const selected = allQuests.find(q => q.id === selectedQuestId) || allQuests[0];
    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    
    const gameTitle = selected.game;
    const publisher = selected.publisher;
    const questName = selected.questName;
    const expiresAt = selected.expiresAt;
    const progressTotal = selected.progress?.total ?? 0;
    const rewards = selected.rewards;
    const tasks = selected.tasks;
    const taskListString = tasks.map(function(t) { return '• ' + t; }).join('\n');

    const contentText = 
        '• Game: ' + gameTitle + '\n' +
        '• Publisher: ' + publisher + '\n' +
        '• Quest Name: ' + questName + '\n' +
        '• Expires At: ' + expiresAt + '\n' +
        '• **Progress:**\n✅ ' + progressTotal + '%\n\n' +
        '## Rewards:\n• ' + rewards + '\n\n## Tasks:\n' + taskListString;

    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🔮 Quest Solver'));
    c1.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));
    
    if (selected.banner) {
        c1.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(selected.banner)
            )
        );
    }
    
    const menuOptions = allQuests.slice(0, 25).map(function(q) {
        const labelText = (q.game + ': ' + q.questName).slice(0, 100);
        const descText = (q.rewards || 'Reward').slice(0, 100);
        
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(labelText)
            .setValue(q.id)
            .setDescription(descText);
            
        if (q.id === selected.id) {
            opt.setDefault(true);
        }
        const prog = q.progress?.total ?? 0;
        opt.setEmoji(prog === 100 ? '✅' : '🎯');
        return opt;
    });

    const menu = new StringSelectMenuBuilder()
        .setCustomId('quest_select_' + Date.now())
        .setPlaceholder('Pick a quest...')
        .addOptions(menuOptions);
    
    c1.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
    
    c1.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('quest_start_' + selected.id).setLabel('Start').setStyle(ButtonStyle.Success).setEmoji('▶️'),
            new ButtonBuilder().setCustomId('quest_stop_' + selected.id).setLabel('Stop').setStyle(ButtonStyle.Secondary).setEmoji('⏹️'),
            new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View Quest')
                .setStyle(ButtonStyle.Link)
                .setURL(selected.url || 'https://discord.com/quests')
                .setEmoji('🔗')
        )
    );
    
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 📄 Quest Logs'),
        new TextDisplayBuilder().setContent('```ansi\n🧭 Quest selected: ' + questName + '\n```')
    );
    
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}
