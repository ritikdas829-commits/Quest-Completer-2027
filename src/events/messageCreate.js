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
    const commandName = args.shift().toLowerCase();

    // 🛑 Allow 'activate trial' command without checking role access
    const isActivateTrial = commandName === 'activate' && args[0]?.toLowerCase() === 'trial';

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
            `> ${EMOJI.gift || '🎁'} Use the command \`${prefix}activate trial\` to get your trial key at no cost.\n\n` +
            `Join support: https://discord.gg/y5f29e5tQb`
        ));
        return await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => {});
      }
    }

    const command = client.prefixCommands.get(commandName);
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
