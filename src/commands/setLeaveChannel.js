/**
 * setLeaveChannel.js - Set Leave Channel per Server
 * Location: src/commands/setLeaveChannel.js
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getCollection } from '../utils/mongo.js';
import { getEmojis } from '../quest/emoji.js';

export const setLeaveChannelCmd = {
    data: new SlashCommandBuilder()
        .setName('setleavechannel')
        .setDescription('Set the server leave channel')
        .addChannelOption(o => 
            o.setName('channel')
             .setDescription('Select the leave channel')
             .addChannelTypes(ChannelType.GuildText)
             .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    prefix: ['setleave', 'setleavechannel'],

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const EMOJI = await getEmojis(guildId);
        const channel = interaction.options.getChannel('channel');
        const col = await getCollection('guildSettings');

        if (!col) return interaction.reply({ content: `${EMOJI.sys_error || '❌'} Database error!`, ephemeral: true });

        await col.updateOne(
            { guildId },
            { $set: { leaveChannelId: channel.id, updatedAt: new Date() } },
            { upsert: true }
        );

        await interaction.reply({ content: `${EMOJI.sys_success || '✅'} Successfully set leave channel to <#${channel.id}>!`, ephemeral: true });
    },

    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ You need `Manage Guild` permissions to use this command.');
        }

        const guildId = message.guild.id;
        const EMOJI = await getEmojis(guildId);
        const channel = message.mentions.channels.first();
        
        if (!channel) {
            return message.reply(`${EMOJI.sys_error || '❌'} Usage: \`;setleave #channel\``);
        }

        const col = await getCollection('guildSettings');
        if (!col) return message.reply(`${EMOJI.sys_error || '❌'} Database error!`);

        await col.updateOne(
            { guildId },
            { $set: { leaveChannelId: channel.id, updatedAt: new Date() } },
            { upsert: true }
        );

        await message.reply(`${EMOJI.sys_success || '✅'} Successfully set leave channel to <#${channel.id}>!`);
    }
};
