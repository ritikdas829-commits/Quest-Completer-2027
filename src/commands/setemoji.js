/**
 * setemoji.js — UI Custom Emoji Manager with MongoDB Support
 * Location: src/commands/setemoji.js
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getEmojis, saveEmoji } from '../quest/emoji.js';

export default {
    name: 'setemoji',
    prefix: 'setemoji',
    description: 'Manage and update custom UI emojis for your quest bot',
    data: new SlashCommandBuilder()
        .setName('setemoji')
        .setDescription('Manage and update custom UI emojis')
        .addStringOption(o => 
            o.setName('key')
             .setDescription('The emoji key you want to change (e.g., success, token, quest)')
             .setRequired(false)
        )
        .addStringOption(o => 
            o.setName('emoji')
             .setDescription('The new emoji (custom or standard emoji)')
             .setRequired(false)
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildId = interaction.guild?.id || 'global';
        const key = interaction.options.getString('key')?.toLowerCase();
        const newEmoji = interaction.options.getString('emoji');

        await handleEmojiLogic(interaction, guildId, key, newEmoji, true);
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild?.id || 'global';
        const key = args[0]?.toLowerCase();
        const newEmoji = args[1];

        await handleEmojiLogic(message, guildId, key, newEmoji, false);
    }
};

// ── Shared Logic Handler for Prefix & Slash ──────────────────
async function handleEmojiLogic(target, guildId, key, newEmoji, isInteraction) {
    // Fetch all current emojis from MongoDB/Cache
    const emojis = await getEmojis(guildId);

    // 1. Agar koi key nahi di, toh saare available keys ki list dikhao
    if (!key) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎨 Quest UI Emojis Manager')
            .setDescription('Here are all the available emoji keys and their current values:\n\n' +
                Object.entries(emojis).map(([k, v]) => `• **${k}** : ${v}`).join('\n')
            )
            .setFooter({ text: 'Usage: /setemoji <key> <emoji> OR ?setemoji <key> <emoji>' });

        return isInteraction 
            ? await target.editReply({ embeds: [embed] }) 
            : await target.reply({ embeds: [embed] });
    }

    // 2. Check if the provided key is valid
    if (!emojis.hasOwnProperty(key)) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Invalid Emoji Key')
            .setDescription(`The key **"${key}"** does not exist.\n\n**Available Keys:**\n\`${Object.keys(emojis).join(', ')}\``);

        return isInteraction 
            ? await target.editReply({ embeds: [errEmbed] }) 
            : await target.reply({ embeds: [errEmbed] });
    }

    // 3. Agar key di hai par naya emoji nahi diya
    if (!newEmoji) {
        const infoEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`⚠️ Missing New Emoji for "${key}"`)
            .setDescription(`Current emoji for **${key}** is: **${emojis[key]}**\n\nTo update it, provide the new emoji.\n*Example:* \`?setemoji ${key} 🟢\` or use the slash command.`);

        return isInteraction 
            ? await target.editReply({ embeds: [infoEmbed] }) 
            : await target.reply({ embeds: [infoEmbed] });
    }

    // 4. Save the new emoji to MongoDB & Update Cache
    const success = await saveEmoji(key, newEmoji, guildId);

    const resultEmbed = new EmbedBuilder();
    if (success) {
        resultEmbed
            .setColor(0x57F287)
            .setTitle('✅ Emoji Updated Successfully!')
            .setDescription(`Successfully changed **${key}** emoji to ${newEmoji}`);
    } else {
        resultEmbed
            .setColor(0xED4245)
            .setTitle('❌ Database Error')
            .setDescription(`Failed to update emoji **${key}** in the database.`);
    }

    return isInteraction 
        ? await target.editReply({ embeds: [resultEmbed] }) 
        : await target.reply({ embeds: [resultEmbed] });
}
