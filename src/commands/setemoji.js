/**
 * setemoji.js — Interactive Dropdown UI Custom Emoji Manager with Categories, Auto-Overwrite & Reset Feature
 * Location: src/commands/setemoji.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { getEmojis, saveEmoji, emojiStore, EMOJI_CATEGORIES } from '../quest/emoji.js';

export default {
    name: 'setemoji',
    prefix: ['setemoji', 'emoji', 'resetemoji'],
    description: 'Manage, update, or reset independent custom UI emojis for your quest bot',
    data: new SlashCommandBuilder()
        .setName('setemoji')
        .setDescription('Manage, update, or reset custom UI emojis')
        .addStringOption(o => 
            o.setName('key')
             .setDescription('The independent emoji key (or use "reset" as first word to reset key)')
             .setRequired(false)
        )
        .addStringOption(o => 
            o.setName('emoji')
             .setDescription('New emoji, OR type "reset" / "default" to restore original emoji')
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

// ── Shared Logic Handler ──────────────────────────────────
async function handleEmojiLogic(target, guildId, keyInput, newEmojiInput, isInteraction) {
    let key = keyInput;
    let newEmoji = newEmojiInput;

    // Check if user wants to reset via prefix command (e.g. ?setemoji reset quest_list)
    let isResetMode = false;
    if (key === 'reset' || key === 'default' || key === 'remove') {
        isResetMode = true;
        key = newEmojiInput?.toLowerCase().trim();
        newEmoji = 'reset';
    } else if (newEmoji?.toLowerCase() === 'reset' || newEmoji?.toLowerCase() === 'default' || newEmoji?.toLowerCase() === 'remove') {
        isResetMode = true;
    }

    const emojis = await getEmojis(guildId);

    // 1. Interactive Dropdown menu (Quest UI Category prioritized on top)
    if (!key) {
        // Ensure "⚔️ Quest Commands UI" is listed FIRST in dropdown
        const categories = Object.keys(EMOJI_CATEGORIES).sort((a, b) => {
            if (a.includes('Quest Commands UI')) return -1;
            if (b.includes('Quest Commands UI')) return 1;
            return 0;
        });
        
        const firstCategory = categories[0];
        const embed = createCategoryEmbed(firstCategory, emojis);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('emoji_category_select')
            .setPlaceholder('Select an emoji category...')
            .addOptions(
                categories.map((cat, index) => ({
                    label: cat,
                    value: cat,
                    description: `Manage & View emojis in ${cat.replace(/^[^\w\s]+/, '').trim()}`,
                    default: index === 0
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const replyOptions = { embeds: [embed], components: [row], fetchReply: true };

        const response = isInteraction 
            ? await target.editReply(replyOptions).catch(() => {}) 
            : await target.reply(replyOptions).catch(() => {});

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 120000
        });

        collector.on('collect', async i => {
            try {
                if (i.user.id !== (target.user?.id || target.author?.id)) {
                    return await i.reply({ content: 'This menu is not for you!', ephemeral: true }).catch(() => {});
                }

                if (!i.deferred && !i.replied) {
                    await i.deferUpdate().catch(() => {});
                }

                const currentEmojis = await getEmojis(guildId);
                const selectedCategory = i.values[0];
                const updatedEmbed = createCategoryEmbed(selectedCategory, currentEmojis);

                const newSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId('emoji_category_select')
                    .setPlaceholder('Select an emoji category...')
                    .addOptions(
                        categories.map((cat) => ({
                            label: cat,
                            value: cat,
                            description: `Manage & View emojis in ${cat.replace(/^[^\w\s]+/, '').trim()}`,
                            default: cat === selectedCategory
                        }))
                    );

                const updatedRow = new ActionRowBuilder().addComponents(newSelectMenu);
                await i.editReply({ embeds: [updatedEmbed], components: [updatedRow] }).catch(() => {});
            } catch (err) {
                console.error('[Emoji Collector Error]:', err);
            }
        });

        collector.on('end', async () => {
            try {
                const disabledMenu = new StringSelectMenuBuilder()
                    .setCustomId('emoji_category_select')
                    .setPlaceholder('Menu expired')
                    .addOptions([{ label: 'Expired', value: 'expired', description: 'This menu has expired.' }])
                    .setDisabled(true);

                const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
                await response.edit({ components: [disabledRow] }).catch(() => {});
            } catch {}
        });

        return;
    }

    // 2. Validate Provided Emoji Key
    if (!emojis.hasOwnProperty(key)) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Invalid Emoji Key')
            .setDescription(`The key **"${key}"** does not exist.\n\nUse \`/setemoji\` without arguments to select from the dropdown categories.`);

        return isInteraction 
            ? await target.editReply({ embeds: [errEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [errEmbed], components: [] }).catch(() => {});
    }

    // 3. Handle Reset / Auto-Remove of Saved Database Custom Text
    if (isResetMode) {
        try {
            // Delete key from DB to restore default fallback emoji
            const cacheKey = emojiStore.makeCacheKey(guildId, key);
            emojiStore.cache.delete(cacheKey);

            const globalCacheKey = emojiStore.makeCacheKey('global', key);
            emojiStore.cache.delete(globalCacheKey);

            const mongoose = (await import('mongoose')).default;
            const EmojiModel = mongoose.models.QuestEmoji || mongoose.model('QuestEmoji');
            await EmojiModel.deleteOne({ guildId, key });
            await EmojiModel.deleteOne({ guildId: 'global', key });

            const freshEmojis = await getEmojis(guildId);
            const defaultEmoji = freshEmojis[key] || '⭐';

            const resetEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🧹 Emoji Reset to Default!')
                .setDescription(`Successfully removed old custom database emoji for **${key}**.\n\nIt is now reset to standard default: **${defaultEmoji}**`);

            return isInteraction 
                ? await target.editReply({ embeds: [resetEmbed], components: [] }).catch(() => {}) 
                : await target.reply({ embeds: [resetEmbed], components: [] }).catch(() => {});
        } catch (err) {
            console.error('Error resetting emoji:', err);
        }
    }

    // 4. Missing emoji argument check
    if (!newEmoji) {
        const infoEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`⚠️ Missing New Emoji for "${key}"`)
            .setDescription(`Current emoji for **${key}**: **${emojis[key]}**\n\n• To update: \`/setemoji key:${key} emoji:🟢\`\n• To reset to default: \`/setemoji key:${key} emoji:reset\``);

        return isInteraction 
            ? await target.editReply({ embeds: [infoEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [infoEmbed], components: [] }).catch(() => {});
    }

    // 5. Overwrite Old DB Entry & Save New Emoji Safely
    const success = await saveEmoji(key, newEmoji, guildId);

    const resultEmbed = new EmbedBuilder();
    if (success) {
        resultEmbed
            .setColor(0x57F287)
            .setTitle('✅ Emoji Updated & Overwritten!')
            .setDescription(`Old data removed. **${key}** is now set to ${newEmoji}`);
    } else {
        resultEmbed
            .setColor(0xED4245)
            .setTitle('❌ Database Error')
            .setDescription(`Failed to update emoji **${key}** in database.`);
    }

    return isInteraction 
        ? await target.editReply({ embeds: [resultEmbed], components: [] }).catch(() => {}) 
        : await target.reply({ embeds: [resultEmbed], components: [] }).catch(() => {});
}

// Helper function to render embed
function createCategoryEmbed(categoryName, emojis) {
    const keysList = EMOJI_CATEGORIES[categoryName] || [];
    const fieldContent = keysList
        .map(k => `• \`${k}\` : ${emojis[k] || '⭐'}`)
        .join('\n');

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎨 Quest Bot UI Emojis Manager`)
        .setDescription(`Viewing category: **${categoryName}**\nSelect a category from the dropdown menu to view emojis.\n`)
        .addFields({
            name: categoryName,
            value: fieldContent || 'No emojis in this category.',
            inline: false
        })
        .setFooter({ text: 'To update: /setemoji <key> <emoji> | To reset: /setemoji <key> reset' });
}
