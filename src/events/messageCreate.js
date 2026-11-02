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
        // ✨ Cool & Sleek UI Design
        const embed = new EmbedBuilder()
            .setColor(0x5865F2) // Blurple modern color
            .setTitle(`${EMOJI.msg_premium || '💎'} Premium Access Restricted`)
            .setDescription(
                `> Hey **${message.author.username}**, this command requires an active **Premium**, **Booster**, or **Trial** pass.\n\n` +
                `✨ **Unlock Free Access Instantly!**\n` +
                `We are offering a free **3-day Orbie Premium trial** to get you started right away.\n\n` +
                `👇 **Tap & copy the command below to activate your free trial:**`
            )
            .addFields(
              { 
                name: `${EMOJI.msg_gift || '🎁'} Activation Command`, 
                value: `Long-press or tap the text below to copy:\n\n**${prefix}activate trial**`, 
                inline: false 
              }
            )
            .setFooter({ 
              text: `Orbie Bot • Secure & Fast System`, 
              iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // 💡 FIXED: Sent as plain text in 'content' so mobile users can easily copy it with a single tap/select!
        return await message.reply({ 
          content: `${prefix}activate trial`, 
          embeds: [embed] 
        }).catch(() => {});
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
