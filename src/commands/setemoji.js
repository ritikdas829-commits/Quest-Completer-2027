/**
 * setemoji.js — Interactive Dropdown UI Custom Emoji Manager with Categories & MongoDB
 * Location: src/commands/setemoji.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { getEmojis, saveEmoji, EMOJI_CATEGORIES } from '../quest/emoji.js';

export default {
    name: 'setemoji',
    prefix: ['setemoji', 'emoji'],
    description: 'Manage and update independent custom UI emojis for your quest bot',
    data: new SlashCommandBuilder()
        .setName('setemoji')
        .setDescription('Manage and update independent custom UI emojis')
        .addStringOption(o => 
            o.setName('key')
             .setDescription('The independent emoji key you want to change (e.g., invite_join, panel_premium)')
             .setRequired(false)
        )
        .addStringOption(o => 
            o.setName('emoji')
             .setDescription('The new emoji (custom discord emoji or standard emoji)')
             .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        const guildId = interaction.guild?.id || 'global';
        const key = interaction.options.getString('key')?.toLowerCase().trim();
        const newEmoji = interaction.options.getString('emoji')?.trim();

        await handleEmojiLogic(interaction, guildId, key, newEmoji, true);
    },

    async prefixExecute(message, args) {
        const guildId = message.guild?.id || 'global';
        const key = args[0]?.toLowerCase().trim();
        const newEmoji = args[1]?.trim();

        await handleEmojiLogic(message, guildId, key, newEmoji, false);
    }
};

// ── Shared Logic Handler for Prefix & Slash ──────────────────
async function handleEmojiLogic(target, guildId, key, newEmoji, isInteraction) {
    const emojis = await getEmojis(guildId);

    // 1. Agar koi key nahi di, toh interactive Dropdown menu dikhao categories ke sath
    if (!key) {
        const categories = Object.keys(EMOJI_CATEGORIES);
        
        // Pehli category by default select karein
        const firstCategory = categories[0];
        const embed = createCategoryEmbed(firstCategory, emojis);

        // Dropdown Menu options banana
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('emoji_category_select')
            .setPlaceholder('Select an emoji category...')
            .addOptions(
                categories.map((cat, index) => ({
                    label: cat,
                    value: cat,
                    description: `View emojis in ${cat}`,
                    default: index === 0
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const replyOptions = {
            embeds: [embed],
            components: [row],
            fetchReply: true
        };

        const response = isInteraction 
            ? await target.editReply(replyOptions).catch(() => {}) 
            : await target.reply(replyOptions).catch(() => {});

        if (!response) return;

        // Collector for Dropdown interaction (60 seconds timeout)
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== (target.user?.id || target.author?.id)) {
                return await i.reply({ content: 'This menu is not for you!', ephemeral: true }).catch(() => {});
            }

            const selectedCategory = i.values[0];
            const updatedEmbed = createCategoryEmbed(selectedCategory, emojis);

            // Update dropdown default option state
            selectMenu.components[0].options.forEach(opt => {
                opt.default = opt.value === selectedCategory;
            });

            const updatedRow = new ActionRowBuilder().addComponents(selectMenu);

            await i.update({ embeds: [updatedEmbed], components: [updatedRow] }).catch(() => {});
        });

        collector.on('end', async () => {
            const disabledMenu = new StringSelectMenuBuilder()
                .setCustomId('emoji_category_select')
                .setPlaceholder('Menu expired')
                .addOptions([{ label: 'Expired', value: 'expired', description: 'This menu has expired.' }])
                .setDisabled(true);

            const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
            await response.edit({ components: [disabledRow] }).catch(() => {});
        });

        return;
    }

    // 2. Check if the provided key is valid
    if (!emojis.hasOwnProperty(key)) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Invalid Emoji Key')
            .setDescription(`The independent key **"${key}"** does not exist.\n\nUse \`/setemoji\` without arguments to view all available category keys via dropdown.`);

        return isInteraction 
            ? await target.editReply({ embeds: [errEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [errEmbed], components: [] }).catch(() => {});
    }

    // 3. Agar key di hai par naya emoji nahi diya
    if (!newEmoji) {
        const infoEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`⚠️ Missing New Emoji for "${key}"`)
            .setDescription(`Current emoji for **${key}** is: **${emojis[key]}**\n\nTo update it, provide the new emoji.\n*Example:* \`?setemoji ${key} 🟢\``);

        return isInteraction 
            ? await target.editReply({ embeds: [infoEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [infoEmbed], components: [] }).catch(() => {});
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
        ? await target.editReply({ embeds: [resultEmbed], components: [] }).catch(() => {}) 
        : await target.reply({ embeds: [resultEmbed], components: [] }).catch(() => {});
}

// Helper function to create category embed
function createCategoryEmbed(categoryName, emojis) {
    const keysList = EMOJI_CATEGORIES[categoryName] || [];
    const fieldContent = keysList
        .map(k => `• \`${k}\` : ${emojis[k] || '⭐'}`)
        .join('\n');

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎨 Independent Quest UI Emojis Manager`)
        .setDescription(`Viewing category: **${categoryName}**\nUse the dropdown below to switch between categories.\n`)
        .addFields({
            name: categoryName,
            value: fieldContent || 'No emojis in this category.',
            inline: false
        })
        .setFooter({ text: 'Usage: /setemoji <key> <emoji> OR ?setemoji <key> <emoji>' });
}
