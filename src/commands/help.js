/**
 * help.js - Components V2 Help Command with All Commands Organized
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
        .setDescription('See all available commands and system guide'),
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
                    `# 🤖 Quest Bot — Command Guide\n-# Hey **${user.username}**, here is the complete breakdown of all commands and categories`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── 24/7 Presence Category ───────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🟢 **24/7 Online Presence System**\n` +
            `• \`/onlineid\`  \`${prefix}onlineid\` — Set your active slot and keep your account **24/7 online continuously** via secure WebSocket gateway presence 🟢.\n` +
            `• \`/offlineid\`  \`${prefix}offlineid\` — Disconnect your active account gateway presence, turning your status offline 🔴.\n` +
            `• \`/onlinestatus\`  \`${prefix}onlinestatus\` — View all your linked account slots along with their current status and user details.`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Quest & Token Management Category ────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🔗 **Quest & Token Management**\n` +
            `• \`/link\`  \`${prefix}link\` — Link your Discord user token securely via modal popup.\n` +
            `• \`/unlink\`  \`${prefix}unlink\` — Remove your saved token from a specific slot.\n` +
            `• \`/quest\`  \`${prefix}quest\` — Pick and complete one quest.\n` +
            `• \`/questall\`  \`${prefix}questall\` — Complete all quests at once.\n` +
            `• \`/questlist\`  \`${prefix}questlist\` — View all your quests & status.\n` +
            `• \`/autoquest\`  \`${prefix}autoquest\` — Auto-complete new quests as they drop.\n` +
            `• \`/tokencheck\`  \`${prefix}tokencheck\` — Check if your active token is still valid.`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Slot Link Commands Category ──────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `⚙️ **Slot Link & Unlink Commands**\n` +
            `• \`/linkid\`  \`${prefix}linkid\` — Link your token specifying a slot number (1–5).\n` +
            `• \`/unlinkid\`  \`${prefix}unlinkid\` — Unlink a token from a specific slot number (1–5).`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Utility Section ──────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🛠️ **Utility**\n` +
            `• \`/guide\`  \`${prefix}guide\` — View quick setup instructions for PC, Android, and iOS.\n` +
            `• \`/ping\`  \`${prefix}ping\` — Check bot latency.\n` +
            `• \`/help\`  \`${prefix}help\` — You are already here.`,
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
