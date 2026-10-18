/**
 * questUI.js — UI Builder — Banner + SelectMenu + Rewards + Progress + View Button — FIXED
 * Location: src/quest/questUI.js
 */
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export async function buildQuestSolverPanel(client, guildId, userId, selectedQuestId = null) {
    const tokenStore = client.tokenStore;
    const accounts = await tokenStore.getAllSlots(guildId, userId);
    const active = accounts.find(a => a.isActive) || accounts[0];
    
    if (!active) { 
        const c = new ContainerBuilder().setAccentColor(0xED4245); 
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ❌ No Active Slot\nUse ;link to link token!')); 
        return { components: [c], flags: MessageFlags.IsComponentsV2 }; 
    }
    
    let allQuests = [];
    try { 
        if (client.questManager?.getQuests) allQuests = await client.questManager.getQuests(active.token); 
        if (!allQuests.length && active.lastQuests) allQuests = active.lastQuests; 
    } catch { allQuests = []; }
    
    if (!allQuests.length) {
        allQuests = [{ 
            id: 'firefox', 
            game: "Firefox's Brand New Look", 
            publisher: 'Mozilla', 
            questName: 'Firefox Browser', 
            enrolledAt: '10/17/2026', 
            expiresAt: '10/29/2026', 
            progress: { total: 0, web: 0, mobile: 0 }, 
            rewards: '200 Orbs', 
            tasks: ['Watch Video for 2m', 'Watch Video On Mobile for 2m'], 
            banner: 'https://cdn.discordapp.com/app-assets/1011682074587152384/quest-assets/1267890123456.png', 
            url: 'https://discord.com/quests',
            config: { 
                messages: { 
                    game_title: "Firefox's Brand New Look", 
                    game_publisher: 'Mozilla', 
                    quest_name: 'Firefox Browser' 
                } 
            }
        }];
    }
    
    const selected = allQuests.find(q => q.id === selectedQuestId) || allQuests[0];
    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    
    const gameTitle = selected.game || selected.config?.messages?.game_title || 'Unknown Game';
    const publisher = selected.publisher || selected.config?.messages?.game_publisher || 'Unknown Publisher';
    const questName = selected.questName || selected.config?.messages?.quest_name || 'Unknown Quest';
    const enrolledAt = selected.enrolledAt || '10/17/2026';
    const expiresAt = selected.expiresAt || '10/29/2026';
    const progressTotal = selected.progress?.total ?? 0;
    const progressWeb = selected.progress?.web ?? 0;
    const progressMobile = selected.progress?.mobile ?? 0;
    const rewards = selected.rewards || '200 Orbs';
    const tasks = selected.tasks || ['Watch Video for 2m'];
    const taskListString = tasks.map(function(t) { return '• ' + t; }).join('\n');

    const contentText = 
        '• Game: ' + gameTitle + '\n' +
        '• Publisher: ' + publisher + '\n' +
        '• Quest Name: ' + questName + '\n' +
        '• Enrolled At: ' + enrolledAt + '\n' +
        '• Expires At: ' + expiresAt + '\n' +
        '• **Progress:**\n✅ ' + progressTotal + '%\n🎬 Web/Desktop: ' + progressWeb + '%\n📱 Mobile: ' + progressMobile + '%\n\n' +
        '## Rewards:\n• ' + rewards + '\n\n## Tasks:\n' + taskListString;

    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🔮 Quest Solver'));
    c1.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));
    
    const appId = selected.config?.application?.id || '1011682074587152384';
    const hero = selected.config?.assets?.hero || selected.config?.assets?.game_tile || '1267890123456';
    const bannerUrl = selected.banner || ('https://cdn.discordapp.com/app-assets/' + appId + '/quest-assets/' + hero + '.png');
    
    c1.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(bannerUrl)
        )
    );
    
    const menuOptions = allQuests.slice(0, 25).map(function(q) {
        const qGame = q.game || q.config?.messages?.game_title || q.config?.messages?.quest_name || 'Quest';
        const qName = q.questName || q.config?.messages?.quest_name || 'Details';
        const labelText = (qGame + ': ' + qName).slice(0, 100);
        const descText = (q.rewards || '200 Orbs').slice(0, 100);
        
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
