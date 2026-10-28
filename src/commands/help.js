/**
 * help.js — Interactive Components V2 Help Command (Cleaned & Updated)
 * Location: src/commands/help.js
 */

import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from 'discord.js';
import { getEmojis } from '../quest/emoji.js';

function getClientPrefix(client, guildId) {
    try {
        if (client?.getPrefix) return client.getPrefix(guildId);
        if (client?.config?.prefix) return client.config.prefix;
        if (client?.prefix) return client.prefix;
    } catch {}
    return process.env.BOT_PREFIX || ';';
}

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('See all available commands and system guide via interactive menu'),
    prefix: 'help',

    async execute(interaction, client) {
        const guildId = interaction.guild?.id || 'global';
        const panel = await buildHelpPanel(interaction.user, client, guildId, 'main');
        await interaction.reply(panel);
    },

    async prefixExecute(message, _a, client) {
        const guildId = message.guild?.id || 'global';
        const panel = await buildHelpPanel(message.author, client, guildId, 'main');
        await message.reply(panel);
    },
};

export async function buildHelpPanel(user, client, guildId, category = 'main') {
    const emojis = await getEmojis(guildId);
    const prefix = getClientPrefix(client, guildId);
    const avatar = user.displayAvatarURL({ size: 128, extension: 'png' });
    const botAvatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    
    const c = new ContainerBuilder().setAccentColor(0x5865F2);

    // ── Header ────────────────────────────────________________──────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${emojis.s_admin || '🤖'} Quest Bot — Command Guide\n-# Hey **${user.username}**, explore all available commands using the menu below.`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Dynamic Content Based on Category Selection ──────────────────────────
    let contentText = '';

    if (category === 'presence') {
        contentText = `🟢 **24/7 Online Presence System**\n\n` +
            `• \`/onlineon\`  \`${prefix}onlineon\` — Set active slot and keep account **24/7 online continuously** via WebSocket gateway 🟢.\n\n` +
            `• \`/onlineoff\`  \`${prefix}onlineoff\` — Disconnect active account gateway presence, turning status offline 🔴.\n\n` +
            `• \`/onlinestatus\`  \`${prefix}onlinestatus\` — View all linked slots along with status, user details, and control panel buttons.`;
    } else if (category === 'quest') {
        contentText = `🔗 **Quest & Token Management**\n\n` +
            `• \`/link\`  \`${prefix}link\` — Link your Discord user token securely via modal popup.\n\n` +
            `• \`/unlink\`  \`${prefix}unlink\` — Remove your saved token from a specific slot.\n\n` +
            `• \`/quest\`  \`${prefix}quest\` — Pick and complete a specific Discord quest with live progress tracking.\n\n` +
            `• \`/questall\`  \`${prefix}questall\` — Complete all available quests at once automatically.\n\n` +
            `• \`/questlist\`  \`${prefix}questlist\` — View all your active quests and completion status.\n\n` +
            `• \`/autoquest\`  \`${prefix}autoquest\` — Auto-complete new quests as soon as they drop.\n\n` +
            `• \`/tokencheck\`  \`${prefix}tokencheck\` — Check if your active token is still valid and not expired.`;
    } else if (category === 'utility') {
        contentText = `🛠️ **Utility & Guide**\n\n` +
            `• \`/guide\`  \`${prefix}guide\` — View quick setup instructions for PC, Android, and iOS devices.\n\n` +
            `• \`/ping\`  \`${prefix}ping\` — Check bot latency and response time.\n\n` +
            `• \`/help\`  \`${prefix}help\` — Open this interactive command guide dashboard.`;
    } else {
        // Main Overview Page
        contentText = `📋 **Welcome to Quest Bot Help Center!**\n\n` +
            `Use the **dropdown menu below** to explore specific command categories:\n\n` +
            `🟢 **24/7 Presence System** — Gateway online/offline controls (\`?onlinestatus\`).\n` +
            `🔗 **Quest Management** — \`?quest\`, \`?questall\`, \`?questlist\`, \`?autoquest\`, \`?link\`, \`?unlink\`, \`?tokencheck\`.\n` +
            `🛠️ **Utility & Guides** — Setup guides and system tools.`;
    }

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Interactive Dropdown Menu (Cleaned: Slots category removed) ──────────
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('📂 Select a category to view command details...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_main')
                .setLabel('Main Overview')
                .setDescription('Return to the main help home page')
                .setDefault(category === 'main'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_presence')
                .setLabel('24/7 Online Presence')
                .setDescription('View gateway online/offline commands')
                .setDefault(category === 'presence'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_quest')
                .setLabel('Quest & Token Management')
                .setDescription('View quest, questall, questlist, autoquest, link')
                .setDefault(category === 'quest'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_utility')
                .setLabel('Utility & Guides')
                .setDescription('View setup guides and ping tool')
                .setDefault(category === 'utility')
        );

    c.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

    // ── Footer ───────────────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ${emojis.online || '🌐'} Serving **${client.guilds.cache.size}** server(s)  ·  Prefix: \`${prefix}\``,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}
