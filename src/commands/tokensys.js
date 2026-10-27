/**
 * tokensys.js - Updated to use MongoDB TokenStore & 5-Slot Progressive System
 * Location: src/commands/tokensys.js
 */

import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getProgressiveSlots } from '../quest/slotSystem.js';

function getClientPrefix(client, guildId) {
    try {
        if (client?.getPrefix) return client.getPrefix(guildId);
        if (client?.config?.prefix) return client.config.prefix;
        if (client?.prefix) return client.prefix;
    } catch {}
    return process.env.BOT_PREFIX || ';';
}

// ─────────────────────────────────────────────
// 1. LINKID (Slash + Prefix)
// ─────────────────────────────────────────────
export const linkid = {
    name: 'linkid',
    prefix: 'linkid',
    data: new SlashCommandBuilder()
        .setName('linkid')
        .setDescription('Link your Discord user token securely via modal popup'),
    
    async execute(interaction, client) {
        const modal = new ModalBuilder()
            .setCustomId('linkid-modal')
            .setTitle('Link Your Discord Token (Slot 1)');

        const tokenInput = new TextInputBuilder()
            .setCustomId('discord_token_input')
            .setLabel('Enter your Discord User Token')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Paste your account token here...')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(tokenInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },

    async prefixExecute(message, args, client) {
        const prefix = getClientPrefix(client, message.guild.id);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🔗 Token Linking')
            .setDescription(`For security reasons and to open a modal popup, please use the Slash Command: **\`/linkid\`**\nOr use your full progressive panel with: **\`${prefix}link\`**`);
        return await message.reply({ embeds: [embed] });
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
        .setDescription('Remove your linked Discord token from Slot 1')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number (1-5)').setMinValue(1).setMaxValue(5).setRequired(false)),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot') || 1;
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await client.tokenStore.removeSlot(guildId, userId, slot);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Successfully Unlinked')
            .setDescription(`Your token from Slot #${slot} has been removed from the database.`);

        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild.id;
        const userId = message.author.id;
        const slot = parseInt(args[0]) || 1;

        await client.tokenStore.removeSlot(guildId, userId, slot);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Successfully Unlinked')
            .setDescription(`Your token from Slot #${slot} has been removed from the database.`);

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
        const embed = new EmbedBuilder();

        if (!accounts || accounts.length === 0) {
            embed.setColor(0xED4245)
                .setTitle('❌ Not Linked')
                .setDescription('No accounts linked. Use `/linkid` or `/link` to link your token.');
        } else {
            embed.setColor(0x5865F2).setTitle('📊 Token Status Dashboard (MongoDB)');
            for (const acc of accounts) {
                const activeText = acc.isActive ? '🟢 Active' : '⚪ Inactive';
                const linkedDate = acc.linkedAt ? new Date(acc.linkedAt).toLocaleString() : 'N/A';
                embed.addFields({
                    name: `Slot #${acc.slot} — ${acc.username || 'Unknown'}`,
                    value: `• **Status:** ${activeText}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\`\n• **Linked At:** ${linkedDate}`,
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
        const embed = new EmbedBuilder();

        if (!accounts || accounts.length === 0) {
            embed.setColor(0xED4245)
                .setTitle('❌ Not Linked')
                .setDescription('No accounts linked. Use `/linkid` or `?link` to link your token.');
        } else {
            embed.setColor(0x5865F2).setTitle('📊 Token Status Dashboard (MongoDB)');
            for (const acc of accounts) {
                const activeText = acc.isActive ? '🟢 Active' : '⚪ Inactive';
                const linkedDate = acc.linkedAt ? new Date(acc.linkedAt).toLocaleString() : 'N/A';
                embed.addFields({
                    name: `Slot #${acc.slot} — ${acc.username || 'Unknown'}`,
                    value: `• **Status:** ${activeText}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\`\n• **Linked At:** ${linkedDate}`,
                    inline: false
                });
            }
        }

        await message.reply({ embeds: [embed] });
    }
};

// ─────────────────────────────────────────────
// 4. ONLINEID (Slash + Prefix)
// ─────────────────────────────────────────────
export const onlineid = {
    name: 'onlineid',
    prefix: 'onlineid',
    data: new SlashCommandBuilder()
        .setName('onlineid')
        .setDescription('Set your active slot account')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number to set active').setMinValue(1).setMaxValue(5).setRequired(true)),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot');
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        await client.tokenStore.setActiveSlot(guildId, userId, slot);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🟢 Active Slot Updated')
            .setDescription(`Slot **#${slot}** has been set as your active account for running quests.`);

        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild.id;
        const userId = message.author.id;
        const slot = parseInt(args[0]);

        if (!slot || slot < 1 || slot > 5) {
            return message.reply('❌ Please specify a valid slot number between 1 and 5. Example: `?onlineid 1`');
        }

        await client.tokenStore.setActiveSlot(guildId, userId, slot);

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🟢 Active Slot Updated')
            .setDescription(`Slot **#${slot}** has been set as your active account for running quests.`);

        await message.reply({ embeds: [embed] });
    }
};
