/**
 * messageCreate.js — Handles Prefix Commands with Space & Trial Bypass Support
 * Location: src/events/messageCreate.js
 */

import { getEmojis } from '../quest/emoji.js';
import { getRoles } from '../quest/roleStore.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

export default {
    name: 'messageCreate',
    once: false,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Get correct prefix dynamically
        const prefix = client.getPrefix ? client.getPrefix(message.guild.id) : (client.prefix || process.env.PREFIX || ';');
        
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        let commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        // 🛑 Check for multi-word or space-separated commands (e.g., 'activate trial' -> commandName = 'activate', args[0] = 'trial')
        let fullCommandKey = commandName;
        let isActivateTrial = (commandName === 'activatetrial') || (commandName === 'activate' && args[0]?.toLowerCase() === 'trial');

        if (commandName === 'activate' && args[0]?.toLowerCase() === 'trial') {
            fullCommandKey = 'activatetrial'; // Map it to 'activatetrial' key in client.prefixCommands
            args.shift(); // Remove 'trial' from args so command handler receives clean arguments
        }

        // Fetch command from client.prefixCommands
        let command = client.prefixCommands.get(fullCommandKey) || client.prefixCommands.get(commandName);

        // Fallback: Check if multi-word combination exists directly (e.g. client.prefixCommands.get('activatetrial'))
        if (!command && args.length > 0) {
            const combinedKey = `${commandName}${args[0].toLowerCase()}`;
            command = client.prefixCommands.get(combinedKey);
            if (command) {
                if (combinedKey === 'activatetrial') isActivateTrial = true;
                args.shift();
            }
        }

        // 🛑 Role Security Check (Bypassed ONLY for activate trial)
        if (!isActivateTrial) {
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
                const c = new ContainerBuilder().setAccentColor(0x2B2D31);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `# ${EMOJI.premium || '💙'} Premium Access Required\n\n` +
                    `This premium bot requires the **Premium**, **Booster**, or **Trial** role/status.\n\n` +
                    `${EMOJI.diamond || '💎'} **Free Orbie Premium Trial!**\n` +
                    `> ${EMOJI.star || '🌟'} You are eligible to claim a free 3-day Orbie Premium trial.\n` +
                    `> ${EMOJI.gift || '🎁'} Use the command \`${prefix}activate trial\` or \`${prefix}activatetrial\` to get your trial key at no cost.\n\n` +
                    `Join support: https://discord.gg/y5f29e5tQb`
                ));
                return await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
            }
        }

        if (!command) return;

        try {
            if (typeof command.prefixExecute === 'function') {
                return await command.prefixExecute(message, args, client);
            } else if (typeof command.execute === 'function' && !command.data) {
                return await command.execute(message, args, client);
            }
        } catch (err) {
            console.error(`Error executing prefix command ${commandName}:`, err);
            const EMOJI = await getEmojis(message.guildId || 'global');
            await message.reply(`${EMOJI.error || '❌'} Something went wrong.`).catch(() => {});
        }
    },
};
