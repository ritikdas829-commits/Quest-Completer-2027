/**
 * tokensys.js - MongoDB Online Presence & Status Commands with Profile Card
 * Location: src/commands/tokensys.js
 */

import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    MessageFlags 
} from 'discord.js';
import { startUserOnlinePresence, stopUserOnlinePresence } from '../quest/userPresence.js';

// ─────────────────────────────────────────────
// 1. ONLINESTATUS (Slash + Prefix)
// ─────────────────────────────────────────────
export const onlinestatus = {
    name: 'onlinestatus',
    prefix: 'onlinestatus',
    data: new SlashCommandBuilder()
        .setName('onlinestatus')
        .setDescription('Check your linked token status across your slots'),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const accounts = await client.tokenStore.getAllSlots(guildId, userId);
        const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
        const embed = new EmbedBuilder();

        if (!accounts || accounts.length === 0) {
            embed.setColor(0xED4245).setTitle('❌ No Tokens Linked').setDescription('No accounts linked yet.');
        } else {
            embed.setColor(0x5865F2).setTitle('📊 Token Status Dashboard');
            for (const acc of accounts) {
                const isActive = activeSlot?.slot === acc.slot;
                embed.addFields({
                    name: `Slot #${acc.slot} — ${acc.username || 'Linked Account'}`,
                    value: `• **Status:** ${isActive ? '🟢 Active' : '⚪ Stored'}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\``,
                    inline: false
                });
            }
        }
        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, _args, client) {
        const guildId = message.guild.id;
        const userId = message.author.id;
        const accounts = await client.tokenStore.getAllSlots(guildId, userId);
        const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
        const embed = new EmbedBuilder();

        if (!accounts || accounts.length === 0) {
            embed.setColor(0xED4245).setTitle('❌ No Tokens Linked').setDescription('No accounts linked yet.');
        } else {
            embed.setColor(0x5865F2).setTitle('📊 Token Status Dashboard');
            for (const acc of accounts) {
                const isActive = activeSlot?.slot === acc.slot;
                embed.addFields({
                    name: `Slot #${acc.slot} — ${acc.username || 'Linked Account'}`,
                    value: `• **Status:** ${isActive ? '🟢 Active' : '⚪ Stored'}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\``,
                    inline: false
                });
            }
        }
        await message.reply({ embeds: [embed] });
    }
};

// ─────────────────────────────────────────────
// 2. ONLINEID (Slash + Prefix) — Sets active slot & shows profile card details
// ─────────────────────────────────────────────
export const onlineid = {
    name: 'onlineid',
    prefix: 'onlineid',
    data: new SlashCommandBuilder()
        .setName('onlineid')
        .setDescription('Set active slot and bring account online with profile details')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number (1-5)').setMinValue(1).setMaxValue(5).setRequired(true)),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot');
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await client.tokenStore.setActiveSlot(guildId, userId, slot);
        const active = await client.tokenStore.getActiveSlot(guildId, userId);

        if (!active || !active.token) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('❌ Slot Empty')
                .setDescription(`Slot **#${slot}** me koi token linked nahi hai. Pehle \`?link\` use karke token add karein.`);
            return await interaction.editReply({ embeds: [errEmbed] });
        }

        // Start 24/7 Gateway Presence
        startUserOnlinePresence(userId, active.token, 'online');

        // Fetch target user details for profile card
        let targetUser = interaction.user;
        if (active.linkedUserId) {
            try {
                targetUser = await client.users.fetch(active.linkedUserId);
            } catch {}
        }

        const embed = buildOnlineProfileEmbed(slot, targetUser);
        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild.id;
        const userId = message.author.id;
        const slot = parseInt(args[0]);

        if (!slot || slot < 1 || slot > 5) {
            return message.reply('❌ Sahi slot number chune (1-5). Example: `?onlineid 1`');
        }

        await client.tokenStore.setActiveSlot(guildId, userId, slot);
        const active = await client.tokenStore.getActiveSlot(guildId, userId);

        if (!active || !active.token) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('❌ Slot Empty')
                .setDescription(`Slot **#${slot}** me koi token linked nahi hai. Pehle \`?link\` use karke token add karein.`);
            return await message.reply({ embeds: [errEmbed] });
        }

        // Start 24/7 Gateway Presence
        startUserOnlinePresence(userId, active.token, 'online');

        // Fetch target user details for profile card
        let targetUser = message.author;
        if (active.linkedUserId) {
            try {
                targetUser = await client.users.fetch(active.linkedUserId);
            } catch {}
        }

        const embed = buildOnlineProfileEmbed(slot, targetUser);
        await message.reply({ embeds: [embed] });
    }
};

// ── Helper: Profile Embed Generator ───────────────────────────
function buildOnlineProfileEmbed(slot, targetUser) {
    const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 256 });
    const createdAt = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`;

    return new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🟢 24/7 Online Presence Activated!')
        .setDescription(`Successfully activated **Slot #${slot}** and connected to Discord Gateway.`)
        .setThumbnail(avatarUrl)
        .addFields(
            { name: '👤 User Name', value: `\`${targetUser.tag || targetUser.username}\``, inline: true },
            { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
            { name: '🎰 Active Slot', value: `\`Slot #${slot}\``, inline: true },
            { name: '📅 Account Created', value: createdAt, inline: true },
            { name: '🌐 Connection Status', value: '🟢 **24/7 Gateway Online**', inline: true }
        )
        .setFooter({ text: 'Quest Bot • 24/7 Presence Manager' })
        .setTimestamp();
}

// ─────────────────────────────────────────────
// 3. OFFLINEID (Slash + Prefix) — Disconnects online presence
// ─────────────────────────────────────────────
export const offlineid = {
    name: 'offlineid',
    prefix: 'offlineid',
    data: new SlashCommandBuilder()
        .setName('offlineid')
        .setDescription('Disconnect account online presence'),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        stopUserOnlinePresence(interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🔴 Account Offline')
            .setDescription('Your account online gateway connection has been disconnected.');

        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, _args, client) {
        stopUserOnlinePresence(message.author.id);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🔴 Account Offline')
            .setDescription('Your account online gateway connection has been disconnected.');

        await message.reply({ embeds: [embed] });
    }
};
