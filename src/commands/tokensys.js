/**
 * tokensys.js - Complete 5-Slot MongoDB Token & Presence System
 * Location: src/commands/tokensys.js
 */

import { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    MessageFlags 
} from 'discord.js';
import { startUserOnlinePresence, stopUserOnlinePresence } from '../quest/userPresence.js';

// ── Helper: Token Modal Generator ─────────────────────────────
export function createTokenModal(slot = 1) {
    const modal = new ModalBuilder()
        .setCustomId(`linkid-modal-slot-${slot}`)
        .setTitle(`Link Your Token (Slot #${slot})`);

    const tokenInput = new TextInputBuilder()
        .setCustomId('discord_token_input')
        .setLabel('Enter your Discord User Token')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Paste your account token here...')
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(tokenInput);
    modal.addComponents(row);
    return modal;
}

// ─────────────────────────────────────────────
// 1. LINKID (Slash + Prefix)
// ─────────────────────────────────────────────
export const linkid = {
    name: 'linkid',
    prefix: 'linkid',
    data: new SlashCommandBuilder()
        .setName('linkid')
        .setDescription('Link your Discord user token securely via modal popup')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number (1-5)').setMinValue(1).setMaxValue(5).setRequired(false)),
    
    async execute(interaction, client) {
        const slot = interaction.options.getInteger('slot') || 1;
        const modal = createTokenModal(slot);
        await interaction.showModal(modal);
    },

    async prefixExecute(message, args, client) {
        const slot = parseInt(args[0]) || 1;
        if (slot < 1 || slot > 5) {
            return message.reply('❌ Invalid slot number. Please use a slot between 1 and 5. Example: `?linkid 1`');
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🔗 Secure Token Linking Panel')
            .setDescription(`Click the button below to open the secure token submission popup for **Slot #${slot}**.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ui_link_btn_slot_${slot}`)
                .setLabel(`Link Token (Slot ${slot})`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔗')
        );

        await message.reply({ embeds: [embed], components: [row] });
    }
};

// ─────────────────────────────────────────────
// 2. UNLINKID (Slash + Prefix)
// ─────────────────────────────────────────────
export const unlinkid = {
    name: 'unlinkid',
    prefix: 'unlinkid',
    data: new SlashCommandBuilder()
        .setName('unlinkid')
        .setDescription('Remove your linked Discord token from a slot')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number (1-5)').setMinValue(1).setMaxValue(5).setRequired(false)),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot') || 1;
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await client.tokenStore.removeSlot(guildId, userId, slot);
        stopUserOnlinePresence(userId);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Successfully Unlinked')
            .setDescription(`Your token from Slot **#${slot}** has been removed.`);

        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild.id;
        const userId = message.author.id;
        const slot = parseInt(args[0]) || 1;

        await client.tokenStore.removeSlot(guildId, userId, slot);
        stopUserOnlinePresence(userId);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Successfully Unlinked')
            .setDescription(`Your token from Slot **#${slot}** has been removed.`);

        await message.reply({ embeds: [embed] });
    }
};

// ─────────────────────────────────────────────
// 3. ONLINESTATUS (Slash + Prefix)
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
// 4. ONLINEID (Slash + Prefix) — Sets active slot & turns status online
// ─────────────────────────────────────────────
export const onlineid = {
    name: 'onlineid',
    prefix: 'onlineid',
    data: new SlashCommandBuilder()
        .setName('onlineid')
        .setDescription('Set active slot and bring account online')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number').setMinValue(1).setMaxValue(5).setRequired(true)),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot');
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await client.tokenStore.setActiveSlot(guildId, userId, slot);
        const active = await client.tokenStore.getActiveSlot(guildId, userId);

        if (active && active.token) {
            startUserOnlinePresence(userId, active.token, 'online');
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🟢 Account Online & Active')
            .setDescription(`Slot **#${slot}** is now active and connected online via gateway.`);

        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild.id;
        const userId = message.author.id;
        const slot = parseInt(args[0]);

        if (!slot || slot < 1 || slot > 5) {
            return message.reply('❌ Please specify a slot between 1 and 5. Example: `?onlineid 1`');
        }

        await client.tokenStore.setActiveSlot(guildId, userId, slot);
        const active = await client.tokenStore.getActiveSlot(guildId, userId);

        if (active && active.token) {
            startUserOnlinePresence(userId, active.token, 'online');
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🟢 Account Online & Active')
            .setDescription(`Slot **#${slot}** is now active and connected online via gateway.`);

        await message.reply({ embeds: [embed] });
    }
};

// ─────────────────────────────────────────────
// 5. OFFLINEID (Slash + Prefix) — Disconnects online presence
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
