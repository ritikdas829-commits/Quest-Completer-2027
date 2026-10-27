/**
 * help.js - Components V2 Help Command with Detailed Command Descriptions
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
    MessageFlags,
} from 'discord.js';

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
        .setDescription('See all available commands and detailed system guide'),
    prefix: 'help',

    async execute(interaction, client) {
        await interaction.reply(await buildHelp(interaction.user, client, interaction.guild?.id));
    },

    async prefixExecute(message, _a, client) {
        await message.reply(await buildHelp(message.author, client, message.guild?.id));
    },
};

async function buildHelp(user, client, guildId) {
    const prefix = getClientPrefix(client, guildId);
    const avatar = user.displayAvatarURL({ size: 128, extension: 'png' });
    const botAvatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const c = new ContainerBuilder().setAccentColor(0x5865F2);

    // ── Header ──────────────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 🤖 Quest Bot — 5-Slot & Presence Guide\n-# Hey **${user.username}**, here is the complete breakdown of all commands and their features`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Token & Presence Section ─────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🔗 **Token & 24/7 Presence Management (Slots 1–5)**\n` +
            `• \`/linkid\`  \`${prefix}linkid\` — Opens a secure modal popup to link your Discord user token to a specific slot.\n` +
            `• \`/unlinkid\`  \`${prefix}unlinkid\` — Removes your saved token from the specified slot.\n` +
            `• \`/onlinestatus\`  \`${prefix}onlinestatus\` — Displays all your linked account slots along with their current status and user details.\n` +
            `• \`/onlineid\`  \`${prefix}onlineid\` — Sets your active slot and keeps your account **24/7 online continuously** via secure WebSocket gateway presence 🟢.\n` +
            `• \`/offlineid\`  \`${prefix}offlineid\` — Disconnects your active account gateway connection, turning your 24/7 presence offline 🔴.\n` +
            `• \`/tokencheck\`  \`${prefix}tokencheck\` — Verifies whether your active saved token is still valid and working.`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Quest Section ────────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🎮 **Quest Automation**\n` +
            `• \`/quest\`  \`${prefix}quest\` — Pick and complete an individual quest.\n` +
            `• \`/questall\`  \`${prefix}questall\` — Automatically complete all active uncompleted quests at once.\n` +
            `• \`/questlist\`  \`${prefix}questlist\` — View all available quests, progress, and reward status.\n` +
            `• \`/autoquest\`  \`${prefix}autoquest\` — Automatically complete new quests as they drop.`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Utility Section ──────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🛠️ **Utility & Setup Guides**\n` +
            `• \`/guide\`  \`${prefix}guide\` — View quick setup instructions for PC, Android, and iOS.\n` +
            `• \`/ping\`  \`${prefix}ping\` — Check bot latency.\n` +
            `• \`/help\`  \`${prefix}help\` — Display this help menu.`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Footer ───────────────────────────────────────────────────────────────
    c.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# 🌐 Serving **${client.guilds.cache.size}** server(s)  ·  Prefix: \`${prefix}\``,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}
