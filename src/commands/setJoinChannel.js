/**
 * setJoinChannel.js - Set Welcome / Join Channel per Server
 * Location: src/commands/setJoinChannel.js
 */

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getCollection } from '../utils/mongo.js';
import { getEmojis } from '../quest/emoji.js';

export const setJoinChannelCmd = {
    data: new SlashCommandBuilder()
        .setName('setjoinchannel')
        .setDescription('Set the server welcome/join channel')
        .addChannelOption(o => 
            o.setName('channel')
             .setDescription('Select the join channel')
             .addChannelTypes(ChannelType.GuildText)
             .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    prefix: ['setjoin', 'setjoinchannel'],

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const EMOJI = await getEmojis(guildId);
        const channel = interaction.options.getChannel('channel');
        const col = await getCollection('guildSettings');

        if (!col) return interaction.reply({ content: `${EMOJI.sys_error || '❌'} Database error!`, ephemeral: true });

        await col.updateOne(
            { guildId },
            { $set: { joinChannelId: channel.id, updatedAt: new Date() } },
            { upsert: true }
        );

        await interaction.reply({ content: `${EMOJI.sys_success || '✅'} Successfully set join channel to <#${channel.id}>!`, ephemeral: true });
    },

    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ You need `Manage Guild` permissions to use this command.');
        }

        const guildId = message.guild.id;
        const EMOJI = await getEmojis(guildId);
        const channel = message.mentions.channels.first();
        
        if (!channel) {
            return message.reply(`${EMOJI.sys_error || '❌'} Usage: \`;setjoin #channel\``);
        }

        const col = await getCollection('guildSettings');
        if (!col) return message.reply(`${EMOJI.sys_error || '❌'} Database error!`);

        await col.updateOne(
            { guildId },
            { $set: { joinChannelId: channel.id, updatedAt: new Date() } },
            { upsert: true }
        );

        await message.reply(`${EMOJI.sys_success || '✅'} Successfully set join channel to <#${channel.id}>!`);
    }
};
