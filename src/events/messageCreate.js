/**
 * messageCreate.js — Dynamic Prefix & Emoji System with Anti-Duplicate Guard
 * Location: src/events/messageCreate.js
 */

import { getEmojis } from '../quest/emoji.js';
import { getRoles } from '../quest/roleStore.js';
import { EmbedBuilder } from 'discord.js';

// Anti-double trigger guard map
const processedMessages = new Set();

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Prevent handling the same message ID twice within 3 seconds
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 3000);

    // Get correct prefix dynamically
    const prefix = client.getPrefix ? client.getPrefix(message.guild.id) : (client.prefix || process.env.PREFIX || ';');
    
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // Check if command exists first
    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    // 🛑 Allow 'activate trial' and 'autoquest' without double checking role access here
    const isActivateTrial = commandName === 'activate' && args[0]?.toLowerCase() === 'trial';
    const isAutoquest = commandName === 'autoquest';

    if (!isActivateTrial && !isAutoquest) {
      const member = message.member;
      const guildId = message.guild.id;
      const roles = getRoles(guildId);
      const EMOJI = await getEmojis(guildId);

      const hasValidRole = 
        (roles.ROLE_TRIAL && member.roles.cache.has(roles.ROLE_TRIAL)) ||
        (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) ||
        (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES)) ||
        (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) ||
        (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) ||
        member.premiumSince;

      if (!hasValidRole) {
        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle(`${EMOJI.msg_premium || '💙'} Premium Access Required`)
            .setDescription(
                `This premium bot requires the **Premium**, **Booster**, or **Trial** role/status.\n\n` +
                `${EMOJI.msg_diamond || '💎'} **Free Orbie Premium Trial!**\n` +
                `> ${EMOJI.msg_star || '🌟'} You are eligible to claim a free 3-day Orbie Premium trial.\n` +
                `> ${EMOJI.msg_gift || '🎁'} Use the command \`${prefix}activate trial\` to get your trial key at no cost.\n\n` +
                `Join support: https://discord.gg/y5f29e5tQb`
            );
        return await message.reply({ embeds: [embed] }).catch(() => {});
      }
    }

    try {
      if (typeof command.prefixExecute === 'function') {
        return await command.prefixExecute(message, args, client);
      } else if (typeof command.execute === 'function' && !command.data) {
        return await command.execute(message, args, client);
      }
    } catch (err) {
      console.error(`Error executing prefix command ${commandName}:`, err);
      const EMOJI = await getEmojis(message.guildId || 'global');
      await message.reply(`${EMOJI.msg_error || '❌'} Something went wrong while executing this command.`).catch(() => {});
    }
  },
};
