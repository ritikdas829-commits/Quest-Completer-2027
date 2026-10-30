/**
 * help.js — Cool & Modern Interactive Components V2 Help Command
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
        .setDescription('Open the ultimate cool interactive command guide dashboard'),
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

    // ── Cool Header ────────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${emojis.help_bot || '🤖'} Quest Bot Command Central\n` +
                    `> *Welcome to the next-gen quest automation control center.*\n` +
                    `-# Hey **${user.username}**, select a module from the menu below to explore commands.`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Dynamic Cool Content Based on Category Selection ───────────────────
    let contentText = '';

    if (category === 'presence') {
        contentText = `### ${emojis.help_presence || '🟢'} 24/7 Online Presence System\n` +
            `Keep your account active and online around the clock securely via WebSocket gateway.\n\n` +
            `• \`/onlineon\`  \`${prefix}onlineon\`\n` +
            `  └ *Bring your active account slot 24/7 online continuously 🟢.*\n\n` +
            `• \`/onlineoff\`  \`${prefix}onlineoff\`\n` +
            `  └ *Disconnect gateway presence and turn status offline 🔴.*\n\n` +
            `• \`/onlinestatus\`  \`${prefix}onlinestatus\`\n` +
            `  └ *Inspect linked slots, status metrics, and control panel buttons.*`;
    } else if (category === 'quest') {
        contentText = `### ${emojis.help_quest || '⚔️'} Quest & Token Management\n` +
            `Automate your Discord quests and manage multi-slot token securely.\n\n` +
            `• \`/link\`  \`${prefix}link\`\n` +
            `  └ *Open 5-slot account panel & link your token securely via modal.*\n\n` +
            `• \`/unlink\`  \`${prefix}unlink\`\n` +
            `  └ *Remove saved token from a designated account slot.*\n\n` +
            `• \`/quest\`  \`${prefix}quest\`\n` +
            `  └ *Pick & complete specific quests with live percentage tracking.*\n\n` +
            `• \`/questall\` / \`/q\`  \`${prefix}questall\`\n` +
            `  └ *Automatically solve and claim all available quests instantly.*\n\n` +
            `• \`/questlist\`  \`${prefix}questlist\`\n` +
            `  └ *Browse all active quests and their live status cards.*\n\n` +
            `• \`/autoquest\`  \`${prefix}autoquest\`\n` +
            `  └ *Toggle auto-pilot quest completion as soon as they drop.*\n\n` +
            `• \`/tokencheck\`  \`${prefix}tokencheck\`\n` +
            `  └ *Validate if your active account token is healthy & working.*`;
    } else if (category === 'utility') {
        contentText = `### ${emojis.help_utility || '🛠️'} Utility & Quick Guides\n` +
            `Essential tools and step-by-step token extraction guides.\n\n` +
            `• \`/guide\`  \`${prefix}guide\`\n` +
            `  └ *View interactive token extraction scripts for PC, Android, and iOS.*\n\n` +
            `• \`/ping\`  \`${prefix}ping\`\n` +
            `  └ *Check bot gateway latency and response speeds.*\n\n` +
            `• \`/help\`  \`${prefix}help\`\n` +
            `  └ *Launch this sleek interactive help command hub.*`;
    } else {
        // Main Overview Page with Cool Cards Style
        contentText = `### ${emojis.help_success || '✨'} Welcome to the Help Dashboard\n` +
            `Your centralized hub for managing automation, tokens, and system utilities.\n\n` +
            `> **How to navigate:**\n` +
            `> Use the **interactive dropdown menu** below to switch between categories instantly.\n\n` +
            `🟢 **24/7 Presence System** — Gateway online/offline management.\n` +
            `⚔️ **Quest Management** — \`?quest\`, \`?questall\`, \`?questlist\`, \`?link\`, \`?autoquest\`.\n` +
            `🛠️ **Utility & Guides** — Extraction scripts and performance checks.`;
    }

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText));

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Sleek Interactive Dropdown Menu ────────────────────────────────────
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('📂 Click here to switch command categories...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_main')
                .setLabel('Main Overview Hub')
                .setDescription('Return to the main dashboard home page')
                .setDefault(category === 'main'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_presence')
                .setLabel('24/7 Online Presence')
                .setDescription('Gateway online/offline controls & status')
                .setDefault(category === 'presence'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_quest')
                .setLabel('Quest & Token Management')
                .setDescription('Quest runners, link panels & auto-pilot')
                .setDefault(category === 'quest'),
            new StringSelectMenuOptionBuilder()
                .setValue('help_cat_utility')
                .setLabel('Utility & Guides')
                .setDescription('Setup guides, scripts & ping latency')
                .setDefault(category === 'utility')
        );

    c.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

    // ── Modern Footer ──────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ${emojis.help_globe || '🌐'} Serving **${client.guilds.cache.size}** server(s)  ·  Prefix: \`${prefix}\`  ·  Secure Automation`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}
