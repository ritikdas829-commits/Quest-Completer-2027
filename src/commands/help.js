/**
 * help.js - Components V2 Help Command Updated for 5-Slot & Presence Architecture
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
import { getEmoji } from '../handlers/emoji.js';

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
        .setDescription('See all available commands and 5-slot architecture guide'),
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
                    `# 🤖 Quest Bot (5-Slot System)\n-# Hey **${user.username}**, here is your complete command & slot guide`,
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar)),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Token & Slot Section ─────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🔗 **Token & Slot Management (1-5)**\n` +
            `\`/linkid\`  \`${prefix}linkid\` — Secure modal popup to link token to slot\n` +
            `\`/unlinkid\`  \`${prefix}unlinkid\` — Remove token from a specific slot\n` +
            `\`/onlinestatus\`  \`${prefix}onlinestatus\` — View all your linked account slots\n` +
            `\`/onlineid\`  \`${prefix}onlineid\` — Set active slot & bring account online\n` +
            `\`/offlineid\`  \`${prefix}offlineid\` — Disconnect account online presence\n` +
            `\`/tokencheck\`  \`${prefix}tokencheck\` — Verify if your active token is valid`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Quest Section ────────────────────────────────────────────────────────
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🎮 **Quest Automation**\n` +
            `\`/quest\`  \`${prefix}quest\` — Pick and complete one quest\n` +
            `\`/questall\`  \`${prefix}questall\` — Complete all active quests at once\n` +
            `\`/questlist\`  \`${prefix}questlist\` — View all your quests & reward status\n` +
            `\`/autoquest\`  \`${prefix}autoquest\` — Auto-complete new quests as they drop`,
        ),
    );

    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // ── Utility Section ────────────────────────────────______________________
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `🛠️ **Utility & Guides**\n` +
            `\`/guide\`  \`${prefix}guide\` — View quick setup guides (PC/Android/iOS)\n` +
            `\`/ping\`  \`${prefix}ping\` — Check bot latency\n` +
            `\`/help\`  \`${prefix}help\` — Show this help menu`,
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
