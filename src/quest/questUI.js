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
    
    if (!allQuests.length) allQuests = [{ 
        id: 'firefox', game: "Firefox's Brand New Look", publisher: 'Mozilla', questName: 'Firefox Browser', 
        enrolledAt: '10/17/2026', expiresAt: '10/29/2026', progress: { total: 0, web: 0, mobile: 0 }, 
        rewards: '200 Orbs', tasks: ['Watch Video for 2m', 'Watch Video On Mobile for 2m'], 
        banner: '[https://cdn.discordapp.com/app-assets/1011682074587152384/quest-assets/1267890123456.png](https://cdn.discordapp.com/app-assets/1011682074587152384/quest-assets/1267890123456.png)', 
        url: '[https://discord.com/quests](https://discord.com/quests)',
        config: { messages: { game_title: "Firefox's Brand New Look", game_publisher: 'Mozilla', quest_name: 'Firefox Browser' } }
    }];
    
    const selected = allQuests.find(q => q.id === selectedQuestId) || allQuests[0];
    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🔮 Quest Solver'));
    c1.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `• Game: ${selected.game || selected.config?.messages?.game_title}\n` +
        `• Publisher: ${selected.publisher || selected.config?.messages?.game_publisher}\n` +
        `• Quest Name: ${selected.questName || selected.config?.messages?.quest_name}\n` +
        `• Enrolled At: ${selected.enrolledAt || '10/17/2026'}\n` +
        `• Expires At: ${selected.expiresAt || '10/29/2026'}\n` +
        `• **Progress:**\n✅ ${selected.progress?.total ?? 0}%\n🎬 Web/Desktop: ${selected.progress?.web ?? 0}\%\n📱 Mobile: ${selected.progress?.mobile ?? 0}%\n\n` +
        `## Rewards:\n• ${selected.rewards \vert{}\vert{} '200 Orbs'}\n\n## Tasks:\n${(selected.tasks || ['Watch Video for 2m']).map(t => `• ${t}`).join('\n')}`
    ));
    
    if (selected.banner || selected.config?.assets) {
        const appId = selected.config?.application?.id || '1011682074587152384';
        const hero = selected.config?.assets?.hero || selected.config?.assets?.game_tile;
        const bannerUrl = selected.banner || `[https://cdn.discordapp.com/app-assets/$](https://cdn.discordapp.com/app-assets/$){appId}/quest-assets/${hero}.png`;
        c1.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl)));
    }
    
    const menu = new StringSelectMenuBuilder().setCustomId(`quest_select_${Date.now()}`).setPlaceholder('Pick a quest...').addOptions(allQuests.slice(0, 25).map(q => {
        const opt = new StringSelectMenuOptionBuilder()
            .setLabel(`${q.game \vert{}\vert{} q.config?.messages?.game_title \vert{}\vert{} q.config?.messages?.quest_name}: ${q.questName || q.config?.messages?.quest_name}`.slice(0,100))
            .setValue(q.id)
            .setDescription(`${q.rewards || '200 Orbs'}`.slice(0,100));
        if (q.id === selected.id) opt.setDefault(true); 
        opt.setEmoji((q.progress?.total ?? 0) === 100 ? '✅' : '🎯'); 
        return opt;
    }));
    
    c1.addActionRowComponents(new ActionRowBuilder().addComponents(menu));
    c1.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`quest_start_${selected.id}`).setLabel('Start').setStyle(ButtonStyle.Success).setEmoji('▶️'),
            new ButtonBuilder().setCustomId(`quest_stop_${selected.id}`).setLabel('Stop').setStyle(ButtonStyle.Secondary).setEmoji('⏹️'),
            new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        ),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Quest').setStyle(ButtonStyle.Link).setURL(selected.url || '[https://discord.com/quests').setEmoji](https://discord.com/quests').setEmoji)('🔗'))
    );
    
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📄 Quest Logs'), new TextDisplayBuilder().setContent(`\`\`\`ansi\n🧭 Quest selected: ${selected.questName || selected.config?.messages?.quest_name}\n\`\`\``));
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}
