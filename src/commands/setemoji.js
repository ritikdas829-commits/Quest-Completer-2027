/**
 * setemoji.js — Independent UI Custom Emoji Manager with Categories & MongoDB Support
 * Location: src/commands/setemoji.js
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getEmojis, saveEmoji, EMOJI_CATEGORIES } from '../quest/emoji.js';

export default {
    name: 'setemoji',
    prefix: 'setemoji',
    description: 'Manage and update independent custom UI emojis for your quest bot',
    data: new SlashCommandBuilder()
        .setName('setemoji')
        .setDescription('Manage and update independent custom UI emojis')
        .addStringOption(o => 
            o.setName('key')
             .setDescription('The independent emoji key you want to change (e.g., panel_premium, quest_link)')
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

    // 1. Agar koi key nahi di, toh categories ke hisab se saari keys ki list embed fields mein dikhao
    if (!key) {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎨 Independent Quest UI Emojis Manager')
            .setDescription('Here are all the available independent emoji keys organized by their UI categories:\n');

        for (const [categoryName, keysList] of Object.entries(EMOJI_CATEGORIES)) {
            const fieldContent = keysList
                .map(k => `• \`${k}\` : ${emojis[k] || '⭐'}`)
                .join('\n');
            
            embed.addFields({
                name: categoryName,
                value: fieldContent || 'No emojis in this category.',
                inline: false
            });
        }

        embed.setFooter({ text: 'Usage: /setemoji <key> <emoji> OR ?setemoji <key> <emoji>' });

        return isInteraction 
            ? await target.editReply({ embeds: [embed] }) 
            : await target.reply({ embeds: [embed] });
    }

    // 2. Check if the provided key is valid
    if (!emojis.hasOwnProperty(key)) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Invalid Emoji Key')
            .setDescription(`The independent key **"${key}"** does not exist.\n\nUse \`/setemoji\` without arguments to view all available category keys.`);

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
            .setTitle('✅ Independent Emoji Updated Successfully!')
            .setDescription(`Successfully changed **${key}** emoji to ${newEmoji}`);
    } else {
        resultEmbed
            .setColor(0xED4245)
            .setTitle('❌ Database Error')
            .setDescription(`Failed to update independent emoji **${key}** in the database.`);
    }

    return isInteraction 
        ? await target.editReply({ embeds: [resultEmbed] }) 
        : await target.reply({ embeds: [resultEmbed] });
}
