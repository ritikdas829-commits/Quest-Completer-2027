/**
 * help.js — Interactive Components V2 Help Command with Dropdown & Custom Emojis
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

// Helper: Build Help Panel based on selection category
export async function buildHelpPanel(user, client, guildId, category = 'main') {
    const emojis = await getEmojis(guildId);
    const prefix = getClientPrefix(client, guildId);
    const avatar = user.displayAvatarURL({ size: 128, extension: 'png' });
    const botAvatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    
    const c = new ContainerBuilder().setAccentColor(0x5865F2);

    // ── Header ──────────────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${emojis.s_admin || '🤖'} Quest Bot — Command Guide\n-# Hey **${user.username}**, explore commands and system guide using the menu below.`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Dynamic Content Based on Category Selection ──────────────────────────
    let contentText = '';

    if (category === 'presence') {
        contentText = `🟢 **24/7 Online Presence System**\n\n` +
            `• \`/onlineon\`  \`${prefix}onlineon\` — Set your active slot and bring your account **24/7 online continuously** via secure WebSocket gateway presence 🟢.\n\n` +
            `• \`/onlineoff\`  \`${prefix}onlineoff\` — Disconnect your active account gateway presence, turning your status offline 🔴.\n\n` +
            `• \`/onlinestatus\`  \`${prefix}onlinestatus\` — View all your linked account slots along with their current status, user details, and control panel buttons.`;
    } else if (category === 'quest') {
        contentText = `🔗 **Quest & Token Management**\n\n` +
            `• \`/link\`  \`${prefix}link\` — Link your Discord user token securely via modal popup.\n\n` +
            `• \`/unlink\`  \`${prefix}unlink\` — Remove your saved token from a specific slot.\n\n` +
            `• \`/quest\`  \`${prefix}quest\` — Pick and complete a specific Discord quest with live progress tracking.\n\n` +
            `• \`/tokencheck\`  \`${prefix}tokencheck\` — Check if your active token is still valid and not expired.`;
    } else if (category === 'slots') {
        contentText = `⚙️ **Slot Link & Management Commands**\n\n` +
            `• \`/linkid\`  \`${prefix}linkid\` — Link your token specifying a specific slot number (1–5).\n\n` +
            `• \`/unlinkid\`  \`${prefix}unlinkid\` — Unlink a token from a specific slot number (1–5).\n\n` +
            `• \`Slot Control Panel\` — Manage your accounts directly via interactive buttons (Online On / Online Off).`;
    } else if (category === 'utility') {
        contentText = `🛠️ **Utility & Guide**\n\n` +
            `• \`/guide\`  \`${prefix}guide\` — View quick setup instructions for PC, Android, and iOS devices.\n\n` +
            `• \`/ping\`  \`${prefix}ping\` — Check bot latency and response time.\n\n` +
            `• \`/help\`  \`${prefix}help\` — Open this interactive command guide dashboard.`;
    } else {
        // Main Overview Page
        contentText = `📋 **Welcome to Quest Bot Help Center!**\n\n` +
            `Please select a category from the **dropdown menu below** to view detailed descriptions and usage instructions for each command:\n\n` +
            `🟢 **24/7 Presence System** — Keep your accounts online 24/7.\n` +
            `🔗 **Quest Management** — Complete quests and claim rewards.\n` +
            `⚙️ **Slot Settings** — Manage multi-account token slots (1-5).\n` +
            `🛠️ **Utility & Guide** — Setup guides and system tools.`;
    }

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Interactive Dropdown Menu ────────────────────────────────────────────
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
                .setDescription('View quest solver and token tools')
                .setDefault(category === 'quest'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_slots')
                .setLabel('Slot Link & Management')
                .setDescription('View multi-account slot commands')
                .setDefault(category === 'slots'),
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
