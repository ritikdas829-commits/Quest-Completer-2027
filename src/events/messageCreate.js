import { getEmojis } from '../quest/emoji.js';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Get correct prefix dynamically from client config or env
    const prefix = client.getPrefix ? client.getPrefix(message.guild.id) : (client.prefix || process.env.PREFIX || ';');
    
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
      if (typeof command.prefixExecute === 'function') {
        await command.prefixExecute(message, args, client);
      } else if (typeof command.execute === 'function' && !command.data) {
        await command.execute(message, args, client);
      }
    } catch (err) {
      console.error(`Error executing prefix command ${commandName}:`, err);
      const EMOJI = await getEmojis(message.guildId || 'global');
      await message.reply(`${EMOJI.error || '❌'} Something went wrong.`).catch(() => {});
    }
  },
};
